import { test, expect, open, isoDay, typeAmount } from './fixtures';

// Pay later (docs/PAYMENT-PLANS.md): an Afterpay purchase is recorded once, in what it was for,
// and the bank's Afterpay payments are linked to it only when confirmed. Mock bank rows only.

async function bankRow(
  api: { call: (m: string, p: string, d?: unknown) => Promise<unknown> },
  accountId: string,
  date: string,
  amount: number,
  importedId: string,
) {
  await api.call('POST', '/transactions/import/confirm', {
    accountId,
    rows: [{ date, amount, payeeName: 'AFTERPAY', importedId }],
  });
}

test('records an Afterpay purchase as Home Improvement and links its payments', async ({
  page,
  api,
}) => {
  const bank = await api.createAccount('Everyday', 100000);
  const home = await api.category('Home Improvement');
  await open(page, '/payment-plans');
  await page.getByRole('button', { name: 'Set up Afterpay' }).click();
  await expect(page.getByText('Your Afterpay account is ready')).toBeVisible();

  await page.getByRole('button', { name: 'Add a purchase' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a purchase' });
  await dialog.getByLabel('Where you bought it').fill('Bunnings');
  await dialog.getByLabel('What it was for').selectOption(home.id);
  await typeAmount(dialog.getByLabel('Price'), '200');
  await expect(dialog).toContainText('4 × $50 fortnightly');
  await dialog.getByRole('button', { name: 'Add purchase' }).click();
  await expect(dialog).toBeHidden();

  const plan = page.getByTestId('payment-plan').filter({ hasText: 'Bunnings' });
  await expect(plan).toContainText('Home Improvement');
  await expect(plan).toContainText('0 of 4 paid');
  await expect(plan).toContainText('$200');

  // The bank's first payment is suggested (here and on Review), and linked only when confirmed
  await bankRow(api, bank.id, isoDay(), -5000, 'e2e-afterpay-1');
  // Not the amount: never suggested
  await bankRow(api, bank.id, isoDay(), -4000, 'e2e-afterpay-unrelated');
  await open(page, '/review');
  const onReview = page.getByRole('region', { name: 'Payments to confirm' });
  await expect(onReview).toContainText('1 payment to confirm');
  await expect(onReview).toContainText('Afterpay payment → Bunnings, 1 of 4');
  await open(page, '/payment-plans');
  const matches = page.getByRole('region', { name: 'Payments to confirm' });
  await expect(matches).toContainText('Afterpay payment → Bunnings, 1 of 4');
  await matches.getByRole('button', { name: 'Confirm' }).click();
  await expect(matches).toBeHidden();
  await expect(plan).toContainText('1 of 4 paid');
  await expect(plan).toContainText('$150');
  await page.screenshot({ path: test.info().outputPath('payment-plans.png'), fullPage: true });

  const afterpay = (await api.accounts()).find((a) => a.name === 'Afterpay')!;
  expect(afterpay.balance).toBe(-15000);
  const rows = await api.transactions();
  const purchase = rows.find((t) => t.accountId === afterpay.id && t.amount === -20000);
  expect(purchase.categoryId).toBe(home.id);
  const payment = rows.find((t) => t.importedId === 'e2e-afterpay-1');
  expect(payment.transferTransactionId).toBeTruthy();
  expect(payment.categoryId).toBeNull();
});

test('records earlier Afterpay payments as the purchase they paid for', async ({ page, api }) => {
  const bank = await api.createAccount('Everyday', 100000);
  await api.call('POST', '/payment-plans/account', { provider: 'afterpay' });
  const ids = ['e2e-old-1', 'e2e-old-2', 'e2e-old-3', 'e2e-old-4'];
  for (const [i, id] of ids.entries()) await bankRow(api, bank.id, isoDay(-70 + i * 14), -2500, id);

  await open(page, '/payment-plans');
  await page.getByRole('button', { name: 'Earlier payments' }).first().click();
  const earlier = page.getByRole('dialog', { name: 'Earlier Afterpay payments' });
  await expect(earlier).toContainText('4 payments from');
  await expect(earlier).toContainText('about $100 in 4');
  await earlier.getByRole('button', { name: 'Record purchase' }).click();

  const record = page.getByRole('dialog', { name: 'Record an earlier purchase' });
  await expect(record).toContainText('Links 4 payments from Everyday');
  await record.getByLabel('Where you bought it').fill('Kmart');
  await record.getByRole('button', { name: 'Record purchase' }).click();
  await expect(record).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Earlier Afterpay payments' })).toContainText(
    'No unrecorded Afterpay payments',
  );
  await page.getByRole('button', { name: 'Done' }).click();

  const plan = page.getByTestId('payment-plan').filter({ hasText: 'Kmart' });
  await expect(plan).toContainText('Paid off');
  const rows = await api.transactions();
  for (const id of ids)
    expect(rows.find((t) => t.importedId === id).transferTransactionId).toBeTruthy();
});
