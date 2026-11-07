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
      if (box.right > window.innerWidth + 1 || box.left < -1)
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
    expect(await brokenAmounts(page)).toEqual([]);

    await open(page, '/dashboard');
    await expect(page.getByText('Avg monthly income', { exact: true })).toBeVisible();
    expect(await brokenAmounts(page)).toEqual([]);
    expect(await sidewaysOverflow(page)).toEqual([]);
  });
}
