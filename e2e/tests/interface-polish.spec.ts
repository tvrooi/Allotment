import { test, expect, open, isoDay } from './fixtures';

// Interface details (the make-interfaces-feel-better review, 25 November 2026): states that
// assistive tech can hear, press feedback, picture edges, words that wrap whole, and figures
// that keep their width.

const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test("Add transaction's Debit and Credit say which one is chosen", async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  const group = dialog.getByRole('group', { name: 'Debit or credit' });
  const debit = group.getByRole('button', { name: 'Debit' });
  const credit = group.getByRole('button', { name: 'Credit' });
  await expect(debit).toHaveAttribute('aria-pressed', 'true');
  await expect(credit).toHaveAttribute('aria-pressed', 'false');
  await credit.click();
  await expect(credit).toHaveAttribute('aria-pressed', 'true');
  await expect(debit).toHaveAttribute('aria-pressed', 'false');
});

test('a button shrinks slightly while it is pressed', async ({ page, api }) => {
  await api.createAccount('Checking');
  await open(page, '/rules');
  const button = page.getByRole('main').getByRole('button', { name: 'Add rule' });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).scale)).toBe('0.96');
  await page.mouse.up();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).scale)).not.toBe('0.96');
});

test('the chosen goal colour is ringed, not enlarged', async ({ page }) => {
  await open(page, '/goals');
  await page
    .getByRole('main')
    .getByRole('button', { name: /^(New|Add) goal$/ })
    .first()
    .click();
  const swatch = page.getByRole('dialog').getByRole('button', { name: 'Colour #059669' });
  await swatch.click();
  await expect(swatch).toHaveAttribute('aria-pressed', 'true');
  const style = await swatch.evaluate((el) => {
    const s = getComputedStyle(el);
    return { scale: s.scale, transform: s.transform, ring: s.boxShadow };
  });
  expect(style.scale).toBe('none');
  expect(style.transform).toBe('none');
  expect(style.ring).not.toBe('none');
});

test("a payee's logo has a neutral edge in both themes", async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -500,
    payeeName: 'Corner Bakery',
  });
  const payee = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
    (p) => p.name === 'Corner Bakery',
  )!;
  await api.call('PUT', `/payees/${payee.id}`, { logo: LOGO });
  await open(page, '/payees');
  const logo = page.getByRole('main').locator(`img[src="${LOGO}"]`).first();
  const edge = () =>
    logo.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} ${s.borderTopWidth}`;
    });
  // No warm border; a 1px outline of pure black at 10%
  await expect.poll(edge).toBe('solid 1px rgba(0, 0, 0, 0.1) 0px');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect.poll(edge).toBe('solid 1px rgba(255, 255, 255, 0.1) 0px');
});

test('rule chips wrap between words, and page titles balance their lines', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking');
  await api.call('POST', '/rules', {
    conditions: [{ field: 'payee_name', op: 'contains', value: 'bakery' }],
    actions: [{ type: 'set_notes', value: 'Home Goods and a few other household things' }],
    sortOrder: 0,
  });
  await open(page, '/rules');
  const chip = page.getByRole('main').getByText(/Home Goods and a few/);
  await expect(chip).toBeVisible();
  expect(await chip.evaluate((el) => getComputedStyle(el).wordBreak)).not.toBe('break-all');
  expect(
    await page
      .getByRole('heading', { level: 1, name: 'Rules' })
      .evaluate((el) => getComputedStyle(el).textWrap),
  ).toContain('balance');
});

test("a goal's progress figures keep their width as they change", async ({ page, api }) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  await open(page, '/goals');
  const progress = page.getByRole('main').getByText(/to go/).first();
  await expect(progress).toBeVisible();
  expect(await progress.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain(
    'tabular-nums',
  );
});
