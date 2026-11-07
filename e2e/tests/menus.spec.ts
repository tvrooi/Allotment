import { test, expect, open } from './fixtures';

// Menus, tab bars and buttons behave like a desktop app's: keyboard, Escape, outside clicks,
// a mouse wheel over a tab bar, and the right pointer.

test('the Views menu closes on Escape or a click outside, and its ⋮ menu still works', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 100_000);
  await api.call('POST', '/saved-views', { name: 'Big spends', query: 'min_amount=10001' });
  await open(page, '/transactions');
  const views = page.getByRole('button', { name: 'Views' });
  const menu = page.getByRole('menu', { name: 'Saved views' });

  // Opening it focuses the first view; Escape closes it and gives focus back to Views
  await views.click();
  await expect(page.getByRole('menuitem', { name: 'Big spends' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(views).toBeFocused();

  // A click anywhere else closes it
  await views.click();
  await expect(menu).toBeVisible();
  await page.getByRole('heading', { name: 'Transactions' }).click();
  await expect(menu).toHaveCount(0);

  // Its ⋮ menu opens over it without closing it, and Escape closes only the ⋮ menu
  await views.click();
  const actions = page.getByRole('button', { name: 'Actions for Big spends' });
  await actions.click();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Delete view' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(actions).toBeFocused();

  // ...and its items still work
  await actions.click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await expect(page.getByRole('dialog', { name: 'Rename view' })).toBeVisible();
});

test('tab bars move with the arrow keys', async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/transactions');
  const all = page.getByRole('tab', { name: 'All' });
  const receipts = page.getByRole('tab', { name: 'Receipts' });
  await expect(all).toHaveAttribute('aria-selected', 'true');
  // Only the open tab is in the Tab order
  await expect(receipts).toHaveAttribute('tabindex', '-1');
  await all.focus();
  await page.keyboard.press('ArrowRight');
  await expect(receipts).toBeFocused();
  await expect(receipts).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(all).toHaveAttribute('aria-selected', 'true');
});

test('a mouse wheel scrolls a tab bar wider than the window sideways', async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await page.setViewportSize({ width: 900, height: 800 });
  await open(page, '/settings');
  const scroller = page.getByTestId('scroll-cue-scroller').first();
  await expect(page.getByTestId('scroll-cue-right').first()).toBeVisible();
  const before = await page.locator('main').evaluate((el) => el.scrollTop);
  await scroller.hover();
  await page.mouse.wheel(0, 200);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  // Not up and down, and the page under it stayed put
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
  expect(await page.locator('main').evaluate((el) => el.scrollTop)).toBe(before);
});

test('buttons show the pointer, but not when disabled, and drag handles show a hand', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/settings?tab=categories');
  const handle = page.getByRole('button', { name: /^Drag to reorder / }).first();
  await expect(handle).toHaveCSS('cursor', 'grab');
  await expect(page.getByRole('tab', { name: 'Tags' })).toHaveCSS('cursor', 'pointer');
  const disabled = await page.evaluate(() => {
    const b = document.createElement('button');
    b.disabled = true;
    document.body.append(b);
    const cursor = getComputedStyle(b).cursor;
    b.remove();
    return cursor;
  });
  expect(disabled).toBe('default');
});
