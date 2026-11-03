import { test, expect, open, isoDay } from './fixtures';

// Files (docs/FILES.md). Made-up files and mock data only.

const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\n% a made-up warranty for tests\n'),
});
const csv = (name: string) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from('Item,Serial\nFridge,AB-123\n'),
});

test('a file is added, labelled, found by what it says and linked to two transactions', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Card', 0, 'credit');
  await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -149_900,
    payeeName: 'Appliances R Us',
  });
  await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -9_900,
    payeeName: 'Extended Warranty Co',
  });

  await open(page, '/files');
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();
  await page
    .getByLabel('Add files: choose files')
    .setInputFiles([pdf('warranty.pdf'), csv('serials.csv')]);
  await expect(page.getByRole('button', { name: 'Open warranty.pdf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open serials.csv' })).toBeVisible();

  // Found by the words inside the CSV
  await page.getByLabel('Search files').fill('ab-123');
  await expect(page.getByRole('button', { name: 'Open serials.csv' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open warranty.pdf' })).toHaveCount(0);
  await page.getByLabel('Search files').fill('');

  await page.getByRole('button', { name: 'Open warranty.pdf' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('New label').fill('Warranty');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Warranty', pressed: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Star' }).click();
  await expect(dialog.getByRole('button', { name: 'Starred', pressed: true })).toBeVisible();

  for (const payee of ['Appliances R Us', 'Extended Warranty Co']) {
    await dialog.getByRole('button', { name: 'Link', exact: true }).click();
    await dialog.getByLabel('Search transactions').fill(payee.slice(0, 9));
    await dialog.getByRole('button', { name: new RegExp(payee) }).click();
    await expect(dialog.getByRole('region', { name: 'Linked to' })).toContainText(payee);
  }

  // Unlinking keeps the file
  await dialog.getByRole('button', { name: 'Remove the link to Extended Warranty Co' }).click();
  await expect(dialog.getByRole('region', { name: 'Linked to' })).not.toContainText(
    'Extended Warranty Co',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page
    .getByRole('complementary', { name: 'File views' })
    .getByRole('button', { name: 'Starred' })
    .click();
  await expect(page.getByRole('button', { name: 'Open warranty.pdf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open serials.csv' })).toHaveCount(0);

  // The transaction shows the file, and the register filters by it
  await open(page, `/accounts/${card.id}`);
  await page.getByTestId('transaction-row').filter({ hasText: 'Appliances R Us' }).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel.getByRole('region', { name: 'Other files' })).toContainText('warranty.pdf');

  const withFiles = await api.call('GET', '/transactions?has_files=1');
  expect(withFiles.map((t: { payeeName: string }) => t.payeeName)).toEqual(['Appliances R Us']);
});
