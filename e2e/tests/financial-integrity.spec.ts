import { test, expect, open, isoDay, typeAmount } from './fixtures';

test('reconciliation selects the full register and cannot adjust unchecked transactions', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Checking', 100000);
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 20000,
    payeeName: 'Employer',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -5000,
    payeeName: 'Shop',
  });
  await open(page, `/accounts/${account.id}/reconcile`);
  await expect(page.getByText('Current register balance').locator('..')).toContainText('$1,150');
  await typeAmount(page.getByRole('textbox', { name: 'Statement balance' }), '1130');
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();
  const all = page.getByRole('checkbox', { name: 'Select all current transactions', exact: true });
  await expect(all).toBeChecked();
  await all.uncheck();
  await expect(page.getByRole('button', { name: 'Create Adjustment' })).toBeDisabled();
  await expect(page.getByText(/Unchecked entries are not missing money/)).toBeVisible();
  await all.check();
  await expect(page.getByText(/Adds a -\$20 balance correction/)).toBeVisible();
  await page.getByRole('button', { name: 'Create Adjustment' }).click();
  await expect.poll(() => api.balance(account.id)).toBe(113000);
  const rows = await api.transactions(`?account_id=${account.id}`);
  expect(rows.find((t) => t.notes === 'Reconciliation adjustment')).toMatchObject({
    amount: -2000,
    isAdjustment: 1,
    reconciled: 1,
    categoryId: null,
  });
  expect(rows.find((t) => t.payeeName === 'Employer')?.amount).toBe(20000);
  await page.screenshot({ path: test.info().outputPath('reconciled-register.png') });
});

test('a concurrent transaction stops a stale reconciliation without creating an adjustment', async ({
  page,
  api,
}) => {
  test.info().annotations.push({
    type: 'allow-page-errors',
    description: 'Expected stale reconciliation refusal',
  });
  const account = await api.createAccount('Checking', 100000);
  await open(page, `/accounts/${account.id}/reconcile`);
  await typeAmount(page.getByRole('textbox', { name: 'Statement balance' }), '990');
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -500,
    payeeName: 'New bank debit',
  });
  await page.getByRole('button', { name: 'Create Adjustment' }).click();
  await expect(page.getByRole('alert')).toContainText('Your account changed');
  expect(await api.balance(account.id)).toBe(99500);
  expect((await api.transactions(`?account_id=${account.id}`)).some((t) => t.isAdjustment)).toBe(
    false,
  );
});

test('negative bank balances remain negative when reconciling', async ({ page, api }) => {
  const account = await api.createAccount('Overdraft', -10000);
  await open(page, `/accounts/${account.id}/reconcile`);
  await typeAmount(page.getByRole('textbox', { name: 'Statement balance' }), '-110');
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();
  await expect(page.getByText('Statement Balance').locator('..')).toContainText('-$110');
  await page.getByRole('button', { name: 'Create Adjustment' }).click();
  await expect.poll(() => api.balance(account.id)).toBe(-11000);
});

test('nonzero accounts cannot be hidden by closing', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 100000);
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Account' });
  await expect(dialog.getByRole('button', { name: 'Close Account' })).toBeDisabled();
  await expect(dialog.getByText(/Reconcile this account to zero before closing/)).toBeVisible();
});

test('legacy closed cash blocks new funding and can be explicitly reconciled to zero', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 100000);
  const closed = await api.createAccount('Old saver', 0, 'savings');
  await api.call('DELETE', `/accounts/${closed.id}`);
  // Simulate a legacy residual without hiding a new nonzero account through the guarded route.
  await api.call('POST', '/transactions', {
    accountId: closed.id,
    date: isoDay(),
    amount: 2500,
    adjustment: true,
    notes: 'Legacy residual fixture',
  });
  await open(page, '/budget');
  await expect(page.getByRole('status', { name: 'Ready to assign' })).toContainText(
    'Check balances',
  );
  await expect(page.getByRole('alert')).toContainText('Old saver');
  await page.screenshot({ path: test.info().outputPath('unverified-closed-balance.png') });
  const summary = await api.call('GET', `/budget/${isoDay().slice(0, 7)}/summary`);
  expect(summary).toMatchObject({
    resources: 102500,
    available: 0,
    accountIssues: [{ reason: 'closed-balance' }],
  });
  const food = await api.category('Groceries');
  const result = await api.request.put(`/api/budget/${isoDay().slice(0, 7)}/${food.id}`, {
    data: { budgeted: 1000 },
  });
  expect(result.status()).toBe(409);
  await open(page, '/settings?tab=accounts');
  await page
    .getByRole('region', { name: 'Closed accounts' })
    .getByRole('link', { name: 'Reconcile to zero' })
    .click();
  await page.getByRole('button', { name: 'Start Reconciliation' }).click();
  await page.getByRole('button', { name: 'Create Adjustment' }).click();
  await expect(page).toHaveURL(/settings\?tab=accounts/);
  await expect(
    page
      .getByRole('region', { name: 'Closed accounts' })
      .getByRole('link', { name: 'Reconcile to zero' }),
  ).toHaveCount(0);
  await open(page, '/budget');
  await expect(page.getByRole('status', { name: 'Ready to assign' })).toContainText('$1,000');
  expect((await api.call('GET', `/budget/${isoDay().slice(0, 7)}/summary`)).accountIssues).toEqual(
    [],
  );
  await page.screenshot({ path: test.info().outputPath('closed-balance-resolved.png') });
});
