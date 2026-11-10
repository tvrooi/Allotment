import { test, expect, open, isoDay } from './fixtures';

for (const width of [1400, 390]) {
  test(`transactions explain money movement at ${width}px`, async ({ page, api }) => {
    const account = await api.createAccount('Spending');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -4250,
      payeeName: 'Corner shop',
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 10000,
      payeeName: 'Pay day',
    });
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/transactions');
    const money = page.getByRole('definition');
    await expect(page.getByText('Money in', { exact: true })).toBeVisible();
    await expect(page.getByText('Money out', { exact: true })).toBeVisible();
    await expect(page.getByText('Net movement', { exact: true })).toBeVisible();
    await expect(money).toContainText(['$100', '$42.50', '$57.50']);
    const rows = page.getByTestId(width < 768 ? 'transaction-card' : 'transaction-row');
    await expect(rows.filter({ hasText: 'Corner shop' })).toContainText('-$42.50');
    await expect(rows.filter({ hasText: 'Pay day' })).toContainText('+$100');
    await expect(page.getByText('Total moved', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
