import type { Locator, Page } from '@playwright/test';
import { test, expect, open, isoDay, categoryOption, tokenColour } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// The register's selection on a phone (390×844, the "phone" project): Select lets a tap select
// cards, which change colour, with no checkbox; the bar covers the toolbar so the list does not
// move, and the card's ⋯ or the bar's More actions opens the one selection menu, whose sub-menus
// open in place with Back.

const TOUCH = 44;

/** Width and height of the element's box, rounded (sub-pixel layout gives 43.99…) */
async function expectTouchSize(locator: Locator) {
  const box = (await locator.boundingBox())!;
  expect(Math.round(box.width), `${locator} width`).toBeGreaterThanOrEqual(TOUCH);
  expect(Math.round(box.height), `${locator} height`).toBeGreaterThanOrEqual(TOUCH);
}

const bar = (page: Page) => page.getByRole('region', { name: 'Selected transactions' });
const card = (page: Page, payee: string) =>
  page.getByTestId('transaction-card').filter({ hasText: payee });

test('on a phone cards are selected by tapping, and the one menu edits and reviews them', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
    ['Mock three', -300],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  // A household, so the bar has its Share button
  await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });
  const field = async (name: string) =>
    Object.fromEntries(
      (await api.transactions(`?account_id=${checking.id}`)).map((t) => [t.payeeName, t[name]]),
    );

  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(bar(page)).toContainText('0 selected');

  // A tap on a card toggles it while selecting: it does not open its details
  await card(page, 'Mock one').click();
  await card(page, 'Mock two').click();
  await expect(bar(page)).toContainText('2 selected');
  await card(page, 'Mock one').click();
  await expect(bar(page)).toContainText('1 selected');
  await card(page, 'Mock one').click();
  await expect(bar(page)).toContainText('2 selected');
  await expect(page.getByRole('complementary', { name: 'Transaction details' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^Select Mock one/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Select Mock three/ })).not.toBeChecked();

  // 44 px targets on the bar and the cards, and nothing sticks out sideways
  expect(await sidewaysOverflow(page)).toEqual([]);
  for (const control of [
    bar(page).getByRole('button', { name: 'More actions' }),
    bar(page).getByRole('button', { name: 'Clear selection' }),
    bar(page).getByRole('button', { name: 'Done' }),
    bar(page).getByRole('button', { name: 'Share 2 selected with household' }),
    page.getByRole('checkbox', { name: /^Select Mock one/ }),
    page.getByRole('button', { name: 'Actions for Mock two' }),
  ])
    await expectTouchSize(control);

  // More actions: the menu, then Category… with the shared list's search focused
  await bar(page).getByRole('button', { name: 'More actions' }).click();
  const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Category…' }).click();
  await expect(page.getByPlaceholder('Search categories...')).toBeFocused();
  const groceries = (await api.category('Groceries')).id;
  await categoryOption(page, 'Groceries', { exact: true }).click();
  await expect
    .poll(() => field('categoryId'))
    .toMatchObject({ 'Mock one': groceries, 'Mock two': groceries, 'Mock three': null });

  // A selected card's ⋯ opens the same selection menu, and Review opens in place, with Back. The
  // menu closes on scroll, and the page is taller than the screen: Playwright's own scrolling to
  // reach a card above the bottom bar delivers its scroll events after the menu has opened and would
  // close it, so the tap is sent without it (the size of ⋯ is checked above)
  await expect(card(page, 'Mock two')).toContainText('Groceries');
  const dots = page.getByRole('button', { name: 'Actions for Mock two' });
  await dots.dispatchEvent('click');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Review' }).click();
  const review = page.getByRole('menu', { name: 'Review' });
  await expect(review.getByRole('menuitem', { name: 'Back' })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
  await review.getByRole('menuitem', { name: 'Mark reviewed' }).click();
  await expect(page.getByTestId('undo-toast')).toContainText('Marked 2 reviewed.');
  await expect
    .poll(async () =>
      Object.fromEntries(
        Object.entries(await field('reviewedAt')).map(([payee, at]) => [payee, Boolean(at)]),
      ),
    )
    .toEqual({ 'Mock one': true, 'Mock two': true, 'Mock three': false });

  // Delete N is in the menu (the typed confirmation is the delete dialog's, tested on desktop)
  await bar(page).getByRole('button', { name: 'More actions' }).click();
  await expect(menu.getByRole('menuitem', { name: 'Delete 2' })).toBeVisible();
  expect(await sidewaysOverflow(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('a selected card changes colour, with no checkbox, and nothing on it moves', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });

  await open(page, '/transactions');
  const cards = page.getByTestId('transaction-card');
  await expect(cards).toHaveCount(2);

  const brand100 = await tokenColour(page, '--color-brand-100');
  const brand600 = await tokenColour(page, '--color-brand-600');
  const surface = await tokenColour(page, '--color-surface');
  const brand600Re = new RegExp(brand600.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const layout = async () => {
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    const payee = (await cards
      .nth(0)
      .getByText(/^Mock (one|two)$/)
      .boundingBox())!;
    const amount = (await cards
      .nth(0)
      .getByText(/^-\$[12]$/)
      .boundingBox())!;
    return {
      firstTop: first.y,
      firstLeft: first.x,
      secondTop: second.y,
      secondLeft: second.x,
      payeeOffset: payee.x - first.x,
      amountOffset: first.x + first.width - (amount.x + amount.width),
    };
  };
  const same = async (before: Awaited<ReturnType<typeof layout>>) => {
    const now = await layout();
    for (const [k, v] of Object.entries(before) as [keyof typeof before, number][]) {
      expect(now[k], k).toBeCloseTo(v, 0);
    }
  };

  const before = await layout();

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await same(before);
  const barBox = (await bar(page).boundingBox())!;
  const firstBox = (await cards.nth(0).boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(firstBox.y + 0.5);

  const checkboxes = page.getByRole('checkbox', { name: /^Select / });
  await expect(checkboxes).toHaveCount(2);
  expect(
    await checkboxes.evaluateAll((els) =>
      els.every(
        (el) => el.getAttribute('data-testid') === 'transaction-card' && el.tagName !== 'INPUT',
      ),
    ),
  ).toBe(true);

  await card(page, 'Mock one').click();
  await expect(page.getByRole('checkbox', { name: /^Select Mock one/ })).toBeChecked();
  await expect(card(page, 'Mock one')).toHaveCSS('background-color', brand100);
  await expect(card(page, 'Mock one')).toHaveCSS('box-shadow', brand600Re);
  await expect(card(page, 'Mock two')).toHaveCSS('background-color', surface);
  await expect(page.getByRole('complementary', { name: 'Transaction details' })).toHaveCount(0);
  await same(before);

  expect(await sidewaysOverflow(page)).toEqual([]);
  for (const control of [
    bar(page).getByRole('button', { name: 'More actions' }),
    bar(page).getByRole('button', { name: 'Select all 2' }),
    bar(page).getByRole('button', { name: 'Share 1 selected with household' }),
    bar(page).getByRole('button', { name: 'Clear selection' }),
    bar(page).getByRole('button', { name: 'Done' }),
    page.getByRole('checkbox', { name: /^Select Mock one/ }),
    page.getByRole('button', { name: 'Actions for Mock one' }),
  ])
    await expectTouchSize(control);

  await bar(page).getByRole('button', { name: 'Done' }).click();
  await same(before);
});

test('at 390 px the selection bar stays inside the toolbar while the summary is pending or failed', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });

  let releaseSummary!: () => void;
  const summaryHeld = new Promise<void>((resolve) => {
    releaseSummary = resolve;
  });
  let summaryRequested = false;
  await page.route('**/api/transactions/summary*', async (route) => {
    summaryRequested = true;
    await summaryHeld;
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Summary unavailable' }),
    });
  });

  await open(page, '/transactions');
  const cards = page.getByTestId('transaction-card');
  await expect(cards).toHaveCount(2);
  await expect.poll(() => summaryRequested).toBe(true);

  const selectBtn = page.getByRole('button', { name: 'Select', exact: true });
  const toolbarBefore = selectBtn.locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
  const dateHeader = page
    .getByText('Total moved')
    .first()
    .locator('xpath=ancestor::div[contains(@class,"border-b")][1]');

  const beforeToolbar = (await toolbarBefore.boundingBox())!;
  const beforeHeader = (await dateHeader.boundingBox())!;
  const beforeCard = (await cards.nth(0).boundingBox())!;
  expect(beforeToolbar.y + beforeToolbar.height).toBeLessThanOrEqual(beforeHeader.y + 0.5);
  expect(beforeHeader.y + beforeHeader.height).toBeLessThanOrEqual(beforeCard.y + 0.5);

  await selectBtn.click();
  const toolbarWhileSelecting = bar(page).locator('xpath=preceding-sibling::div[1]');
  const checkInsideAndUnmoved = async () => {
    const toolbarBox = (await toolbarWhileSelecting.boundingBox())!;
    const barBox = (await bar(page).boundingBox())!;
    const headerBox = (await dateHeader.boundingBox())!;
    const cardBox = (await cards.nth(0).boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 0.5);
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(headerBox.y + 0.5);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(headerBox.y + 0.5);
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(cardBox.y + 0.5);
    expect(headerBox.y).toBeCloseTo(beforeHeader.y, 0);
    expect(cardBox.y).toBeCloseTo(beforeCard.y, 0);
  };
  await checkInsideAndUnmoved();

  await card(page, 'Mock one').click();
  await expect(bar(page)).toContainText('1 selected');
  await checkInsideAndUnmoved();

  const summaryResponse = page.waitForResponse((res) =>
    res.url().includes('/api/transactions/summary'),
  );
  releaseSummary();
  await summaryResponse;
  await checkInsideAndUnmoved();

  await bar(page).getByRole('button', { name: 'Done' }).click();
  expect((await dateHeader.boundingBox())!.y).toBeCloseTo(beforeHeader.y, 0);
  expect((await cards.nth(0).boundingBox())!.y).toBeCloseTo(beforeCard.y, 0);
});

test('More actions keeps its horizontal position when the selected count crosses to two digits', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  for (let i = 1; i <= 12; i++) {
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -i * 100,
      payeeName: `Mock ${String(i).padStart(2, '0')}`,
    });
  }
  await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });

  await open(page, '/transactions');
  const cards = page.getByTestId('transaction-card');
  await expect(cards).toHaveCount(12);

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const more = bar(page).getByRole('button', { name: 'More actions' });
  const before = (await more.boundingBox())!;

  for (let i = 0; i < 9; i++) await cards.nth(i).click();
  await expect(bar(page)).toContainText('9 selected');
  const atNine = (await more.boundingBox())!;
  expect(atNine.x).toBeCloseTo(before.x, 0);
  expect(atNine.y).toBeCloseTo(before.y, 0);

  await cards.nth(9).click();
  await expect(bar(page)).toContainText('10 selected');
  const atTen = (await more.boundingBox())!;
  expect(atTen.x).toBeCloseTo(before.x, 0);
  expect(atTen.y).toBeCloseTo(before.y, 0);

  await bar(page).getByRole('button', { name: 'Select all 12' }).click();
  await expect(bar(page)).toContainText('All 12 selected');
  const atAll = (await more.boundingBox())!;
  expect(atAll.x).toBeCloseTo(before.x, 0);
  expect(atAll.y).toBeCloseTo(before.y, 0);
});
