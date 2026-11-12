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
  await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible();
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

test('a backup with files brings a deleted file back, contents and all (audit I-6)', async ({
  page,
  api,
}) => {
  await open(page, '/files');
  await page.getByLabel('Add files: choose files').setInputFiles([csv('serials.csv')]);
  await expect(page.getByRole('button', { name: 'Open serials.csv' })).toBeVisible();

  await open(page, '/settings?tab=data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup with files (.zip)' }).click();
  const archive = await (await download).path();

  // The file is deleted after the backup…
  type Listed = { documents: { id: string; fileName: string; hasFile: boolean }[] };
  const [doc] = (await api.call<Listed>('GET', '/files')).documents;
  await api.call('DELETE', `/files/${doc.id}`);
  expect((await api.call<Listed>('GET', '/files')).documents).toEqual([]);

  // …and restoring the ZIP brings it back with its bytes
  await page.getByLabel('Backup file').setInputFiles(archive);
  await page
    .getByRole('dialog', { name: 'Restore this backup?' })
    .getByRole('button', { name: 'Replace my data' })
    .click();
  await expect(page.getByRole('status')).toContainText('1 file');
  const [restored] = (await api.call<Listed>('GET', '/files')).documents;
  expect(restored).toMatchObject({ fileName: 'serials.csv', hasFile: true });
  const bytes = await page.request.get(`/api/files/${restored.id}/file`);
  expect(await bytes.text()).toBe('Item,Serial\nFridge,AB-123\n');
});

for (const width of [1280, 390])
  test('Wave D: empty state at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/files');
    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { name: 'Keep your files together', exact: true }),
    ).toBeVisible();
    await expect(main.getByText('Example', { exact: true })).toBeVisible();
    await page.keyboard.press('Alt+Shift+H');
    await expect(main.getByText('Example', { exact: true })).toBeVisible();
    await expect(
      main.locator('[aria-hidden="true"]').filter({ hasText: '$' }).first(),
    ).toBeVisible();
    await page.keyboard.press('Alt+Shift+H');
    const action = main.getByRole('button', { name: 'Add a file', exact: true });
    await expect(action).toHaveCount(1);
    await expect(action).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(main.getByRole('textbox', { name: 'Search files' })).toHaveCount(0);
    const chooser = page.waitForEvent('filechooser');
    await action.click();
    expect((await chooser).isMultiple()).toBe(true);
  });
