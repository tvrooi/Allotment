import type { Locator, Page } from '@playwright/test';
import { test, expect, open, isoDay } from './fixtures';

// A touch tablet (an iPad in landscape): wide enough for the desktop layout, but without hover
// and with a finger for a pointer. What hover reveals on a desktop is shown here all the time,
// or it is invisible but still tappable, and small controls take a 44 px tap.

test.use({ viewport: { width: 1024, height: 800 }, isMobile: true, hasTouch: true });

const MIN = 44;
// A 1×1 PNG, the smallest logo the server accepts
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** The opacity the control is drawn at: its own times every ancestor's */
const drawnOpacity = (control: Locator) =>
  control.evaluate((el) => {
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement)
      opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });

async function expectShownAndTappable(control: Locator, min = MIN) {
  await expect(control).toBeVisible();
  expect(await drawnOpacity(control), `${control} is drawn`).toBe(1);
  const box = (await control.boundingBox())!;
  expect(Math.round(box.width), `${control} width`).toBeGreaterThanOrEqual(min);
  expect(Math.round(box.height), `${control} height`).toBeGreaterThanOrEqual(min);
}

async function payeeWithLogo(page: Page, api: import('./fixtures').Api, name: string) {
  const account = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -500,
    payeeName: name,
  });
  const payee = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
    (p) => p.name === name,
  )!;
  await api.call('PUT', `/payees/${payee.id}`, { logo: LOGO });
  await open(page, '/payees');
}

test("Payees' rows have a ⋮ menu on a touch screen, which also removes an image", async ({
  page,
  api,
}) => {
  await payeeWithLogo(page, api, 'Corner Bakery');
  const main = page.getByRole('main');
  // No hidden buttons that still take a tap, and no column of ×s on the logos
  await expect(main.getByRole('button', { name: 'Delete Corner Bakery' })).toBeHidden();
  await expect(main.getByRole('button', { name: 'Remove image for Corner Bakery' })).toBeHidden();
  const menu = main.getByRole('button', { name: 'Actions for Corner Bakery' });
  await expectShownAndTappable(menu);

  await menu.click();
  const items = page.getByRole('menu', { name: 'Actions for Corner Bakery' }).getByRole('menuitem');
  await expect(items).toHaveText(['Rename', 'Remove image', 'Delete']);
  await items.filter({ hasText: 'Remove image' }).click();
  const logo = main.locator(`img[src="${LOGO}"]`);
  await expect(logo).toHaveCount(0);
  // A tap too many is one Undo away
  await page.getByTestId('undo-toast').getByRole('button', { name: 'Undo' }).click();
  await expect(logo).toHaveCount(1);
});

test("a payee's own page keeps the logo's × drawn on a touch screen", async ({ page, api }) => {
  await payeeWithLogo(page, api, 'Corner Bakery');
  await page.getByRole('main').getByRole('link', { name: 'Corner Bakery' }).click();
  await expectShownAndTappable(
    page.getByRole('main').getByRole('button', { name: 'Remove image for Corner Bakery' }),
    24,
  );
});

test('Rules shows its row actions without hover, at tap size', async ({ page, api }) => {
  await api.createAccount('Checking');
  await api.call('POST', '/rules', {
    conditions: [{ field: 'payee_name', op: 'contains', value: 'bakery' }],
    actions: [{ type: 'set_notes', value: 'bread' }],
    sortOrder: 0,
  });
  await open(page, '/rules');
  const main = page.getByRole('main');
  for (const name of ['Apply to existing transactions', 'Duplicate', 'Edit', 'Delete'])
    await expectShownAndTappable(main.getByRole('button', { name, exact: true }));
  await expectShownAndTappable(main.getByRole('button', { name: 'Drag to reorder' }));

  // The switch's track stays small, but a tap 20 px above or below its middle still lands on it
  const toggle = main.getByRole('switch', { name: 'Disable rule' });
  const box = (await toggle.boundingBox())!;
  for (const dy of [-20, 20]) {
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="switch"]') !== null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 + dy },
    );
    expect(hit, `a tap ${dy} px from the switch's middle`).toBe(true);
  }
});

test("a saved report's Delete shows without hover, at tap size", async ({ page, api }) => {
  const month = isoDay().slice(0, 7);
  await api.call('POST', '/custom-reports', {
    name: 'Coffee runs',
    config: {
      chartType: 'table',
      mode: 'total',
      groupBy: 'payee',
      balanceType: 'expense',
      dateRange: { preset: '1m', from: month, to: month },
      filters: { accountIds: [], categoryIds: [], categoryGroupIds: [] },
    },
  });
  await open(page, '/reports/custom');
  await page.getByRole('button', { name: 'Saved reports' }).click();
  await expectShownAndTappable(page.getByRole('button', { name: 'Delete Coffee runs' }));
});

test('a row menu button takes a full-size tap', async ({ page, api }) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  await open(page, '/goals');
  await expectShownAndTappable(page.getByRole('button', { name: 'Actions' }).first());
});

test("Settings' account order takes a full-size drag handle", async ({ page, api }) => {
  await api.createAccount('Everyday', 1_000);
  await api.createAccount('Savings', 2_000);
  await open(page, '/settings?tab=accounts');
  await expectShownAndTappable(page.getByRole('button', { name: 'Drag to reorder' }).first());
});
