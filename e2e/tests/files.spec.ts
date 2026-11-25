import { test, expect, open, isoDay, chooseOption, fillDate, categoryOption } from './fixtures';

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

test('the Files filters: the search clears, Kind narrows by kind, and From and To by date', async ({
  page,
}) => {
  await open(page, '/files');
  await page
    .getByLabel('Add files: choose files')
    .setInputFiles([pdf('warranty.pdf'), csv('serials.csv')]);
  const warranty = page.getByRole('button', { name: 'Open warranty.pdf' });
  const serials = page.getByRole('button', { name: 'Open serials.csv' });
  await expect(warranty).toBeVisible();
  await expect(serials).toBeVisible();

  // The search's clear button empties it and shows every file again
  const search = page.getByRole('textbox', { name: 'Search files' });
  await search.fill('ab-123');
  await expect(warranty).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear file search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(warranty).toBeVisible();
  await expect(serials).toBeVisible();

  // Kind is the shared Select (D-05: chooseOption, not selectOption); "Any kind" drops the filter
  const kind = page.getByRole('button', { name: /Kind of file/ });
  await chooseOption(kind, 'PDFs');
  await expect(page).toHaveURL(/kind=pdf/);
  await expect(warranty).toBeVisible();
  await expect(serials).toHaveCount(0);
  await chooseOption(kind, 'Any kind');
  await expect(page).not.toHaveURL(/kind=/);
  await expect(serials).toBeVisible();

  // From and To are the shared DatePicker (D-07: fillDate); each clears with its own button.
  // Days of two figures over 12 (25): typed one at a time, so the second must not be lost
  await fillDate(page, 'From', '2099-12-25');
  await expect(page.getByText('No files match.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear From', exact: true }).click();
  await expect(warranty).toBeVisible();
  await fillDate(page, 'To', '2000-12-25');
  await expect(page.getByText('No files match.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear To', exact: true }).click();
  await expect(warranty).toBeVisible();
  await expect(serials).toBeVisible();
});

// A day picked and then undone by Back: the From field follows the URL, as the list does, and
// To's earliest day goes with it (03 review)
test('Back after picking a From day empties the field and shows every file again', async ({
  page,
}) => {
  await open(page, '/files');
  await page.getByLabel('Add files: choose files').setInputFiles([pdf('warranty.pdf')]);
  const warranty = page.getByRole('button', { name: 'Open warranty.pdf' });
  await expect(warranty).toBeVisible();

  await fillDate(page, 'From', '2099-12-05');
  await expect(page).toHaveURL(/from=2099-12-05/);
  await expect(page.getByText('No files match.')).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/from=/);
  await expect(warranty).toBeVisible();
  const from = page.getByRole('group', { name: 'From', exact: true });
  await expect(from.getByRole('spinbutton')).toHaveCount(3);
  await expect(from.locator('[role="spinbutton"]:not([data-placeholder])')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear From', exact: true })).toHaveCount(0);
  // To no longer starts at the day that went
  await fillDate(page, 'To', '2099-12-01');
  await expect(page.getByText(/Enter a date on or after/)).toHaveCount(0);
});

test("a file's details save, and its links go by kind: a category through the category picker, an account through a search", async ({
  page,
  api,
}) => {
  const everyday = await api.createAccount('Everyday', 0);
  await api.createAccount('Savings', 0);
  const groceries = await api.category('Groceries');

  await open(page, '/files');
  await page.getByLabel('Add files: choose files').setInputFiles([pdf('warranty.pdf')]);
  await page.getByRole('button', { name: 'Open warranty.pdf' }).click();
  const dialog = page.getByRole('dialog');

  // The name (shared Input) and description (shared Textarea) save on leaving them; the date
  // (shared DatePicker, D-07: fillDate) saves as it changes
  const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('fridge warranty.pdf');
  await name.blur();
  await fillDate(dialog, 'Date', '2026-03-14');
  const description = dialog.getByRole('textbox', { name: 'Description', exact: true });
  await description.fill('Five years, parts and labour');
  await description.blur();
  type Listed = {
    documents: {
      fileName: string;
      documentDate: string | null;
      description: string | null;
      links: { kind: string; id: string }[];
    }[];
  };
  const stored = async () => (await api.call<Listed>('GET', '/files')).documents[0];
  await expect
    .poll(async () => {
      const { fileName, documentDate, description } = await stored();
      return { fileName, documentDate, description };
    })
    .toEqual({
      fileName: 'fridge warranty.pdf',
      documentDate: '2026-03-14',
      description: 'Five years, parts and labour',
    });

  const linkTo = dialog.getByRole('group', { name: 'Link to' });
  const linked = dialog.getByRole('region', { name: 'Linked to' });

  // A category is chosen in the category picker, the one every category choice uses
  await dialog.getByRole('button', { name: 'Link', exact: true }).click();
  await linkTo.getByRole('button', { name: 'Category', exact: true }).click();
  await dialog.getByRole('button', { name: 'Category: Choose a category…', exact: true }).click();
  // No "Uncategorised" row: a link needs a category, so it would do nothing
  await expect(categoryOption(page, 'Groceries', { exact: true })).toBeVisible();
  await expect(categoryOption(page, 'Uncategorised')).toHaveCount(0);
  await categoryOption(page, 'Groceries', { exact: true }).click();
  await expect(linked).toContainText('Groceries');

  // An account is searched for in the shared Combobox; picking one links it and closes the picker
  await dialog.getByRole('button', { name: 'Link', exact: true }).click();
  await linkTo.getByRole('button', { name: 'Account', exact: true }).click();
  const account = dialog.getByRole('combobox', { name: 'Choose an account' });
  await account.fill('Every');
  await expect(page.getByRole('option', { name: 'Savings' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Everyday', exact: true }).click();
  await expect(linked).toContainText('Everyday');
  await expect(account).toHaveCount(0);

  // Each link went to its own kind (T-03-30): the category as a category, the account as an account
  await expect
    .poll(async () => (await stored()).links.map(({ kind, id }) => ({ kind, id })))
    .toEqual(
      expect.arrayContaining([
        { kind: 'category', id: groceries.id },
        { kind: 'account', id: everyday.id },
      ]),
    );

  // A linked category is left out of the picker; a linked account is listed but cannot be chosen
  await dialog.getByRole('button', { name: 'Link', exact: true }).click();
  await linkTo.getByRole('button', { name: 'Category', exact: true }).click();
  await dialog.getByRole('button', { name: 'Category: Choose a category…', exact: true }).click();
  await expect(categoryOption(page, 'Rent / Mortgage', { exact: true })).toBeVisible();
  await expect(categoryOption(page, 'Groceries', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await linkTo.getByRole('button', { name: 'Account', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Choose an account' }).fill('Every');
  await expect(page.getByRole('option', { name: 'Everyday', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
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
