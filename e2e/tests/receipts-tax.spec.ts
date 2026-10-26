import { test, expect, open, isoDay } from './fixtures';

// Receipts and tax deductions (docs/RECEIPTS-AND-TAX.md). A made-up file and mock data only.

/** A tiny made-up PDF: the server checks its first bytes, not its name */
const receipt = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n% a made-up receipt for tests\n'),
});

test('a receipt is attached, claimed and listed for tax time; the inbox matches another', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Card', 0, 'credit');
  await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -4_999,
    payeeName: 'Officeworks',
  });
  const coffee = await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -650,
    payeeName: 'Cafe',
  });

  await open(page, `/accounts/${card.id}`);
  await page.getByTestId('transaction-row').filter({ hasText: 'Officeworks' }).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel.getByRole('region', { name: 'Receipts' })).toBeVisible();
  await panel.getByLabel('Add a receipt: choose files').setInputFiles(receipt('officeworks.pdf'));
  await expect(panel.getByText('officeworks.pdf')).toBeVisible();

  await panel.getByLabel('Claim as a tax deduction').check();
  await expect(panel.getByLabel('Tax return label')).toHaveValue('D5');
  await panel.getByLabel('Work use percent').fill('50');
  await panel.getByLabel('Work use percent').blur();
  await expect(panel.getByText(/^Claim \$25(\.00)?$/)).toBeVisible();

  await open(page, '/tax');
  await expect(page.getByRole('heading', { name: 'Tax time' })).toBeVisible();
  const claims = page.getByRole('region', { name: 'Claims' });
  await expect(claims).toContainText('Officeworks');
  await expect(claims).toContainText('50%');
  await expect(claims).toContainText('officeworks.pdf');
  await expect(page.getByRole('region', { name: 'Totals by label' })).toContainText(
    'Other work-related expenses',
  );

  // The inbox: a receipt kept before its transaction is matched
  await page.getByRole('tab', { name: 'Receipt inbox' }).click();
  await page
    .getByLabel('Add receipts to the inbox: choose files')
    .setInputFiles(receipt('cafe.pdf'));
  const item = page.getByRole('listitem', { name: 'Receipt cafe.pdf' });
  await item.getByLabel('Receipt date').fill(isoDay());
  await item.getByLabel('Receipt total').fill('6.50');
  await item.getByLabel('Receipt total').blur();
  // Same amount and day: matched as soon as its details are saved, so it leaves the inbox
  await expect(page.getByText('The inbox is empty.')).toBeVisible();
  const attached = await api.call('GET', `/receipts?transactionId=${coffee.id}`);
  expect(attached).toHaveLength(1);
});
