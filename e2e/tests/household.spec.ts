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
  const event = page.getByRole('heading', { name: 'Record an event' }).locator('..');
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
