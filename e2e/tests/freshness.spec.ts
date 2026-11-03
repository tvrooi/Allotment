import { test, expect, open, isoDay } from './fixtures';

// Any change that succeeds refreshes every page that shows ledger figures
// (client/src/utils/ledgerViews.ts): the Budget page never shows what a register edit changed.
test('recategorising in the register shows on the Budget page straight away', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 100_000);
  const groceries = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -2_500,
    payeeName: 'Corner store',
    categoryId: groceries.id,
  });

  await open(page, '/budget');
  // A category with nothing in it may be folded away, so only spending is looked for
  const spent = (name: string) =>
    page.getByRole('link', { name: new RegExp(`^Activity in ${name}: -\\$25`) });
  await expect(spent('Groceries')).toBeVisible();

  // Move it to Restaurants in the register, without reloading the app
  await page.getByRole('link', { name: 'Transactions', exact: true }).first().click();
  const row = page.getByTestId('transaction-row').filter({ hasText: 'Corner store' });
  await row.getByText('Groceries', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Search categories' }).fill('Restaurants');
  await page.keyboard.press('Enter');
  await expect(row).toContainText('Restaurants');

  await page.getByRole('link', { name: 'Budget', exact: true }).first().click();
  await expect(spent('Restaurants')).toBeVisible();
  await expect(spent('Groceries')).toHaveCount(0);
});
