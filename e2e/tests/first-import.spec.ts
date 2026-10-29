import { test, expect, open, isoDay, type Api } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

// A new user's first Up import: mostly categorised by Up's own categories, the rest sorted a
// payee at a time, pay found and marked as income, and screens that say what they leave out.

const mock = (mode: string) =>
  fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/${mode}`, { method: 'POST' });

async function importRich(api: Api) {
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  await api.call('POST', '/up/sync');
}
type Summary = { share: number; categorisedIncome: number; uncategorisedIncomeCount: number };
const summary = (api: Api) => api.call<Summary>('GET', '/reports/uncategorised-summary');

test('the first Up import arrives categorised, and the rest is sorted a payee at a time', async ({
  page,
  api,
}) => {
  test.slow();
  await mock('rich');
  await freshUpWindow(page, api);
  await api.createAccount('Manual account');
  await open(page, '/settings?tab=connections');
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Up', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Up' });
  await dialog.getByLabel('Up personal access token').fill(UP_TEST_TOKEN);
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save & Sync' }).click();

  const sort = dialog.getByRole('region', { name: 'Sort your first import' });
  await expect(sort).toBeVisible();
  // Up's categories were used: under 15% of spending is left, and none of it is pay or transfers
  const before = await summary(api);
  expect(before.share).toBeLessThan(0.15);
  const groceries = (await api.transactions()).filter((t) => t.payeeName === 'Coles');
  expect(groceries.length).toBeGreaterThan(3);
  expect(groceries.every((t) => t.categoryId)).toBe(true);
  // A handful of payees, not one per transaction
  const rows = sort.getByRole('listitem');
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThanOrEqual(25);

  // Pay: found, offered, one tap, undoable
  const offer = sort.getByRole('group', { name: 'Pay detected' });
  await expect(offer).toContainText('ACME LOGISTICS PTY LTD SALARY every 14 days');
  expect(before.categorisedIncome).toBe(0);
  await offer.getByRole('button', { name: 'Mark as income' }).click();
  await expect(offer).toContainText(/is now (Pay|Paychecks)/);
  expect((await summary(api)).categorisedIncome).toBeGreaterThan(0);
  const payees = () =>
    api.call<{ id: string; name: string; defaultCategoryId: string | null }[]>('GET', '/payees');
  expect(
    (await payees()).find((p) => p.name === 'ACME LOGISTICS PTY LTD SALARY')!.defaultCategoryId,
  ).toBeTruthy();
  await offer.getByRole('button', { name: 'Undo' }).click();
  await expect(offer.getByRole('button', { name: 'Mark as income' })).toBeVisible();
  expect((await summary(api)).categorisedIncome).toBe(0);
  expect(
    (await payees()).find((p) => p.name === 'ACME LOGISTICS PTY LTD SALARY')!.defaultCategoryId,
  ).toBeNull();
  await offer.getByRole('button', { name: 'Mark as income' }).click();
  await expect(offer).toContainText(/is now/);

  // One pick sorts a payee's transactions and makes it the payee's default
  await sort
    .getByLabel('Category for ATM Withdrawal Westpac')
    .selectOption({ label: 'Miscellaneous' });
  await expect(sort.getByLabel('Category for ATM Withdrawal Westpac')).toHaveCount(0);
  const atm = (await api.transactions()).filter((t) => t.payeeName === 'ATM Withdrawal Westpac');
  expect(atm.length).toBeGreaterThan(0);
  expect(new Set(atm.map((t) => t.categoryId)).size).toBe(1);
  expect(atm[0].categoryId).toBeTruthy();
  const atmPayee = (await payees()).find((p) => p.name === 'ATM Withdrawal Westpac')!;
  expect(atmPayee.defaultCategoryId).toBe(atm[0].categoryId);
  await expect(sort.getByRole('status').filter({ hasText: 'Sorted 1 payee' })).toBeVisible();
  await sort.getByRole('button', { name: 'Undo' }).click();
  await expect(sort.getByLabel('Category for ATM Withdrawal Westpac')).toBeVisible();
  expect(
    (await api.transactions())
      .filter((t) => t.payeeName === 'ATM Withdrawal Westpac')
      .every((t) => !t.categoryId),
  ).toBe(true);
  expect(
    (await payees()).find((p) => p.name === 'ATM Withdrawal Westpac')!.defaultCategoryId,
  ).toBeNull();

  // Without "future", only the existing rows move
  await sort.getByLabel('Also apply to future transactions').uncheck();
  await sort.getByLabel('Category for Service NSW').selectOption({ label: 'Miscellaneous' });
  await expect(sort.getByLabel('Category for Service NSW')).toHaveCount(0);
  expect((await payees()).find((p) => p.name === 'Service NSW')!.defaultCategoryId).toBeNull();

  await sort.getByRole('button', { name: 'Skip for now' }).click();
  await expect(dialog).toBeHidden();
  await api.call('DELETE', '/up/connection');
});

test('pre-fills a payday plan from the detected pay, and marks a deposit as pay in place', async ({
  page,
  api,
}) => {
  test.slow();
  await mock('rich');
  await freshUpWindow(page, api, 6);
  await importRich(api);
  const salary = await api.call<{ latestDate: string; latestAmount: number; intervalDays: number }>(
    'GET',
    '/reports/salary',
  );
  expect(salary).toMatchObject({ intervalDays: 14, latestAmount: 320_000 });

  await open(page, '/budget');
  await page.getByRole('button', { name: 'Until next payday' }).click();
  await page.getByRole('button', { name: 'New payday plan' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Filled in from your pay' }),
  ).toBeVisible();
  await expect(page.getByLabel('Anchor payday')).toHaveValue(salary.latestDate);
  await expect(page.getByLabel('Expected take-home pay')).toHaveValue(/^3,?200(\.00)?$/);
  // Zero typed fields
  await page.getByRole('button', { name: 'Save payday plan' }).click();

  // No pay is marked as income yet: the recent deposits can be, right here
  const candidates = page.getByRole('group', { name: 'Recent deposits without a category' });
  await expect(candidates).toBeVisible();
  await candidates
    .getByRole('button', {
      name: `This is pay: ACME LOGISTICS PTY LTD SALARY on ${salary.latestDate}`,
    })
    .click();
  const deposit = page.getByRole('checkbox', { name: /ACME LOGISTICS PTY LTD SALARY/ });
  await expect(deposit).toBeChecked();
  await page.getByRole('button', { name: 'Preview funding' }).click();
  await expect(page.getByRole('region', { name: 'Funding preview' })).toBeVisible();
  await api.call('DELETE', '/up/connection');
});

test('forecast and reports say when uncategorised spending is left out', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 500000);
  const food = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -10000,
    categoryId: food.id,
    payeeName: 'Coles',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -40000,
    payeeName: 'Mystery payee',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 300000,
    payeeName: 'Employer',
  });

  await open(page, '/forecast');
  await page.getByRole('tab', { name: 'Cash runway' }).click();
  const forecastNote = page.getByRole('status', { name: 'Uncategorised spending' });
  await expect(forecastNote).toContainText('$400');
  await expect(forecastNote).toContainText('so this leaves it out');
  await forecastNote.getByRole('link', { name: 'Sort it' }).click();
  await expect(page).toHaveURL(/uncategorized=1/);
  await expect(page.getByText('Mystery payee').first()).toBeVisible();

  await open(page, '/reports');
  await expect(page.getByRole('status', { name: 'Uncategorised spending' })).toContainText('$400');
  // No categorised income: no "Income $0" or green expenses, a pointer to sort instead
  await expect(page.getByText('These totals need categories')).toBeVisible();
  await expect(page.getByText('Total Income', { exact: true })).toHaveCount(0);

  // Once the pay has a category, the totals come back
  const pay = await api.category('Paychecks');
  const employer = (await api.transactions()).find((t) => t.payeeName === 'Employer');
  await api.call('PUT', `/transactions/${employer.id}`, { categoryId: pay.id });
  // The change was made behind the page's back, so load it afresh
  await page.reload();
  await expect(page.getByText('Total Income', { exact: true })).toBeVisible();
  await expect(page.getByText('These totals need categories')).toHaveCount(0);
});

test('stays quiet when almost everything has a category', async ({ page, api }) => {
  const account = await api.createAccount('Everyday', 500000);
  const food = await api.category('Groceries');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -50000,
    categoryId: food.id,
    payeeName: 'Coles',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -1000,
    payeeName: 'Small thing',
  });
  await open(page, '/forecast');
  await page.getByRole('tab', { name: 'Cash runway' }).click();
  await expect(page.getByText('Cash today', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Uncategorised spending' })).toHaveCount(0);
});
