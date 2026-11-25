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
    await page.getByRole('button', { name: 'Hide getting started' }).click();
    // The next step keeps its button on a phone: full width and big enough to tap
    const review = page
      .getByRole('region', { name: 'Review attention' })
      .getByRole('link', { name: 'Open review', exact: true });
    await expect(review).toBeVisible();
    const reviewBox = (await review.boundingBox())!;
    expect(reviewBox.height).toBeGreaterThanOrEqual(44);
    expect(reviewBox.x + reviewBox.width).toBeLessThanOrEqual(width);
    // Left to spend shows its pace: $42.50 of $500 is 9% of the spending money
    await expect(
      page
        .getByTestId('home-card-summary')
        .getByText(/^9% of spending money used · \d+% through the month$/),
    ).toBeVisible();
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

    // Scrolling can reach the last card and every option of its range control, which
    // changes what the chart compares with
    const comparison = page.getByRole('group', { name: 'Compare spending with' });
    await comparison.scrollIntoViewIfNeeded();
    for (const option of await comparison.getByRole('button').all()) {
      const box = (await option.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    const average = comparison.getByRole('button', { name: 'Average month', exact: true });
    await average.click();
    await expect(average).toHaveAttribute('aria-pressed', 'true');
    await expect(
      comparison.getByRole('button', { name: 'Last month', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByTestId('home-card-spending-comparison').getByTestId('chart-legend'),
    ).toContainText('Average month (last 12 months)');
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
