import { test, expect, open, isoDay } from './fixtures';

// Home dashboard personalization (phase 8): cards can be hidden, moved and reset per
// device. Presentation only: balances and transactions never change.

test('hides, moves and resets home cards, keeping them across a reload', async ({ page, api }) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await open(page, '/dashboard');
  const cards = page.locator('[data-testid^="home-card-"]');
  await expect(cards.first()).toHaveAttribute('data-testid', 'home-card-summary');

  await page.getByRole('button', { name: 'Customise' }).click();
  const dialog = page.getByRole('dialog', { name: 'Customise home' });
  await dialog.getByRole('checkbox', { name: 'Net worth' }).uncheck();
  await dialog.getByRole('button', { name: 'Move Recent transactions up' }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId('home-card-net-worth')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('home-card-net-worth')).toHaveCount(0);
  // Cards load independently; read the order once both compared cards are on the page
  await expect(page.getByTestId('home-card-recent-transactions')).toBeVisible();
  await expect(page.getByTestId('home-card-spending-breakdown')).toBeVisible();
  const order = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(order.indexOf('home-card-recent-transactions')).toBeLessThan(
    order.indexOf('home-card-spending-breakdown'),
  );

  // Hiding everything leaves a way back, and nothing in the budget changed
  await page.getByRole('button', { name: 'Customise' }).click();
  for (const box of await dialog.getByRole('checkbox').all()) await box.uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('All cards are hidden')).toBeVisible();
  await page.getByRole('button', { name: 'Show the default cards' }).click();
  await expect(cards.first()).toHaveAttribute('data-testid', 'home-card-summary');
  expect(await api.balance(account.id)).toBe(150_000);
});

test('the default dashboard puts review and commitments before long-term trends', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await api.createTransaction({
    accountId: account.id,
    date: '2026-11-09',
    amount: -1200,
    payeeName: 'Corner shop',
  });
  await open(page, '/dashboard');
  // Onboarding owns the next action until the owner puts it away.
  await expect(page.getByRole('region', { name: 'Review attention' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide getting started' }).click();
  const cards = page.locator('[data-testid^="home-card-"]');
  await expect(cards.first()).toHaveAttribute('data-testid', 'home-card-summary');
  await expect(cards.nth(1)).toHaveAttribute('data-testid', 'home-card-upcoming-bills');
  await expect(cards.nth(2)).toHaveAttribute('data-testid', 'home-card-budget-progress');
  const attention = page.getByRole('region', { name: 'Review attention' });
  await expect(attention).toBeVisible();
  await expect(
    attention.getByRole('link', { name: 'Give 1 transaction a category' }),
  ).toHaveAttribute('href', /transactions/);
  await expect(attention.getByRole('link', { name: 'Open review' })).toHaveAttribute(
    'href',
    /review$/,
  );
  const bills = await page.getByTestId('home-card-upcoming-bills').boundingBox();
  expect(bills!.y).toBeLessThan(page.viewportSize()!.height);
});

test('unavailable dashboard data is not shown as empty and can be retried', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday Checking', 150_000);
  await page.route('**/api/reports/spending-comparison*', (route) =>
    route.fulfill({ status: 422, json: { error: 'Temporarily unavailable' } }),
  );
  await open(page, '/dashboard');
  const card = page.getByTestId('home-card-spending-comparison');
  await expect(card.getByRole('alert')).toContainText('Couldn’t load your spending comparison.');
  await expect(card.getByText('Nothing to compare yet')).toHaveCount(0);
  await page.unroute('**/api/reports/spending-comparison*');
  await card.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(card.getByRole('alert')).toHaveCount(0);
  await expect(card.getByRole('group', { name: 'Compare spending with' })).toBeVisible();
});

test('a failed refresh keeps earlier dashboard figures with a retry notice', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday Checking', 150_000);
  await api.createTransaction({
    accountId: account.id,
    date: '2026-11-09',
    amount: -1200,
    payeeName: 'Corner shop',
  });
  await open(page, '/dashboard');
  const card = page.getByTestId('home-card-recent-transactions');
  await expect(card.getByText('Corner shop')).toBeVisible();
  await page.route('**/api/transactions?*', (route) =>
    route.fulfill({ status: 422, json: { error: 'Temporarily unavailable' } }),
  );
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.getByRole('link', { name: 'Budget', exact: true }).first().click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
  await expect(card.getByRole('status')).toContainText('Showing what was loaded earlier.');
  await expect(card.getByText('Corner shop')).toBeVisible();
  await page.unroute('**/api/transactions?*');
  await card.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(card.getByRole('status')).toHaveCount(0);
});

test('dashboard chart labels and compact controls keep contrast in both themes', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 250_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4250,
    payeeName: 'Corner shop',
  });
  await open(page, '/dashboard');
  // The savings goal dropdown shows once its Edit link is opened
  await page.getByRole('button', { name: 'Edit savings target' }).click();
  const comparison = page.getByTestId('home-card-spending-comparison');
  await expect(comparison.locator('path[stroke-dasharray="5 4"]').first()).toHaveAttribute(
    'stroke-dasharray',
    '5 4',
  );
  for (const dark of [false, true]) {
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark);
    const results = await page.evaluate(() => {
      // Read the theme's colours, not a colour transition part way through
      for (const animation of document.getAnimations()) animation.finish();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      const luminance = (color: string, background: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const values = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const contrast = (color: string, background: string) => {
        const a = luminance(color, background),
          b = luminance(background, background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      const selects = [...document.querySelectorAll<HTMLSelectElement>('main select')];
      const surface = getComputedStyle(selects[0]).backgroundColor;
      // The charts' range controls: every option, chosen or not, reads against the card
      const segments = [
        ...document.querySelectorAll<HTMLButtonElement>('main [role="group"] button[aria-pressed]'),
      ];
      return {
        segments: segments.map((el) => contrast(getComputedStyle(el).color, surface)),
        controls: selects.map((el) => {
          const style = getComputedStyle(el);
          return {
            text: contrast(style.color, surface),
            border: contrast(style.borderTopColor, surface),
            radius: style.borderRadius,
          };
        }),
        labels: [...document.querySelectorAll('[data-testid="chart-legend"] > span')].map((el) =>
          contrast(getComputedStyle(el).color, surface),
        ),
        line: contrast(
          getComputedStyle(
            document.querySelector(
              '[data-testid="home-card-spending-comparison"] path[stroke-dasharray="5 4"]',
            )!,
          ).stroke,
          surface,
        ),
      };
    });
    // The savings target is the one dropdown left; the chart ranges are segmented controls
    expect(results.controls).toHaveLength(1);
    expect(results.segments.length).toBeGreaterThanOrEqual(11);
    for (const ratio of results.segments) expect(ratio).toBeGreaterThanOrEqual(4.5);
    for (const control of results.controls) {
      expect(control.text).toBeGreaterThanOrEqual(4.5);
      expect(control.border).toBeGreaterThanOrEqual(3);
      expect(control.radius).toBe(results.controls[0].radius);
    }
    for (const ratio of results.labels) expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(results.line).toBeGreaterThanOrEqual(3);
  }
});
