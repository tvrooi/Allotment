import { test, expect, open, isoDay } from './fixtures';

// Phase 2 "let people recover": a reconciliation can be undone, one locked row unlocked, and a
// reconciled row still takes a category.

const row = (page: import('@playwright/test').Page, text: string) =>
  page.getByTestId('transaction-row').filter({ hasText: text });

async function reconciledAccount(api: import('./fixtures').Api) {
  const account = await api.createAccount('Spending', 100000);
  const coles = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -8000,
    payeeName: 'Coles',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -1450,
    payeeName: 'Corner cafe',
  });
  const snapshot = await api.call('GET', `/accounts/${account.id}/reconcile`);
  // The statement is $14.50 off what the register says, so reconciling needs an adjustment
  await api.call('POST', `/accounts/${account.id}/reconcile`, {
    transactionIds: snapshot.transactions.map((t: { id: string }) => t.id),
    statementBalance: 90550 - 1450,
    expectedBalance: snapshot.account.balance,
    revision: snapshot.revision,
    createAdjustment: true,
  });
  return { account, coles };
}

test('a reconciled transaction can still be categorised, but its amount stays locked', async ({
  page,
  api,
}) => {
  const { account, coles } = await reconciledAccount(api);
  await open(page, `/accounts/${account.id}`);
  await row(page, 'Coles').click();
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel).toContainText('amount, date and account are locked');
  await expect(panel.getByRole('textbox', { name: 'Date' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Uncategorized' }).click();
  await page.getByPlaceholder('Search categories...').fill('grocer');
  await page
    .getByRole('button', { name: /Groceries/ })
    .first()
    .click();
  const groceries = await api.category('Groceries');
  await expect
    .poll(async () =>
      (await api.transactions(`?account_id=${account.id}`)).find((t) => t.id === coles.id),
    )
    .toMatchObject({ categoryId: groceries.id, reconciled: 1, amount: -8000 });
  await panel.getByRole('textbox', { name: 'Notes' }).fill('weekly shop');
  await panel.getByRole('textbox', { name: 'Notes' }).blur();
  await expect
    .poll(async () =>
      (await api.transactions(`?account_id=${account.id}`)).find((t) => t.id === coles.id),
    )
    .toMatchObject({ notes: 'weekly shop', reconciled: 1 });
});

test('Unlock frees one reconciled transaction after a warning', async ({ page, api }) => {
  const { account, coles } = await reconciledAccount(api);
  await open(page, `/accounts/${account.id}`);
  await row(page, 'Coles').click();
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await panel.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText(/no longer match your statement/)).toBeVisible();
  await page.getByRole('button', { name: 'Unlock', exact: true }).last().click();
  await expect(panel.getByRole('textbox', { name: 'Date' })).toBeEnabled();
  const rows = await api.transactions(`?account_id=${account.id}`);
  expect(rows.find((t) => t.id === coles.id)?.reconciled).toBe(0);
  expect(rows.filter((t) => t.reconciled === 1).length).toBe(2); // cafe + adjustment stay locked
});

test('Undo last reconciliation unlocks its rows and removes the adjustment it made', async ({
  page,
  api,
}) => {
  const { account } = await reconciledAccount(api);
  expect(
    (await api.transactions(`?account_id=${account.id}`)).every((t) => t.reconciled === 1),
  ).toBe(true);
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Undo last reconciliation' }).click();
  await expect(page.getByText(/removes its .* balance adjustment/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo reconciliation' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Reconciliation undone' })).toContainText(
    '2 transactions unlocked',
  );
  await expect(page.getByRole('button', { name: 'Undo last reconciliation' })).toHaveCount(0);
  const rows = await api.transactions(`?account_id=${account.id}`);
  expect(rows).toHaveLength(2);
  expect(rows.every((t) => t.reconciled === 0)).toBe(true);
  expect(await api.balance(account.id)).toBe(100000 - 8000 - 1450);
});
