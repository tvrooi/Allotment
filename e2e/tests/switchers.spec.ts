import { test, expect, open, isoDay } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';
import { richUpHistory } from '../../server/src/test/upRichData';

// Someone leaving YNAB or a spreadsheet: their history and categories come with them, Up joins
// the same account from a cut-over date, and nothing is counted twice.

const mock = (mode: string) =>
  fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/${mode}`, { method: 'POST' });

const cell = (v: string) => (v.includes(',') ? `"${v}"` : v);
const csv = (rows: string[][]) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
const dmy = (iso: string) => iso.split('-').reverse().join('/');

/** A YNAB-style register: Date DD/MM/YYYY, Payee, "Group: Category", Memo, Outflow, Inflow */
function ynabStyleCsv(days = 30) {
  const rows: string[][] = [['Date', 'Payee', 'Category', 'Memo', 'Outflow', 'Inflow']];
  for (let i = 0; i < days; i++) {
    const date = dmy(isoDay(-100 + i));
    if (i % 10 === 0) rows.push([date, 'Employer Pty Ltd', '', 'salary', '', '$3,200.00']);
    else if (i % 3 === 0) rows.push([date, 'Landlord', 'Bills: Landlord Fees', '', '$100.00', '']);
    else if (i % 3 === 1)
      rows.push([date, 'Coles ' + i, 'Food & Dining: Groceries', '', '$20.50', '']);
    else rows.push([date, 'Mystery ' + i, '', '', '$5.00', '']);
  }
  return csv(rows);
}

async function importFile(page: import('@playwright/test').Page, body: string) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Transactions' });
  await dialog.getByLabel('Bank file').setInputFiles({
    name: 'register.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(body),
  });
  return dialog;
}

test('imports the categories in a YNAB-style CSV and shows what came in', async ({ page, api }) => {
  const account = await api.createAccount('Old CBA', 0);
  await open(page, `/accounts/${account.id}`);
  const dialog = await importFile(page, ynabStyleCsv());
  await expect(dialog.getByRole('combobox', { name: 'Column Category' })).toHaveValue('category');
  await dialog.getByRole('button', { name: 'Preview' }).click();

  // What the file's categories become, before anything is created
  await expect(dialog).toContainText('Your file has 2 categories');
  const groceries = dialog.getByRole('combobox', { name: 'Category for Food & Dining: Groceries' });
  const groceryId = (await api.category('Groceries')).id;
  await expect(groceries).toHaveValue(groceryId); // matched by name, ignoring the group
  const rent = dialog.getByRole('combobox', { name: 'Category for Bills: Landlord Fees' });
  await expect(rent).toHaveValue('__new');
  await expect(
    dialog.getByRole('combobox', { name: 'Group for Bills: Landlord Fees' }),
  ).toContainText('New group “Bills”');
  expect((await api.categoryGroups()).some((g) => g.name === 'Bills')).toBe(false);
  await dialog.getByRole('button', { name: 'Preview' }).click();

  await expect(dialog).toContainText('30 transactions found');
  await dialog.getByRole('button', { name: 'Import 30 Transactions' }).click();
  await expect(dialog).toContainText('30 imported');
  await dialog.getByRole('button', { name: 'Done' }).click();

  // The register jumps to the imported dates, not an empty "This Month"
  await expect(page.getByTestId('transaction-row').first()).toBeVisible();
  const txs = await api.transactions(`?account_id=${account.id}&from=2000-01-01`);
  expect(txs).toHaveLength(30);
  const groups = await api.categoryGroups();
  const bills = groups.find((g) => g.name === 'Bills')!;
  const rentCategory = bills.categories.find((c) => c.name === 'Landlord Fees')!;
  const byPayee = (p: string) => txs.filter((t) => t.payeeName?.startsWith(p));
  expect(byPayee('Landlord').length).toBeGreaterThan(5);
  expect(byPayee('Landlord').every((t) => t.categoryId === rentCategory.id)).toBe(true);
  expect(byPayee('Coles').every((t) => t.categoryId === groceryId)).toBe(true);
  expect(byPayee('Mystery').every((t) => !t.categoryId)).toBe(true);
  expect(byPayee('Employer').every((t) => !t.categoryId)).toBe(true);
});

test('a balance typed as "today" is still that balance after importing older history', async ({
  page,
  api,
}) => {
  await open(page, '/dashboard');
  await page.getByRole('button', { name: /Add accounts manually/ }).click();
  const add = page.getByRole('dialog', { name: 'Add Account' });
  await add.getByRole('textbox', { name: 'Account name' }).fill('Everyday');
  await add.getByRole('textbox', { name: 'Current Balance' }).fill('1500');
  await add.getByRole('button', { name: 'Add Account' }).click();
  await expect.poll(async () => (await api.accounts()).length).toBe(1);
  const [account] = await api.accounts();
  expect(account.balance).toBe(150_000);

  await page
    .getByRole('complementary')
    .getByRole('link', { name: 'Accounts', exact: true })
    .click();
  await page.getByRole('main').getByText('Everyday', { exact: true }).click();
  const dialog = await importFile(page, ynabStyleCsv());
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await dialog.getByRole('button', { name: 'Import 30 Transactions' }).click();
  await expect(dialog).toContainText('30 imported');
  await expect(dialog).toContainText("Starting balance adjusted so today's balance stays $1,500");
  await dialog.getByRole('button', { name: 'Done' }).click();
  expect(await api.balance(account.id)).toBe(150_000);
});

test('imports a YNAB register with several accounts, from the welcome page', async ({
  page,
  api,
}) => {
  await open(page, '/welcome');
  await expect(page.getByText('Coming from another app?')).toBeVisible();
  await expect(page.getByText('link Up from a cut-over date')).toBeVisible();
  await page.getByRole('button', { name: 'Import from YNAB' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import from YNAB' });
  const header =
    'Account,Flag,Date,Payee,Category Group/Category,Category Group,Category,Memo,Outflow,Inflow,Cleared\n';
  const d1 = dmy(isoDay(-40));
  const d2 = dmy(isoDay(-39));
  const file =
    header +
    `Everyday,,${d1},Coles,Food & Dining: Groceries,Food & Dining,Groceries,weekly,"$1,234.56",$0.00,Cleared\n` +
    `Everyday,,${d2},Employer,Inflow: Ready to Assign,Inflow,Ready to Assign,,$0.00,"$3,000.00",Cleared\n` +
    `Savings,,${d2},Interest,Income: Interest,Income,Interest,,$0.00,$1.25,Cleared\n` +
    `Everyday,,${d1},Shell,Transport: Fuel,Transport,Fuel,,$50.00,$0.00,Cleared\n` +
    `Everyday,,${d2},Transfer : Savings,,,,,$200.00,$0.00,Cleared\n` +
    `Savings,,${d2},Transfer : Everyday,,,,,$0.00,$200.00,Cleared\n`;
  await dialog
    .getByLabel('YNAB register file')
    .setInputFiles({ name: 'Register.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(dialog).toContainText('6 transactions in 2 accounts');
  await expect(dialog.getByRole('combobox', { name: 'Date format' })).toHaveValue('dmy');
  await expect(dialog.getByRole('textbox', { name: 'Name for Everyday' })).toHaveValue('Everyday');
  // "Fuel" is offered as the existing "Gas / Fuel", not as a near-duplicate
  await expect(dialog.getByRole('combobox', { name: 'Category for Transport: Fuel' })).toHaveValue(
    (await api.category('Gas / Fuel')).id,
  );
  await dialog.getByRole('button', { name: 'Import 6 transactions' }).click();
  await expect(dialog).toContainText('Everyday: 4 imported');
  await expect(dialog).toContainText('Savings: 2 imported');
  await expect(dialog).toContainText('1 transfer between these accounts linked.');

  const accounts = await api.accounts();
  expect(accounts.map((a) => a.name).sort()).toEqual(['Everyday', 'Savings']);
  const everyday = accounts.find((a) => a.name === 'Everyday')!;
  expect(everyday.balance).toBe(300_000 - 123_456 - 5_000 - 20_000);
  const txs = await api.transactions(`?account_id=${everyday.id}&from=2000-01-01`);
  const coles = txs.find((t) => t.payeeName === 'Coles')!;
  expect(coles.categoryId).toBe((await api.category('Groceries')).id);
  expect(coles.notes).toBe('weekly');
  // The two legs of the transfer are one transfer now
  const out = txs.find((t) => t.payeeName?.startsWith('Transfer'))!;
  expect(out.transferTransactionId).toBeTruthy();
  const savings = accounts.find((a) => a.name === 'Savings')!;
  const back = (await api.transactions(`?account_id=${savings.id}&from=2000-01-01`)).find(
    (t) => t.id === out.transferTransactionId,
  );
  expect(back?.transferTransactionId).toBe(out.id);
  expect(txs.find((t) => t.payeeName === 'Shell')!.categoryId).toBe(
    (await api.category('Gas / Fuel')).id,
  );
  // Income filed under Ready to Assign is not a category to budget
  expect(txs.find((t) => t.payeeName === 'Employer')!.categoryId).toBeNull();
});

test('links Up to an account that already has history, from a cut-over date', async ({
  page,
  api,
}) => {
  test.slow();
  await mock('rich');
  await freshUpWindow(page, api, 14);

  // The Up rows the file will overlap: a settled purchase well inside the 90 days of history
  const upSpending = richUpHistory().transactions.spending.filter(
    (t) => t.attributes.amount.valueInBaseUnits < 0 && !t.relationships.transferAccount.data,
  );
  const overlapTx =
    upSpending.find((t) => t.attributes.createdAt.slice(0, 10) === isoDay(-25)) ??
    upSpending.find((t) => t.attributes.createdAt.slice(0, 10) === isoDay(-26))!;
  expect(overlapTx).toBeTruthy();
  const overlapDate = overlapTx.attributes.createdAt.slice(0, 10);
  const overlapAmount = overlapTx.attributes.amount.valueInBaseUnits;

  // Morgan's spreadsheet: Jul to just past the cut-over she'll choose
  const old = await api.createAccount('Old CBA', 0, 'checking', { currency: 'AUD' });
  const rows = [];
  for (let i = 0; i < 12; i++)
    rows.push({
      date: isoDay(-120 + i * 7),
      amount: -1_000 - i,
      payeeName: 'Old payee ' + i,
      importedId: 'csv-' + i,
    });
  rows.push({
    date: overlapDate,
    amount: overlapAmount,
    payeeName: 'Same purchase',
    importedId: 'csv-dup',
  });
  await api.call('POST', '/transactions/import/confirm', { accountId: old.id, rows });
  const newest = rows
    .map((r) => r.date)
    .sort()
    .at(-1)!;
  const before = JSON.stringify(
    (await api.transactions(`?account_id=${old.id}&from=2000-01-01`)).sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  );
  const cutover = isoDay(-30);

  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Up', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Up' });
  await dialog.getByLabel('Up personal access token').fill(UP_TEST_TOKEN);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await dialog.getByLabel('Set up Up Everyday').selectOption('link');
  await dialog.getByLabel('Link Up Everyday to account').selectOption(old.id);
  // Defaults to the day after the newest existing transaction, and says what that means
  const next = new Date(newest + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  await expect(dialog.getByLabel('Cut-over date for Up Everyday')).toHaveValue(
    next.toISOString().slice(0, 10),
  );
  await expect(dialog).toContainText('stays as it is');
  await expect(dialog).toContainText('onwards are imported');
  await dialog.getByLabel('Cut-over date for Up Everyday').fill(cutover);
  await dialog.getByLabel('Set up Up Saver').selectOption('skip');
  await dialog.getByRole('button', { name: 'Save & Sync' }).click();
  await expect(dialog.getByText(/Imported \d+ transactions\./)).toBeVisible();
  await dialog.getByRole('button', { name: /^(Skip for now|Done)$/ }).click();

  // One account, with nothing from before the cut-over taken from Up
  expect((await api.accounts()).filter((a) => a.name.includes('Old CBA'))).toHaveLength(1);
  expect((await api.accounts()).filter((a) => a.name === 'Up Everyday')).toHaveLength(0);
  const all = await api.transactions(`?account_id=${old.id}&from=2000-01-01`);
  const fromUp = all.filter((t) => t.importedId?.startsWith('up:'));
  expect(fromUp.length).toBeGreaterThan(10);
  expect(fromUp.every((t) => t.date >= cutover)).toBe(true);
  // Every row that was there is exactly as it was
  const stillThere = all.filter((t) => !t.importedId?.startsWith('up:'));
  expect(JSON.stringify(stillThere.sort((a, b) => a.id.localeCompare(b.id)))).toBe(before);
  // The same purchase is in both, and flagged rather than merged
  const both = all.filter((t) => t.date === overlapDate && t.amount === overlapAmount);
  expect(both.length).toBeGreaterThanOrEqual(2);

  const review = page.getByRole('region', { name: 'Possible duplicates from your old history' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Same purchase');
  await page.screenshot({ path: test.info().outputPath('up-cutover-overlap.png') });
  // Nothing was adjusted: the difference (if any) is shown, and no opening-balance row exists
  const connection = await api.call<{ accounts: { cutoverDate: string | null }[] }>(
    'GET',
    '/up/connection',
  );
  expect(connection.accounts.find((a) => a.cutoverDate)!.cutoverDate).toBe(cutover);
  expect(all.some((t) => /opening balance/i.test(t.payeeName ?? ''))).toBe(false);

  // Deleting the older row asks first, naming it; cancelling changes nothing
  await review.getByRole('button', { name: 'Delete the older one' }).first().click();
  const sure = page.getByRole('dialog', { name: 'Delete the older transaction?' });
  await expect(sure).toContainText('Same purchase');
  await sure.getByRole('button', { name: 'Cancel' }).click();
  expect(
    (await api.transactions(`?account_id=${old.id}&from=2000-01-01`)).some(
      (t) => t.payeeName === 'Same purchase',
    ),
  ).toBe(true);
  await review.getByRole('button', { name: 'Delete the older one' }).first().click();
  await sure.getByRole('button', { name: 'Delete it' }).click();
  await expect(review).toBeHidden();
  const after = await api.transactions(`?account_id=${old.id}&from=2000-01-01`);
  expect(after.some((t) => t.payeeName === 'Same purchase')).toBe(false);
  expect(
    after.filter((t) => t.date === overlapDate && t.amount === overlapAmount).length,
  ).toBeGreaterThanOrEqual(1);
  // The difference at the cut-over is settled by an opening balance dated the day before it,
  // not by a reconcile adjustment dated today
  await page.getByRole('button', { name: /Add an opening balance dated/ }).click();
  const opening = page.getByRole('dialog', { name: 'Add an opening balance?' });
  await expect(opening).toContainText('not income or spending');
  await opening.getByRole('button', { name: 'Add opening balance' }).click();
  await expect(page.getByRole('button', { name: /Add an opening balance dated/ })).toBeHidden();
  const dayBefore = new Date(cutover + 'T00:00:00Z');
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const adjustments = (await api.transactions(`?account_id=${old.id}&from=2000-01-01`)).filter(
    (t) => t.isAdjustment,
  );
  expect(adjustments).toHaveLength(1);
  expect(adjustments[0]).toMatchObject({
    date: dayBefore.toISOString().slice(0, 10),
    categoryId: null,
  });
  // A second sync adds nothing
  const resync = await api.call<{ added: number }>('POST', '/up/sync');
  expect(resync.added).toBe(0);
  await api.call('DELETE', '/up/connection');
});

test('the recommended order works on a fresh budget: YNAB import, then link Up to the imported account', async ({
  page,
  api,
}) => {
  test.slow();
  await mock('rich');
  await freshUpWindow(page, api, 14);
  await open(page, '/welcome');
  await page.getByRole('button', { name: 'Import from YNAB' }).click();
  const ynab = page.getByRole('dialog', { name: 'Import from YNAB' });
  const header =
    'Account,Flag,Date,Payee,Category Group/Category,Category Group,Category,Memo,Outflow,Inflow,Cleared\n';
  const rows = [-60, -55, -50]
    .map(
      (d, i) =>
        `Everyday,,${dmy(isoDay(d))},Shop ${i},Food & Dining: Groceries,Food & Dining,Groceries,,$10.00,$0.00,Cleared\n`,
    )
    .join('');
  await ynab.getByLabel('YNAB register file').setInputFiles({
    name: 'Register.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(header + rows),
  });
  await ynab.getByRole('button', { name: 'Import 3 transactions' }).click();
  await expect(ynab).toContainText('Everyday: 3 imported');
  const [everyday] = await api.accounts();
  expect(everyday.name).toBe('Everyday');
  await ynab.getByRole('button', { name: 'View the account' }).click();

  // No currency step in between: AUD is the default and linking is available
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Up', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Up' });
  await dialog.getByLabel('Up personal access token').fill(UP_TEST_TOKEN);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  const link = dialog.getByLabel('Set up Up Everyday').locator('option[value="link"]');
  await expect(link).toBeEnabled();
  await dialog.getByLabel('Set up Up Everyday').selectOption('link');
  await dialog.getByLabel('Link Up Everyday to account').selectOption(everyday.id);
  await expect(dialog.getByLabel('Cut-over date for Up Everyday')).toBeVisible();
  await dialog.getByLabel('Set up Up Saver').selectOption('skip');
  await dialog.getByRole('button', { name: 'Save & Sync' }).click();
  await expect(dialog.getByText(/Imported \d+ transactions\./)).toBeVisible();
  expect((await api.accounts()).filter((a) => a.name.includes('Everyday'))).toHaveLength(1);
  await api.call('DELETE', '/up/connection');
});
