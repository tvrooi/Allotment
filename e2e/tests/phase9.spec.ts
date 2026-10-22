import type { Page } from '@playwright/test';
import { test, expect, open, isoDay } from './fixtures';

// Phase 9 (docs/PHASE-9-DEVELOPMENT-PHASE.md): tags, review, hiding from reports and saved
// views, on mock data.

const row = (page: Page, payee: string) =>
  page.getByTestId('transaction-row').filter({ hasText: payee });

async function openDetails(page: Page, payee: string) {
  await row(page, payee).focus();
  await page.keyboard.press('Enter');
  return page.getByRole('complementary', { name: 'Transaction details' });
}

test('tags a transaction, filters by the tag and manages it in Settings', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -4_500,
    payeeName: 'Mock hotel',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -1_200,
    payeeName: 'Mock cafe',
  });

  await open(page, '/transactions');
  const panel = await openDetails(page, 'Mock hotel');
  await panel.getByRole('button', { name: 'Add tag' }).click();
  await panel.getByLabel('Find or create a tag').fill('Holiday');
  await panel.getByRole('button', { name: 'Create “Holiday”' }).click();
  await expect(panel.getByText('Holiday', { exact: true })).toBeVisible();
  await expect(row(page, 'Mock hotel').getByText('Holiday')).toBeVisible();

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Holiday' }).check();
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
  await expect(row(page, 'Mock cafe')).toHaveCount(0);

  await open(page, '/settings?tab=tags');
  await expect(page.getByRole('link', { name: '1 transaction' })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Holiday' }).click();
  await page.getByRole('menuitem', { name: 'Delete tag' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete tag' }).click();
  await expect(page.getByText('No tags yet.')).toBeVisible();
  expect(await api.transactions(`?account_id=${account.id}`)).toHaveLength(2);
});

test('hiding a transaction changes reports, not balances', async ({ page, api }) => {
  const account = await api.createAccount('Checking');
  const groceries = await api.category('Groceries');
  const income = await api.category('Paychecks');
  for (const tx of [
    { amount: 200_000, payeeName: 'Mock payroll', categoryId: income.id },
    { amount: -12_000, payeeName: 'Mock grocer', categoryId: groceries.id },
    { amount: -30_000, payeeName: 'Mock laptop', categoryId: groceries.id },
  ])
    await api.createTransaction({ accountId: account.id, date: isoDay(), ...tx });
  const balance = await api.balance(account.id);

  await open(page, '/cash-flow');
  await page.getByRole('button', { name: '1M', exact: true }).click();
  await expect(page.getByText('79.0%', { exact: true })).toBeVisible();

  await open(page, '/transactions');
  const panel = await openDetails(page, 'Mock laptop');
  await panel.getByRole('checkbox', { name: /Hide from reports/ }).check();
  await expect(
    row(page, 'Mock laptop').getByRole('img', { name: 'Hidden from reports' }),
  ).toBeVisible();

  await open(page, '/cash-flow');
  await page.getByRole('button', { name: '1M', exact: true }).click();
  await expect(page.getByText('94.0%', { exact: true })).toBeVisible();
  expect(await api.balance(account.id)).toBe(balance);
});

test('marks the selection reviewed after confirming, and undoes it', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100_000);
  for (const payeeName of ['Mock one', 'Mock two', 'Mock three'])
    await api.createTransaction({ accountId: account.id, date: isoDay(), amount: -100, payeeName });

  await open(page, '/transactions?range=this-month&reviewed=0');
  await expect(page.getByText('3 transactions', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark 3 reviewed' }).click();
  await expect(page.getByText('No transactions found')).toBeVisible();
  const rows = await api.transactions(`?account_id=${account.id}`);
  expect(rows.every((r: { reviewedAt: string | null }) => r.reviewedAt)).toBe(true);

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('3 transactions', { exact: true })).toBeVisible();
});

test('saves the current filters as a view and reopens it', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -12_000,
    payeeName: 'Mock grocer',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -500,
    payeeName: 'Mock kiosk',
  });

  await open(page, '/transactions?range=all&min_amount=10001');
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Big spends');
  await page.getByRole('dialog').getByRole('button', { name: 'Save view' }).click();

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByText('2 transactions', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Views' }).click();
  await page.getByRole('menuitem', { name: 'Big spends' }).click();
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
  await expect(row(page, 'Mock kiosk')).toHaveCount(0);
});
