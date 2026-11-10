import { test, expect, open, isoDay } from './fixtures';

for (const width of [1400, 390]) {
  test(`advanced filters keep the ledger visible at ${width}px`, async ({ page, api }) => {
    const account = await api.createAccount('Everyday');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -4250,
      payeeName: 'Corner shop',
      categoryId: groceries.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 10000,
      payeeName: 'Pay day',
    });
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/transactions');
    const trigger = page.getByRole('button', { name: /^Filters/ });
    await trigger.click();
    const filters = page.getByRole('region', { name: 'Advanced filters' });
    await expect(filters.getByRole('tabpanel', { name: 'Categories', exact: true })).toBeVisible();
    await expect(filters.getByRole('tabpanel')).toHaveCount(1);
    expect((await filters.boundingBox())!.height).toBeLessThan(240);
    const rows = page.getByTestId(width < 768 ? 'transaction-card' : 'transaction-row');
    await expect(rows.first()).toBeInViewport({ ratio: 0.5 });

    // Each tab keeps its local search and an invalid amount without silently applying it.
    await page.getByRole('searchbox', { name: 'Find categories' }).fill('Grocer');
    const categories = page.getByRole('tab', { name: 'Categories', exact: true });
    await categories.focus();
    await categories.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Accounts', exact: true })).toBeFocused();
    await categories.click();
    await expect(page.getByRole('searchbox', { name: 'Find categories' })).toHaveValue('Grocer');
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await page.getByLabel('At least').fill('oops');
    await page.getByRole('tab', { name: 'Status', exact: true }).click();
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await expect(page.getByLabel('At least')).toHaveValue('oops');
    await expect(page.getByLabel('At least')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('At least').fill('40');
    await page.getByLabel('At least').press('Enter');
    await filters.getByRole('button', { name: 'Money out', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Corner shop');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(filters).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('button', { name: 'Clear Money out', exact: true })).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('tab', { name: 'Money', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByLabel('At least').press('Escape');
    await expect(filters).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'This month', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
