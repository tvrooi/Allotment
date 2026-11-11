import type { Page } from '@playwright/test';
import { test, expect, open, isoDay } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// UX audit AU-008: a summary tile showed "$165,905.1" with the "8" on the next line. Every
// dollar amount on these pages must stay whole on one line, inside the screen, at phone widths.

/** Dollar amounts in `main` that break over lines or run past the screen's edge */
async function brokenAmounts(page: Page) {
  return page.evaluate(() => {
    const money = /^[−-]?\$[\d,]+(\.\d\d)?$/;
    const problems: string[] = [];
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent!.trim();
      if (!money.test(text)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      const box = range.getBoundingClientRect();
      if (box.width === 0) continue;
      if (lines.size > 1) problems.push(`${text} breaks over ${lines.size} lines`);
      // A table that scrolls sideways on purpose may hold amounts past the edge (as
      // overflow.ts allows): those must still be whole, but needn't be on screen
      const scroller = (el: Element | null): boolean =>
        !!el && (/auto|scroll/.test(getComputedStyle(el).overflowX) || scroller(el.parentElement));
      if ((box.right > window.innerWidth + 1 || box.left < -1) && !scroller(node.parentElement))
        problems.push(`${text} runs off screen`);
    }
    return problems;
  });
}

for (const width of [320, 390]) {
  test(`large amounts stay whole in report summaries at ${width} px`, async ({ page, api }) => {
    await page.setViewportSize({ width, height: 844 });
    const checking = await api.createAccount('Checking', 16_590_518);
    await api.createAccount('Home loan', -123_456_789, 'credit');
    const paychecks = await api.category('Paychecks');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 1_234_567_89,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });

    await open(page, '/reports');
    await expect(page.getByText('Total income', { exact: true })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('$1,234,567.89');
    expect(await brokenAmounts(page)).toEqual([]);

    const [board] = await api.call<{ id: string }[]>('GET', '/dashboards');
    const widgets = await api.call<{ id: string; type: string }[]>(
      'GET',
      `/dashboards/${board.id}/widgets`,
    );
    const netWorth = widgets.find((w) => w.type === 'net-worth')!;
    await open(page, `/reports/widget/${netWorth.id}`);
    // Assets $1,400,473.07 and liabilities −$1,234,567.89 in the detail's summary tiles
    await expect(page.getByRole('main')).toContainText('1,400,473.07');
    // Its table too, so the amounts in it are checked whatever order they load in
    await expect(page.getByRole('main').getByRole('table')).toContainText('165,905.18');
    expect(await brokenAmounts(page)).toEqual([]);

    await open(page, '/dashboard');
    // The phone history block keeps the figures visible but groups them under one period label.
    const summary = page.getByTestId('home-history');
    await expect(summary.getByText('Income / month', { exact: true })).toBeVisible();
    await expect(summary.getByText('Expenses / month', { exact: true })).toBeVisible();
    await expect(summary.getByText(/Includes current month/)).toHaveCount(1);
    await summary.getByRole('button', { name: 'Edit savings target' }).click();
    const target = summary.getByRole('combobox', { name: 'Savings rate goal' });
    await target.selectOption('25');
    await expect(summary.getByRole('button', { name: 'Edit savings target' })).toHaveText(
      'Target 25% · Edit',
    );
    await summary.getByText('How these figures are calculated', { exact: true }).click();
    await expect(summary.getByText(/It measures the share of income/)).toBeVisible();
    expect(await brokenAmounts(page)).toEqual([]);
    expect(await sidewaysOverflow(page)).toEqual([]);
  });
}
