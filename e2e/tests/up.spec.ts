import { test, expect, open } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

test('connects Up, imports settled history, resyncs and disconnects', async ({ page, api }) => {
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
  // Banks are intentionally retained by backup restore, so clear this connection explicitly.
  await freshUpWindow(page, api, 8);
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
  // Two payees have no category yet, so the first-import step offers to sort them (or skip)
  await expect(dialog.getByRole('region', { name: 'Sort your first import' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Skip for now' }).click();
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
  await freshUpWindow(page, api, 4);
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

test('sets background sync, reviews imports, and expands daily round-up details without altering the ledger', async ({
  page,
  api,
}) => {
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/round-ups-current`, { method: 'POST' });
  // Earlier Up tests (here or in first-import.spec.ts) share the bank write limit
  await freshUpWindow(page, api, 8);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  await api.call('POST', '/up/sync');
  const before = await api.transactions();
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await expect(page.getByLabel('Background sync')).toHaveValue('0');
  await page.getByLabel('Background sync').selectOption('15');
  await expect(page.getByText('Next background attempt:', { exact: false })).toBeVisible();
  expect(
    ((await api.call('GET', '/up/connection')) as { pollIntervalMinutes: number })
      .pollIntervalMinutes,
  ).toBe(15);
  const review = page.getByRole('region', { name: 'Up review', exact: true });
  // The first sync is the starting history, not changes to review
  await expect(review.getByRole('heading')).toHaveText('Needs review (0)');
  await expect(review.getByText('Nothing needs review.')).toBeVisible();
  const rounds = page.getByRole('region', { name: 'Daily Up round-ups', exact: true });
  await rounds.getByText('A$2.40 reported', { exact: false }).click();
  await expect(rounds.getByText('Includes A$2 in boosts.')).toBeVisible();
  await expect(
    rounds.getByText('purchase · purchase -A$17.60 · round-up A$2.40', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('up-review-desktop.png') });
  expect(await api.transactions()).toEqual(before);
  await page.getByLabel('Background sync').selectOption('0');
  await expect(page.getByText('Next background attempt:', { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await rounds.scrollIntoViewIfNeeded();
  await rounds.getByText('A$2.40 reported', { exact: false }).click();
  await expect(rounds.getByText('Includes A$2 in boosts.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: test.info().outputPath('up-review-phone.png') });
  await api.call('DELETE', '/up/connection');
});

test('adds balance-proven round-up debits only after an explicit choice', async ({ page, api }) => {
  test.slow();
  const mode = (name: string) =>
    fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/${name}`, { method: 'POST' });
  await mode('implicit-round-ups-start');
  await freshUpWindow(page, api, 8);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [{ upAccountId: 'spending', action: 'create' }],
  });
  await api.call('POST', '/up/sync');
  await mode('implicit-round-ups');
  await api.call('POST', '/up/sync');
  expect(await api.transactions()).toHaveLength(2);
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  const check = page.getByRole('region', { name: 'Round-up accounting check', exact: true });
  await expect(check).toContainText('higher than Up by exactly the round-ups');
  await expect(check).toContainText('Difference -A$2.40');
  await check.getByRole('button', { name: 'Add 1 round-up debit (-A$2.40)' }).click();
  await expect(check).toContainText('The register matches Up’s settled balance.');
  await expect(check.getByRole('button', { name: 'Stop adding round-up debits' })).toBeVisible();
  const rows = await api.transactions();
  expect(rows).toHaveLength(3);
  expect(rows.find((t) => t.payeeName === 'Up round-up')).toMatchObject({ amount: -240 });
  await api.call('POST', '/up/sync');
  expect(await api.transactions()).toHaveLength(3);
  await api.call('DELETE', '/up/connection');
});
