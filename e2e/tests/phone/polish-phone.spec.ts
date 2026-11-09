import type { Locator, Page } from '@playwright/test';
import { test, expect, open, isoDay } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// First-week polish on a phone (390×844): the reconcile screen, the budget header, tab bars
// that scroll sideways, and the category list in the add-transaction sheet.

const WIDTH = 390;

async function box(locator: Locator) {
  return (await locator.boundingBox())!;
}

test('the reconcile list fills the screen under the summary', async ({ page, api }) => {
  const acct = await api.createAccount('Everyday', 100_000);
  for (const [i, payee] of ['Corner Grocery', 'Streamflix', 'City Power & Light'].entries())
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(-i),
      amount: -(2_000 + i * 500),
      payeeName: payee,
    });
  await open(page, `/accounts/${acct.id}/reconcile`);
  await page.getByRole('textbox', { name: 'Statement balance' }).fill('900');
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();

  const table = page.getByRole('table');
  await expect(table.getByRole('row', { name: /Corner Grocery/ })).toBeVisible();
  const list = await box(table);
  // The list is as wide as the screen, not squeezed beside the summary
  expect(list.width).toBeGreaterThanOrEqual(WIDTH * 0.9);
  const summary = await box(page.getByText('Selected balance'));
  expect(summary.y, 'summary is above the list').toBeLessThan(list.y);
  // Payee names are readable, and the buttons are reachable
  const payee = await box(table.getByText('Corner Grocery'));
  expect(payee.width).toBeGreaterThan(80);
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
});

test.describe('the budget header', () => {
  test('is short, keeps one menu for the rest, and finds Groceries in two taps', async ({
    page,
    api,
  }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    const header = page.getByTestId('budget-header');
    await expect(header).toBeVisible();
    // Everything above the categories, tip included, fits in a fifth of the screen
    await expect(page.getByRole('status', { name: 'Ready to assign' })).toBeVisible();
    expect((await box(header)).height).toBeLessThanOrEqual(200);
    const tip = page.getByText(/No money assigned for/);
    const bottom = (await box(tip)).y + (await box(tip)).height;
    expect(bottom).toBeLessThanOrEqual(300);

    // Year, Auto-assign and Until next payday are in one menu
    await expect(page.getByRole('link', { name: 'Year', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Auto-assign' })).toHaveCount(0);
    await page.getByRole('button', { name: 'More budget actions' }).click();
    const menu = page.getByRole('menu');
    for (const name of ['Year', 'Auto-assign', 'Until next payday'])
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Auto-assign' }).click();
    await expect(page.getByRole('dialog', { name: 'Auto-assign' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // Month buttons look like buttons
    for (const name of ['Previous month', 'Next month']) {
      const border = await page
        .getByRole('button', { name })
        .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
      expect(border).toBeGreaterThan(0);
    }

    // Tap 1: the search field. Tap 2: the category.
    await page.getByRole('searchbox', { name: 'Find a category' }).fill('Groc');
    const planned = page.getByRole('button', { name: /^Assigned to Groceries:/ });
    await expect(planned).toBeInViewport();
    expect(await sidewaysOverflow(page)).toEqual([]);
    await planned.click();
    // The closed Auto-assign sheet may still be animating out: name the one we expect
    await expect(page.getByRole('dialog', { name: 'Plan Groceries' })).toBeVisible();
  });

  test('the Ready to assign help does not cover "Put $X in an envelope…"', async ({
    page,
    api,
  }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    await page.getByRole('button', { name: 'What is Ready to assign?' }).click();
    const note = await box(page.getByRole('note'));
    const put = await box(page.getByRole('button', { name: /^Put .* in an envelope/ }));
    expect(note.y + note.height).toBeLessThanOrEqual(put.y + 1);
    expect(note.x).toBeGreaterThanOrEqual(0);
    expect(note.x + note.width).toBeLessThanOrEqual(WIDTH);
  });

  test('"Until next payday" opens from the menu', async ({ page, api }) => {
    await api.createAccount('Everyday', 100_000);
    await open(page, '/budget');
    await page.getByRole('button', { name: 'More budget actions' }).click();
    await page.getByRole('menuitem', { name: 'Until next payday' }).click();
    await expect(page.getByRole('heading', { name: 'Until next payday' })).toBeVisible();
  });
});

/** Every tab is whole (its label isn't cut), and the bar says when more is off screen */
async function expectTabsReadable(page: Page, bar: Locator, tabs: Locator) {
  await expect(bar.getByTestId('scroll-cue-right')).toBeVisible();
  await expect(bar.getByTestId('scroll-cue-left')).toHaveCount(0);
  const scroller = bar.getByTestId('scroll-cue-scroller');
  const count = await tabs.count();
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    await tab.scrollIntoViewIfNeeded();
    // The label fits its button...
    const clipped = await tab.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, `tab ${i} label is cut`).toBe(false);
    // ...and the button sits inside the bar (no half tab at the edge)
    const t = await box(tab);
    const s = await box(scroller);
    expect(t.x).toBeGreaterThanOrEqual(s.x - 1);
    expect(t.x + t.width).toBeLessThanOrEqual(s.x + s.width + 1);
  }
  // At the far end the cue has turned round
  await expect(bar.getByTestId('scroll-cue-right')).toHaveCount(0);
  await expect(bar.getByTestId('scroll-cue-left')).toBeVisible();
}

test('the Transactions period tabs show they scroll, and none is cut off', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/transactions');
  const tabs = page.getByRole('button', {
    name: /^(This month|Last month|Last 3 months|This year|All time|Custom)$/,
  });
  const bar = page.getByTestId('scroll-cue').first();
  // The row scrolls without a scrollbar of its own: the global thin scrollbar used to win
  // over the row's hidden one and drew a bar across the tab labels
  const scrollbar = await bar
    .getByTestId('scroll-cue-scroller')
    .evaluate((el) => getComputedStyle(el).scrollbarWidth);
  expect(scrollbar).toBe('none');
  await expectTabsReadable(page, bar, tabs);
  // A period chosen past the edge is brought into view, clear of the fade, page unmoved
  await bar.getByTestId('scroll-cue-scroller').evaluate((el) => (el.scrollLeft = 0));
  await page.evaluate(() => window.scrollTo(0, 0));
  await bar.getByRole('button', { name: 'Custom' }).click();
  await expect(bar.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
  const custom = await box(bar.getByRole('button', { name: 'Custom' }));
  const row = await box(bar.getByTestId('scroll-cue-scroller'));
  expect(custom.x + custom.width).toBeLessThanOrEqual(row.x + row.width + 1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('the Settings tabs show they scroll, and none is cut off', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/settings');
  const bar = page.getByTestId('scroll-cue').first();
  const tabs = bar.locator('button');
  await expectTabsReadable(page, bar, tabs);
});

test('the category list in Add transaction is as wide as its field', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/transactions');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByRole('button', { name: /^Category:/ });
  await field.click();
  const search = page.getByRole('textbox', { name: 'Search categories' });
  await expect(search).toBeVisible();
  const picker = search.locator('xpath=ancestor::div[contains(@class,"shadow-lg")][1]');
  const f = await box(field);
  const p = await box(picker);
  // Full width give or take a scrollbar or border (the old list was about 65% of the field)
  expect(Math.round(p.width)).toBeGreaterThanOrEqual(Math.round(f.width) - 8);
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(WIDTH);
});

/**
 * Every row that scrolls sideways (tab bars, the bank provider switch) on the page: none may
 * also scroll up and down. A tab hanging a pixel out of its row used to let a finger drag the
 * whole bar up and down.
 */
async function rowsThatScrollUpAndDown(page: Page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll<HTMLElement>(
      '[data-testid="scroll-cue-scroller"], [role="tablist"], .scroll-row',
    );
    const problems: string[] = [];
    for (const row of rows) {
      // A tab row that wraps instead of scrolling can't scroll either way
      if (getComputedStyle(row).overflowX === 'visible') continue;
      const name = (row.getAttribute('aria-label') ?? row.textContent ?? '').trim().slice(0, 30);
      if (getComputedStyle(row).overflowY !== 'hidden') problems.push(`"${name}" overflow-y`);
      row.scrollTop = 20;
      if (row.scrollTop !== 0 || row.scrollHeight > row.clientHeight)
        problems.push(`"${name}" scrolls down +${row.scrollHeight - row.clientHeight}px`);
    }
    return { count: rows.length, problems };
  });
}

test('tab bars scroll sideways only, never up and down', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  for (const route of [
    '/settings',
    '/settings?tab=connections',
    '/transactions',
    '/forecast',
    '/tax',
    '/reports',
  ]) {
    await open(page, route);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('main [data-testid="scroll-cue-scroller"], main [role="tablist"]').first(),
    ).toBeVisible();
    const { count, problems } = await rowsThatScrollUpAndDown(page);
    expect(count, route).toBeGreaterThan(0);
    expect(problems, route).toEqual([]);
  }
});

test('Settings opened on a later tab shows that tab whole', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/settings?tab=connections');
  const bar = page.getByTestId('scroll-cue').first();
  const tab = bar.getByRole('tab', { name: 'Connected banks' });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  // Clear of the fade at either edge, not half hidden under it
  const t = await box(tab);
  const s = await box(bar.getByTestId('scroll-cue-scroller'));
  expect(t.x).toBeGreaterThanOrEqual(s.x + 39);
  expect(t.x + t.width).toBeLessThanOrEqual(s.x + s.width - 39);
});

test('the detail sheet steps to the previous and next transaction with 44 px buttons', async ({
  page,
  api,
}) => {
  const acct = await api.createAccount('Everyday', 100_000);
  for (const [i, payeeName] of ['Corner Grocery', 'Corner Bakery'].entries())
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(-i),
      amount: -(1_000 + i * 100),
      payeeName,
    });
  await open(page, `/accounts/${acct.id}`);
  await page.getByRole('button', { name: 'All time' }).click();
  await page.getByTestId('transaction-card').filter({ hasText: 'Corner Grocery' }).click();

  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  const previous = panel.getByRole('button', { name: 'Previous transaction' });
  const next = panel.getByRole('button', { name: 'Next transaction' });
  for (const button of [previous, next, panel.getByRole('button', { name: 'Close details' })]) {
    const { width, height } = await box(button);
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(panel.getByText('Corner Bakery', { exact: true })).toBeVisible();
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(panel.getByText('Corner Grocery', { exact: true })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
});

// UX audit AU-012: on a phone each feature's description sat in a sliver beside its three
// choices. It now takes the row's width, with the choices on a line of their own below.
for (const width of [320, WIDTH]) {
  test(`Show in the menu stacks its choices under each feature at ${width} px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await open(page, '/settings?tab=preferences');
    const section = page.getByRole('region', { name: 'Show in the menu' });
    const rows = section.getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      const text = row.locator('p').first();
      const choices = row.getByRole('radiogroup');
      const [r, t, c] = [await box(row), await box(text), await box(choices)];
      // The description uses most of the row, and the choices start below it
      expect(t.width).toBeGreaterThan(r.width * 0.8);
      expect(c.y).toBeGreaterThanOrEqual(t.y + t.height);
      for (const choice of await choices.getByRole('radio').all()) {
        expect((await box(choice)).height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(await sidewaysOverflow(page)).toEqual([]);
  });
}
