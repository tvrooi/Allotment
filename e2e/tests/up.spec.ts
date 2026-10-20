import { test, expect, open } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';

test('connects Up, imports settled history, resyncs and disconnects', async ({ page, api }) => {
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
  // Banks are intentionally retained by backup restore, so clear this connection explicitly.
  await api.call('DELETE', '/up/connection');
  await api.createAccount('Manual account');
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Up', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Up' });
  await dialog.screenshot({ path: test.info().outputPath('up-connect.png') });
  await dialog.getByLabel('Up personal access token').fill(UP_TEST_TOKEN);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dialog.getByLabel('Set up Up Everyday')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save & Sync' }).click();
  await expect(dialog.getByText('Imported 3 transactions.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  const accounts = await api.accounts();
  const everyday = accounts.find((a) => a.name === 'Up Everyday')!;
  expect(everyday.balance).toBe(9_000); // Available 8500 + held 500
  expect((await api.transactions()).filter((t) => t.accountId === everyday.id)).toHaveLength(2);
  await page.getByRole('button', { name: 'Sync Now', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Imported 0 new transactions.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reconnect / choose accounts' }).click();
  await dialog.getByLabel('Up personal access token').fill(UP_TEST_TOKEN);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dialog.getByLabel('Set up Up Everyday')).toHaveValue('link');
  await expect(dialog.getByLabel('Link Up Everyday to account')).toHaveValue(everyday.id);
  await dialog.getByRole('button', { name: 'Save & Sync' }).click();
  await expect(dialog.getByText('Imported 0 transactions.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  const connection = await api.call('GET', '/up/connection');
  expect(JSON.stringify(connection)).not.toContain(UP_TEST_TOKEN);
  await page.getByRole('button', { name: 'Disconnect Up', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Disconnect Up' });
  await confirm.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect Up', exact: true })).toBeVisible();
  expect((await api.transactions()).filter((t) => t.accountId === everyday.id)).toHaveLength(2);
});

test('shows an invalid Up token without saving a connection', async ({ page, api }) => {
  test
    .info()
    .annotations.push({ type: 'allow-page-errors', description: 'Expected rejected credentials' });
  await api.call('DELETE', '/up/connection');
  await api.createAccount('Manual account');
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Up', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Up' });
  await dialog.getByLabel('Up personal access token').fill('invalid-token');
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Up did not accept your token');
  expect(await api.call('GET', '/up/connection')).toBeNull();
});
