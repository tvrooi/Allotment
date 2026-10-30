import { test, expect, open } from './fixtures';

test('records shared expenses, exports personal scope and keeps the bank debit intact', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('My bank', 20000);
  const payment = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -12000,
    payeeName: 'Dinner',
  });
  await open(page, '/household');
  await page.getByLabel('Name', { exact: true }).fill('Home');
  await page.getByLabel('People, one per line; put yourself first').fill('Me\nAlex');
  await page.getByRole('button', { name: 'Create household', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'People & balances' })).toBeVisible();
  await page.getByRole('button', { name: 'Expense, advance or repayment' }).click();
  const event = page.getByRole('heading', { name: 'Record something else' }).locator('../..');
  await event.getByLabel('Description', { exact: true }).fill('Shared dinner');
  await event.getByLabel('Date', { exact: true }).fill('2026-10-21');
  await event.getByLabel('Amount (AUD)').fill('120.00');
  await event.getByLabel('Paid by').selectOption({ label: 'Me' });
  await event.getByLabel('Existing bank payment (optional)').selectOption(payment.id);
  await event.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByRole('heading', { name: /My expense shares:.*60/ })).toBeVisible();
  await page.getByLabel('Report scope').selectOption('household');
  await expect(page.getByRole('heading', { name: /Household spending:.*120/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Report scope')).toHaveValue('household');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this statement' }).click();
  expect((await download).suggestedFilename()).toBe('household-household-statement.json');
  expect((await api.transactions()).find((t) => t.id === payment.id).amount).toBe(-12000);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: test.info().outputPath('household.png'), fullPage: true });
});

test('prepaid pool expenses do not create a second reimbursement claim', async ({ page, api }) => {
  const account = await api.createAccount('Joint', 0, 'checking', { currency: 'AUD' });
  const group = await api.call('POST', '/households', {
    name: 'Household',
    currency: 'AUD',
    accountId: account.id,
    people: ['Me', 'Alex'],
    selfIndex: 0,
  });
  for (const person of group.people)
    await api.call('POST', `/households/${group.group.id}/events`, {
      kind: 'contribution',
      date: '2026-10-21',
      description: 'Rent advance',
      amount: 6000,
      payerId: person.id,
    });
  const payment = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -12000,
    payeeName: 'Rent',
  });
  await api.call('POST', `/households/${group.group.id}/events`, {
    kind: 'expense',
    date: '2026-10-21',
    description: 'Rent',
    amount: 12000,
    transactionId: payment.id,
    shares: group.people.map((p: any) => ({ personId: p.id, value: 1 })),
  });
  const ledger = await api.call('GET', `/households/${group.group.id}`);
  expect(Object.values(ledger.balances)).toEqual([0, 0]);
  await open(page, '/household');
  await expect(page.getByRole('heading', { name: 'People & balances' })).toBeVisible();
  await expect(page.getByText(/Received pool funding remaining:/)).toContainText('$0');
});

test('shares a payment with the household in one step, with the default split', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 20000);
  const payment = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -9000,
    payeeName: 'Groceries run',
  });
  const group = await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno', 'Zephyr'],
    selfIndex: 0,
  });
  await open(page, '/household');
  const sharing = page.getByRole('region', { name: 'Sharing' });
  await sharing.getByLabel('Split').selectOption('percentage');
  await sharing.getByLabel("Me's percentage").fill('40');
  await sharing.getByLabel("Juno's percentage").fill('30');
  await sharing.getByLabel("Zephyr's percentage").fill('30');
  await sharing.getByRole('button', { name: 'Save split' }).click();
  await expect(sharing).toContainText('Now Me 40%, Juno 30%, Zephyr 30%');

  await open(page, `/accounts/${account.id}`);
  await page.getByText('Groceries run').first().click();
  await page.getByRole('button', { name: 'Share with household' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with household' });
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Shared 1.');
  const state = await api.call('GET', `/households/${group.group.id}`);
  const event = state.events.find((e: { transactionId: string }) => e.transactionId === payment.id);
  expect(event.shares.map((s: { amount: number }) => s.amount)).toEqual([3600, 2700, 2700]);
});

test('picks payments in the register and shares just those, split equally', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday', 50000);
  const dinner = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-20',
    amount: -6001,
    payeeName: 'Dinner for two',
  });
  const solo = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-21',
    amount: -1500,
    payeeName: 'Solo coffee',
  });
  const fuel = await api.createTransaction({
    accountId: account.id,
    date: '2026-10-22',
    amount: -8000,
    payeeName: 'Road trip fuel',
  });
  const group = await api.call('POST', '/households', {
    name: 'King-Grey',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Edward'],
    selfIndex: 0,
  });

  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Pick to share' }).click();
  const bar = page.getByRole('region', { name: 'Picked payments' });
  await page.getByLabel(/^Pick Dinner for two/).check();
  await page.getByLabel(/^Pick Road trip fuel/).check();
  await expect(bar).toContainText('2 picked');
  await bar.getByRole('button', { name: 'Share 2 picked with household' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share with household' });
  await expect(dialog).toContainText('split equally');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Shared 2.');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(bar).toContainText('0 picked');

  const state = await api.call('GET', `/households/${group.group.id}`);
  const shared = state.events.map((e: { transactionId: string }) => e.transactionId).sort();
  expect(shared).toEqual([dinner.id, fuel.id].sort());
  expect(shared).not.toContain(solo.id);
  const dinnerEvent = state.events.find(
    (e: { transactionId: string }) => e.transactionId === dinner.id,
  );
  // Equal split, largest remainder: the odd cent goes to the first person
  expect(dinnerEvent.shares.map((s: { amount: number }) => s.amount)).toEqual([3001, 3000]);
});

test('lists recurring bills shared with housemates, with shares and one-click sharing', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Up Spending', 100000);
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const bills = [
    ['Electricity (OVO)', 'OVO Energy', -18450],
    ['Internet (Superloop)', 'Superloop', -8999],
  ] as const;
  for (const [name, payeeName, amount] of bills) {
    const paid = await api.createTransaction({
      accountId: account.id,
      date: day(-5),
      amount,
      payeeName,
    });
    await api.call('POST', '/schedules', {
      name,
      amount,
      recurrenceType: 'monthly',
      recurrenceRule: { type: 'monthly', interval: 1, anchorDay: 1 },
      startDate: day(-5),
      accountId: account.id,
      payeeId: paid.payeeId,
    });
  }
  await api.call('POST', '/households', {
    name: 'Home',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Sam', 'Jo'],
    selfIndex: 0,
  });
  await open(page, '/household');
  const recurring = page.getByRole('region', { name: 'Recurring bills' });
  await expect(recurring).toContainText('No recurring bills shared yet');
  // No household account: the pool figures stay out of the way
  await expect(page.getByText(/Received pool funding remaining:/)).toHaveCount(0);
  await recurring.getByRole('button', { name: 'Add recurring bills' }).click();
  await recurring.getByLabel('Electricity (OVO)').check();
  await recurring.getByLabel('Internet (Superloop)').check();
  await recurring.getByRole('button', { name: 'Share 2 with household' }).click();
  await expect(recurring.getByRole('listitem')).toHaveCount(2);
  const power = recurring.getByRole('listitem').filter({ hasText: 'Electricity (OVO)' });
  await expect(power).toContainText(/Me A?\$61\.50 · Sam A?\$61\.50 · Jo A?\$61\.50/);
  await expect(power).toContainText('1 payment not shared yet');
  await power.getByRole('button', { name: 'Share payment' }).click();
  await expect(power).toContainText('Last payment shared');
  await expect(page.getByRole('heading', { name: /My expense shares:.*61\.50/ })).toBeVisible();
  await expect(page.getByText(/^owes A?\$61\.50$/)).toHaveCount(2);
  await expect(page.getByText(/^is owed A?\$123$/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
