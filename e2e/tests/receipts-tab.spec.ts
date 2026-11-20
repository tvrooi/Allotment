import { test, expect, open, isoDay, fillDate, categoryOption, setToggle } from './fixtures';

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
  await fillDate(dialog, 'Date', isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('58.00');
  await dialog.getByLabel('Tax', { exact: true }).fill('5.00');
  await dialog.getByLabel('Tip and fees').fill('3.00');
  for (const [i, [name, amount, category]] of (
    [
      ['Milk', '15.00', groceries],
      ['Bread', '15.00', groceries],
      ['Detergent', '20.00', home],
    ] as const
  ).entries()) {
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await dialog.getByLabel(`Item ${i + 1}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Item ${i + 1} amount`).fill(amount);
    // A category button opening the searchable picker, named `Item N category: <shown>`
    await dialog.getByRole('button', { name: new RegExp(`^Item ${i + 1} category: `) }).click();
    await categoryOption(dialog, category.name, { exact: true }).click();
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
  await fillDate(dialog, 'Date', isoDay());
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
  await fillDate(dialog, 'Date', isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('12.00');
  // Removing an item moves the next one up with its own description, amount and category
  for (const [i, [name, amount]] of (
    [
      ['Apples', '4.00'],
      ['Pears', '8.00'],
    ] as const
  ).entries()) {
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await dialog.getByLabel(`Item ${i + 1}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Item ${i + 1} amount`).fill(amount);
  }
  await dialog.getByRole('button', { name: /^Item 2 category: / }).click();
  await categoryOption(dialog, home.name, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove item 1' }).click();
  await expect(dialog.getByLabel('Item 1', { exact: true })).toHaveValue('Pears');
  await expect(dialog.getByLabel('Item 1 amount')).toHaveValue('$8');
  await expect(
    dialog.getByRole('button', { name: `Item 1 category: ${home.name}`, exact: true }),
  ).toHaveText(home.name);
  await expect(dialog.getByLabel('Item 2', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  // Not saved yet: Create transaction saves what was typed first
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  // The account is a Combobox over the open accounts: type to filter, then pick
  await dialog.getByRole('combobox', { name: 'Account' }).fill('Card');
  await page.getByRole('listbox').getByRole('option', { name: 'Card', exact: true }).click();
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
  // Shared Checkboxes: setToggle clicks the wrapping label, not React Aria's hidden input
  await setToggle(settings.getByLabel(/Autosplit by category/), false);
  await expect
    .poll(async () => (await api.call('GET', '/receipts/settings')).autoSplit)
    .toBe(false);
  await setToggle(settings.getByLabel(/Tag "Receipt"/), false);
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
  await fillDate(dialog, 'Date', isoDay());
  await dialog.getByLabel('Amount', { exact: true }).fill('30.00');
  for (const [i, [name, amount, category]] of (
    [
      ['Fruit', '10.00', groceries],
      ['Light globes', '20.00', home],
    ] as const
  ).entries()) {
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await dialog.getByLabel(`Item ${i + 1}`, { exact: true }).fill(name);
    await dialog.getByLabel(`Item ${i + 1} amount`).fill(amount);
    // A category button opening the searchable picker, named `Item N category: <shown>`
    await dialog.getByRole('button', { name: new RegExp(`^Item ${i + 1} category: `) }).click();
    await categoryOption(dialog, category.name, { exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('status')).toContainText('already has a category');
  expect((await api.transactions()).find((t) => t.id === shop.id)).toMatchObject({
    isParent: 0,
    categoryId: groceries.id,
  });
  // A claimed transaction is never split, and the reason shows after the save first
  await api.call('PUT', `/tax/claims/${shop.id}`, { label: 'D5' });
  await dialog.getByRole('button', { name: 'Split by items' }).click();
  await expect(dialog.getByRole('alert')).toContainText('claimed as a tax deduction');
  await api.call('DELETE', `/tax/claims/${shop.id}`);
  // Typed but not saved: the split uses what is on screen
  await dialog.getByLabel('Item 1 amount').clear();
  await dialog.getByLabel('Item 1 amount').fill('5.00');
  await dialog.getByLabel('Item 2 amount').clear();
  await dialog.getByLabel('Item 2 amount').fill('25.00');
  await dialog.getByRole('button', { name: 'Split by items' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Split into 2 categories.');
  const parent = (await api.transactions()).find((t) => t.id === shop.id);
  expect(
    (parent.children as { amount: number }[]).map((c) => c.amount).sort((a, b) => a - b),
  ).toEqual([-2_500, -500]);
});
