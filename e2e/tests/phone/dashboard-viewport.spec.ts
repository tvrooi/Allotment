import { test, expect, open, isoDay, thisMonth } from '../fixtures';
import { sidewaysOverflow } from './overflow';

// iPhone 14 Pro Max in CSS pixels, a shorter browser viewport, and smaller phones.
for (const [width, height] of [
  [430, 932],
  [430, 740],
  [390, 844],
  [320, 568],
]) {
  test(`dashboard controls remain usable at ${width}×${height}`, async ({
    page,
    api,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    const account = await api.createAccount('Everyday', 250_000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -4250,
      payeeName: 'Corner Grocery',
      categoryId: groceries.id,
    });
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await open(page, '/dashboard');
    // The phone keeps the savings target in its history block, behind an Edit link
    const history = page.getByTestId('home-history');
    await history.getByRole('button', { name: 'Edit savings target' }).click();
    const target = history.getByRole('combobox', { name: 'Savings rate goal' });
    await expect(target).toBeVisible();
    expect(
      await target.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    await target.selectOption('25');
    // Choosing a target closes the dropdown and shows it as text again
    await expect(history.getByRole('button', { name: 'Edit savings target' })).toHaveText(
      'Target 25% · Edit',
    );
    expect(await sidewaysOverflow(page)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('dashboard.png') });

    // Scrolling can reach the last card and its complete period selector.
    const comparison = page.getByRole('combobox', { name: 'Compare spending' });
    await comparison.scrollIntoViewIfNeeded();
    await expect(comparison).toBeVisible();
    await comparison.selectOption('month_vs_average');
    await expect(comparison).toHaveValue('month_vs_average');
    expect(await sidewaysOverflow(page)).toEqual([]);

    await page.getByRole('button', { name: 'Customise', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customise home' });
    const move = dialog.getByRole('button', { name: 'Move Spending comparison up', exact: true });
    await move.scrollIntoViewIfNeeded();
    const box = (await move.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await move.click();
    const label = dialog.getByText('Spending comparison', { exact: true });
    expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await sidewaysOverflow(page)).toEqual([]);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
}
