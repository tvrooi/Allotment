import { test, expect, open, isoDay } from './fixtures';

// The Receipts tab on Transactions, after Monarch's (docs/RECEIPTS-AND-TAX.md §6). Made-up
// files and mock data only.

const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.7\n% made-up receipt ${name}\n`),
});

test('receipts are matched automatically and split by category, found, or made into a transaction', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Card', 0, 'credit');
  const groceries = await api.category('Groceries');
  const home = await api.category('Home Maintenance');
  const shop = await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -5_800,
    payeeName: 'COLES 0123',
  });
  const cafe = await api.createTransaction({
    accountId: card.id,
    date: isoDay(-5),
    amount: -650,
    payeeName: 'SQ *CORNER',
  });

  await open(page, '/transactions');
  await page.getByRole('tab', { name: 'Receipts' }).click();
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  await expect(page.getByText('No receipts yet.')).toBeVisible();

  // Upload: the receipt opens to type what it says
  await page.getByLabel('Upload receipts: choose files').setInputFiles(pdf('coles.pdf'));
  const dialog = page.getByRole('dialog', { name: 'Receipt' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Match' })).toContainText('Unmatched');
  await dialog.getByLabel('Merchant').fill('Coles');
  await dialog.getByLabel('Date', { exact: true }).fill(isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('58.00');
  await dialog.getByLabel('Tax', { exact: true }).fill('5.00');
  await dialog.getByLabel('Tip and fees').fill('3.00');
  for (const [i, [name, amount, category]] of (
    [
      ['Milk', '15.00', groceries.id],
      ['Bread', '15.00', groceries.id],
      ['Detergent', '20.00', home.id],
    ] as const
  ).entries()) {
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await dialog.getByLabel(`Item ${i + 1}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Item ${i + 1} amount`).fill(amount);
    await dialog.getByLabel(`Item ${i + 1} category`).selectOption(category);
  }
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('status')).toContainText(
    'Matched: split into 2 categories, notes added, tagged Receipt.',
  );
  await expect(dialog.getByRole('region', { name: 'Matched transaction' })).toContainText(
    'matched automatically',
  );
  const parent = (await api.transactions()).find((t) => t.id === shop.id);
  expect(
    (parent.children as { amount: number }[]).map((p) => p.amount).sort((a, b) => a - b),
  ).toEqual([-3_500, -2_300]);
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByRole('button', { name: 'Receipt Coles' })).toContainText('Matched');

  // A different name and five days apart: found by hand
  await page.getByLabel('Upload receipts: choose files').setInputFiles(pdf('cafe.pdf'));
  await expect(dialog.getByText('cafe.pdf', { exact: true })).toBeVisible();
  await dialog.getByLabel('Merchant').fill('Corner Cafe');
  await dialog.getByLabel('Date', { exact: true }).fill(isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('6.50');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved.');
  await dialog.getByRole('button', { name: 'Find match' }).click();
  await dialog.getByLabel('Search transactions').fill('corner');
  await dialog
    .getByRole('listitem')
    .filter({ hasText: 'SQ *CORNER' })
    .getByRole('button', { name: 'Match' })
    .click();
  await expect(dialog.getByRole('region', { name: 'Matched transaction' })).toContainText(
    'matched by you',
  );
  expect(await api.call('GET', `/receipts?transactionId=${cafe.id}`)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Close' }).first().click();

  // Cash: no bank will send it, so add the transaction from the receipt
  await page.getByLabel('Upload receipts: choose files').setInputFiles(pdf('market.pdf'));
  await expect(dialog.getByText('market.pdf', { exact: true })).toBeVisible();
  await dialog.getByLabel('Merchant').fill('Farmers market');
  await dialog.getByLabel('Date', { exact: true }).fill(isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('12.00');
  // Not saved yet: Create transaction saves what was typed first
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await dialog.getByLabel('Account').selectOption(card.id);
  await dialog.getByRole('button', { name: 'Create transaction' }).click();
  await expect(dialog.getByRole('region', { name: 'Matched transaction' })).toContainText(
    'made from this receipt',
  );
  const made = (await api.transactions()).find((t) => t.payeeName === 'Farmers market');
  expect(made).toMatchObject({ amount: -1_200, date: isoDay() });
  await dialog.getByRole('button', { name: 'Close' }).first().click();

  await page.getByRole('button', { name: 'Unmatched', exact: true }).click();
  await expect(page.getByText('No unmatched receipts.')).toBeVisible();
});

test('receipt settings turn autosplit, notes and the tag off', async ({ page, api }) => {
  await api.createAccount('Card', 0, 'credit');
  await open(page, '/transactions?view=receipts');
  await page.getByRole('button', { name: 'Receipt settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Receipt settings' });
  await settings.getByLabel(/Autosplit by category/).uncheck();
  await expect
    .poll(async () => (await api.call('GET', '/receipts/settings')).autoSplit)
    .toBe(false);
  await settings.getByLabel(/Tag "Receipt"/).uncheck();
  await expect.poll(async () => (await api.call('GET', '/receipts/settings')).addTag).toBe(false);
});

test('a categorised transaction is split only when asked, with Split by items', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Card', 0, 'credit');
  const groceries = await api.category('Groceries');
  const home = await api.category('Home Maintenance');
  const shop = await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -3_000,
    payeeName: 'Woolworths',
    categoryId: groceries.id,
  });
  await open(page, '/transactions?view=receipts');
  await page.getByLabel('Upload receipts: choose files').setInputFiles(pdf('woolies.pdf'));
  const dialog = page.getByRole('dialog', { name: 'Receipt' });
  await expect(dialog.getByText('woolies.pdf', { exact: true })).toBeVisible();
  await dialog.getByLabel('Merchant').fill('Woolworths');
  await dialog.getByLabel('Date', { exact: true }).fill(isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('30.00');
  for (const [i, [name, amount, category]] of (
    [
      ['Fruit', '10.00', groceries.id],
      ['Light globes', '20.00', home.id],
    ] as const
  ).entries()) {
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await dialog.getByLabel(`Item ${i + 1}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Item ${i + 1} amount`).fill(amount);
    await dialog.getByLabel(`Item ${i + 1} category`).selectOption(category);
  }
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('status')).toContainText('already has a category');
  expect((await api.transactions()).find((t) => t.id === shop.id)).toMatchObject({
    isParent: 0,
    categoryId: groceries.id,
  });
  await dialog.getByRole('button', { name: 'Split by items' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Split into 2 categories.');
  const parent = (await api.transactions()).find((t) => t.id === shop.id);
  expect(
    (parent.children as { amount: number }[]).map((c) => c.amount).sort((a, b) => a - b),
  ).toEqual([-2_000, -1_000]);
});
