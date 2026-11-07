import type { Page } from '@playwright/test';
import { test, expect, open, thisMonth } from '../fixtures';

// UX audit AU-011: on a phone the yearly budget opened on January, with this month's column
// off screen. It now opens on this month, clear of the sticky Category column, offers a
// labelled "Jump to month", and shows that more months are to the right.

/**
 * The month's column is on screen and not under the columns that stay put (Category and the
 * Assigned/Activity labels), which are themselves still in view
 */
async function expectMonthInView(page: Page, month: string) {
  const box = await page.getByTestId('annual-table-scroller').evaluate((el, m) => {
    const cell = el.querySelector<HTMLElement>(`th[data-month="${m}"]`)!.getBoundingClientRect();
    const fixed = Array.from(el.querySelectorAll<HTMLElement>('thead th')).filter(
      (th) => getComputedStyle(th).position === 'sticky',
    );
    const view = el.getBoundingClientRect();
    return {
      left: cell.left,
      right: cell.right,
      fixedRight: Math.max(...fixed.map((th) => th.getBoundingClientRect().right)),
      fixedCount: fixed.length,
      end: view.right,
    };
  }, month);
  expect(box.fixedCount).toBe(2);
  expect(box.left).toBeGreaterThanOrEqual(box.fixedRight - 1);
  expect(box.right).toBeLessThanOrEqual(box.end + 1);
  // A group's name and a row's label stay readable beside the scrolled months
  const scroller = page.getByTestId('annual-table-scroller');
  const start = (await scroller.boundingBox())!.x;
  for (const label of [
    scroller.locator('th[scope="rowgroup"] span').first(),
    scroller.getByText('Assigned', { exact: true }).first(),
  ]) {
    expect((await label.boundingBox())!.x).toBeGreaterThanOrEqual(start - 1);
  }
}

for (const width of [390, 320]) {
  test(`the yearly budget opens on this month and jumps to any month at ${width} px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await api.category('Groceries');
    const month = thisMonth();
    const year = month.slice(0, 4);
    await open(page, '/budget/year');

    await expectMonthInView(page, month);
    const header = page
      .getByRole('button', { name: /^[A-Z][a-z]{2}$/ })
      .and(page.locator('[aria-current="date"]'));
    await expect(header).toHaveCount(1);
    const jump = page.getByRole('combobox', { name: 'Jump to month' });
    await expect(jump).toHaveValue(month);

    await jump.selectOption(`${year}-12`);
    await expectMonthInView(page, `${year}-12`);
    await expect(jump).toHaveValue(`${year}-12`);
    await jump.selectOption(`${year}-01`);
    await expectMonthInView(page, `${year}-01`);
    // More months to the right are cued, until the table's end
    const more = page.getByTestId('annual-more-right');
    await expect(more).toBeVisible();
    await page.getByTestId('annual-table-scroller').evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(more).toHaveCount(0);

    // Back at this month, its column opens the monthly budget there
    await jump.selectOption(month);
    await header.click();
    await expect(page).toHaveURL(/\/budget$/);
  });
}

test('the jump list follows sideways scrolling', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await api.category('Groceries');
  const year = thisMonth().slice(0, 4);
  await open(page, `/budget/year/${Number(year) - 1}`);
  // Another year opens at January
  const jump = page.getByRole('combobox', { name: 'Jump to month' });
  await expect(jump).toHaveValue(`${Number(year) - 1}-01`);
  await page.getByTestId('annual-table-scroller').evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(jump).not.toHaveValue(`${Number(year) - 1}-01`);
});
