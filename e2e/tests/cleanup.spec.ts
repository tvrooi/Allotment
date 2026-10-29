import { test, expect, open, isoDay } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

// Persona E: a CSV import left a 30-row duplicate account to clean up.

async function duplicateAccount(api: import('./fixtures').Api, keepReconciled = false) {
  const account = await api.createAccount('Everyday (CSV)', 150_000);
  const ids: string[] = [];
  for (let i = 0; i < 30; i++) {
    const tx = await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -1_000 - i,
      payeeName: `Shop ${i}`,
    });
    ids.push(tx.id);
  }
  if (keepReconciled)
    await api.call('PUT', `/accounts/${account.id}/reconcile`, { transactionIds: [ids[0]] });
  return account;
}

test('Delete 30 removes the list after typing delete, keeping reconciled rows', async ({
  page,
  api,
}) => {
  const account = await duplicateAccount(api, true);
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Delete 30' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete 29 transactions' });
  await expect(dialog).toContainText('Everyday (CSV)');
  await expect(dialog).toContainText('1 reconciled (unlock them to delete)');
  // Nothing happens until the word is typed
  const confirm = dialog.getByRole('button', { name: 'Delete 29' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Type delete to confirm').fill('delete');
  await confirm.click();
  const finished = page.getByRole('dialog', { name: 'Deleted' });
  await expect(finished.getByRole('status')).toContainText('Deleted 29 transactions.');
  await expect(finished.getByRole('status')).toContainText('1 reconciled transaction was kept');
  await finished.getByRole('button', { name: 'Done' }).click();
  const left = await api.transactions(`?account_id=${account.id}`);
  expect(left).toHaveLength(1);
  expect(left[0].reconciled).toBe(1);
});

test('an account and its transactions are deleted in a few clicks by typing its name', async ({
  page,
  api,
}) => {
  const account = await duplicateAccount(api);
  await api.createAccount('Keeper', 1_000);
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Delete…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account and its transactions' });
  await expect(dialog).toContainText('30 transactions');
  const confirm = dialog.getByRole('button', { name: 'Delete account' });
  await dialog.getByLabel('Type the account name to confirm').fill('Everyday');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Type the account name to confirm').fill('Everyday (CSV)');
  await confirm.click();
  await expect(page).toHaveURL(/\/accounts$/);
  const accounts = await api.accounts();
  expect(accounts.map((a) => a.name)).toEqual(['Keeper']);
  expect(await api.transactions()).toHaveLength(0);
});

test('an account linked to Up cannot be deleted, and says how to unlink it', async ({
  page,
  api,
}) => {
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
  await freshUpWindow(page, api, 6);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  const bank = (await api.accounts()).find((a: any) => a.bankLinked)!;
  await open(page, `/accounts/${bank.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Delete…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account and its transactions' });
  await expect(dialog.getByRole('alert')).toContainText('is linked to Up. Unlink it first');
  await expect(dialog.getByRole('alert')).toContainText('Settings → Connections');
  await expect(dialog.getByRole('button', { name: 'Delete account' })).toBeDisabled();
  expect((await api.accounts()).some((a) => a.id === bank.id)).toBe(true);
  await api.call('DELETE', '/up/connection');
});
