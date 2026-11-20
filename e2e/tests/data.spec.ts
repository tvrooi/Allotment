import fs from 'fs';
import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, chooseOption, setToggle } from './fixtures';

// Getting data in (CSV import) and out (CSV export, full backup) and restoring it.

// What banks actually send: an Excel byte order mark, a quoted memo with a comma and a
// line break, accounting-style negatives, and two identical coffees on the same day.
const BANK_CSV =
  '﻿Date,Description,Amount,Memo\r\n' +
  '01/15/2025,Corner Coffee,(4.50),\r\n' +
  '01/15/2025,Corner Coffee,(4.50),\r\n' +
  '01/16/2025,"Acme, Inc. Payroll",2500.00,"Direct deposit\r\nJanuary"\r\n' +
  '01/17/2025,Hardware Store,-89.99,\r\n';

// A German bank's export: semicolons, day-first dates, decimal commas, and Windows-1252
// rather than UTF-8 (so the umlauts are single bytes).
const GERMAN_CSV =
  'Buchungstag;Auftraggeber / Empfänger;Verwendungszweck;Betrag\r\n' +
  '15.01.2025;Bäckerei Müller;Brötchen;-4,50\r\n' +
  '16.01.2025;"Arbeitgeber GmbH";Gehalt Januar;2.500,00\r\n' +
  '17.01.2025;Baumarkt;;-1.089,99\r\n';

async function importCsv(page: Page, csv: string, encoding: BufferEncoding = 'utf8') {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import transactions' });
  await dialog.getByLabel('Bank file').setInputFiles({
    name: 'bank-export.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, encoding),
  });
  return dialog;
}

test.describe('CSV import', () => {
  test('maps columns and imports every row, even tricky ones', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, BANK_CSV);

    await expect(dialog).toContainText('Found 4 rows');
    // Columns are recognized from their headers, the BOM notwithstanding
    // Each column's role is the shared Select: a button showing the chosen role (03-22)
    await expect(dialog.getByRole('button', { name: 'Column Date' })).toHaveText('Date');
    await expect(dialog.getByRole('button', { name: 'Column Description' })).toHaveText('Payee');
    await expect(dialog.getByRole('button', { name: 'Column Amount' })).toHaveText('Amount');
    await expect(dialog.getByRole('button', { name: 'Column Memo' })).toHaveText('Notes');

    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('4 transactions found. 0 duplicates detected.');
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await expect(dialog).toContainText('4 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    const summary = txs
      .map((t) => [t.date, t.payeeName, t.amount, t.notes])
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(summary).toEqual([
      ['2025-01-15', 'Corner Coffee', -450, null],
      ['2025-01-15', 'Corner Coffee', -450, null],
      ['2025-01-16', 'Acme, Inc. Payroll', 250_000, 'Direct deposit\r\nJanuary'],
      ['2025-01-17', 'Hardware Store', -8_999, null],
    ]);
    expect(await api.balance(checking.id)).toBe(240_101);
  });

  test('importing the same file again finds only duplicates', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    let dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The next month's export overlaps: one new row
    dialog = await importCsv(page, BANK_CSV + '01/20/2025,Bakery,(7.25),\r\n');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText(
      '5 transactions found. 4 duplicates detected. 1 will be imported.',
    );
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(5);
  });

  // SEC-01: a statement that covers days the account already has
  test('flags statement rows that match transactions typed by hand, and leaves the choice', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    // The hardware store purchase was typed in the day it happened
    await api.createTransaction({
      accountId: checking.id,
      date: '2025-01-17',
      amount: -8_999,
      payeeName: 'Hardware Store',
    });
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();

    await expect(dialog).toContainText('4 transactions found. 0 duplicates detected.');
    await expect(dialog).toContainText('1 look like transactions already in this account');
    await expect(dialog).toContainText('3 will be imported.');
    await expect(dialog).toContainText('may already be here');
    await expect(dialog).toContainText('Looks like Hardware Store on');
    await expect(dialog).toContainText('entered by hand');
    const flagged = dialog.getByRole('checkbox', { name: /Import Hardware Store on / });
    await expect(flagged).not.toBeChecked();

    // Leave it out: only the other three arrive
    await dialog.getByRole('button', { name: 'Import 3 Transactions' }).click();
    await expect(dialog).toContainText('3 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(4);
  });

  test('imports a flagged row when the person ticks it', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await api.createTransaction({
      accountId: checking.id,
      date: '2025-01-17',
      amount: -8_999,
      payeeName: 'Hardware Store',
    });
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await setToggle(dialog.getByRole('checkbox', { name: /Import Hardware Store on / }));
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await expect(dialog).toContainText('4 imported, 0 skipped');
    await expect(dialog).toContainText('1 imported transaction looks like ones this account');
    await dialog.getByRole('button', { name: 'Done' }).click();
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(5);
  });

  // SEC-01: take a file back out
  test('undoes an import from its last step, and puts the rows back', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await expect(dialog).toContainText('4 imported, 0 skipped');

    await dialog.getByRole('button', { name: 'Undo import bank-export.csv' }).click();
    await page
      .getByRole('dialog', { name: 'Undo this import?' })
      .getByRole('button', { name: 'Remove them' })
      .click();
    await expect(dialog).toContainText('Removed 4 transactions from bank-export.csv');
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(0);

    await dialog.getByRole('button', { name: 'Put them back' }).click();
    await expect(dialog).toContainText('Put 4 transactions back');
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(4);
  });

  test('lists earlier imports and undoes one, keeping what was typed by hand', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    await api.createTransaction({
      accountId: checking.id,
      date: '2025-02-01',
      amount: -1_000,
      payeeName: 'Typed by hand',
    });
    await open(page, `/accounts/${checking.id}`);
    let dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Import CSV' }).click();
    dialog = page.getByRole('dialog', { name: 'Import transactions' });
    await expect(dialog).toContainText('Earlier imports');
    await expect(dialog).toContainText('bank-export.csv');
    await expect(dialog).toContainText('4 of 4 transactions in this account');
    await dialog.getByRole('button', { name: 'Undo import bank-export.csv' }).click();
    await page
      .getByRole('dialog', { name: 'Undo this import?' })
      .getByRole('button', { name: 'Remove them' })
      .click();
    await expect(dialog).toContainText('Removed 4 transactions from bank-export.csv');
    // The file's row is gone from the list, and only the typed one is left
    await expect(dialog.getByText('4 of 4 transactions in this account')).toHaveCount(0);
    const left = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect(left.map((t) => t.payeeName)).toEqual(['Typed by hand']);
  });

  test('reads European exports: semicolons, day-first dates and decimal commas', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, GERMAN_CSV, 'latin1');

    await expect(dialog).toContainText('Found 3 rows');
    await expect(dialog.getByRole('button', { name: 'Separator' })).toHaveText('Semicolon');
    await expect(dialog.getByRole('button', { name: 'Dates' })).toHaveText('DD/MM/YYYY');
    await expect(dialog.getByRole('button', { name: 'Amounts' })).toHaveText('1.234,56');
    await expect(dialog.getByRole('button', { name: 'Column Buchungstag' })).toHaveText('Date');
    await expect(
      dialog.getByRole('button', { name: 'Column Auftraggeber / Empfänger' }),
    ).toHaveText('Payee');
    await expect(dialog.getByRole('button', { name: 'Column Betrag' })).toHaveText('Amount');

    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 3 Transactions' }).click();
    await expect(dialog).toContainText('3 imported, 0 skipped');

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    const summary = txs
      .map((t) => [t.date, t.payeeName, t.amount, t.notes])
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(summary).toEqual([
      ['2025-01-15', 'Bäckerei Müller', -450, 'Brötchen'],
      ['2025-01-16', 'Arbeitgeber GmbH', 250_000, 'Gehalt Januar'],
      ['2025-01-17', 'Baumarkt', -108_999, null],
    ]);
  });

  test('signs amounts from an Af/Bij column, as ING Netherlands exports them', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Betaalrekening', 0);
    await open(page, `/accounts/${checking.id}`);
    // Every amount is positive: "Af" (off) is money out, "Bij" (on) is money in
    const dialog = await importCsv(
      page,
      '"Datum","Naam / Omschrijving","Rekening","Af Bij","Bedrag (EUR)","Mededelingen"\r\n' +
        '"20250115","Albert Heijn","NL01INGB0001234567","Af","12,50","Boodschappen"\r\n' +
        '"20250125","Werkgever BV","NL01INGB0001234567","Bij","2500,00","Salaris"\r\n',
    );

    await expect(dialog.getByRole('button', { name: 'Column Af Bij' })).toHaveText(
      'Direction (in/out)',
    );
    await expect(dialog.getByRole('button', { name: 'Column Bedrag (EUR)' })).toHaveText('Amount');
    await expect(dialog.getByRole('button', { name: 'Amounts' })).toHaveText('1.234,56');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    const summary = txs
      .map((t) => [t.date, t.payeeName, t.amount])
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(summary).toEqual([
      ['2025-01-15', 'Albert Heijn', -1_250],
      ['2025-01-25', 'Werkgever BV', 250_000],
    ]);
  });

  test('asks for the format when the file could be read two ways', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    // 01.02.2025 could be January 2 or 1 February; 1.234 could be 1234 or 1.234
    const dialog = await importCsv(page, 'Date;Description;Amount\r\n01.02.2025;Rent;-1.234\r\n');

    await expect(dialog).toContainText('Choose the format your bank uses');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('Choose how this file writes dates');

    await chooseOption(dialog.getByRole('button', { name: 'Dates' }), 'DD/MM/YYYY');
    await chooseOption(dialog.getByRole('button', { name: 'Amounts' }), '1.234,56');
    await expect(dialog).not.toContainText('Choose the format your bank uses');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');

    const [tx] = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect([tx.date, tx.amount]).toEqual(['2025-02-01', -123_400]);
  });

  test("remembers each account's settings for the next import", async ({ page, api }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    // Every day is 12 or less, and 1.234 could be either: the first import has to ask
    const csv = (rows: string) => `Datum;Empfänger;Betrag\r\n${rows}`;
    let dialog = await importCsv(page, csv('01.02.2025;Miete;-1.234\r\n'));
    await chooseOption(dialog.getByRole('button', { name: 'Dates' }), 'DD/MM/YYYY');
    await chooseOption(dialog.getByRole('button', { name: 'Amounts' }), '1.234,56');
    await chooseOption(dialog.getByRole('button', { name: 'Column Empfänger' }), 'Notes');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // Next month's file is just as ambiguous, but this account has answered before
    dialog = await importCsv(page, csv('03.04.2025;Miete;-1.234\r\n'));
    await expect(dialog).toContainText('Using the settings from your last import');
    await expect(dialog).not.toContainText('Choose the format your bank uses');
    await expect(dialog).toContainText(
      "This file doesn't show how it writes dates or amounts: using DD/MM/YYYY and 1.234,56, " +
        'as in your last import into this account.',
    );
    await expect(dialog.getByRole('button', { name: 'Dates' })).toHaveText('DD/MM/YYYY');
    await expect(dialog.getByRole('button', { name: 'Amounts' })).toHaveText('1.234,56');
    await expect(dialog.getByRole('button', { name: 'Column Empfänger' })).toHaveText('Notes');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect(txs.map((t) => [t.date, t.amount, t.notes]).sort()).toEqual([
      ['2025-02-01', -123_400, 'Miete'],
      ['2025-04-03', -123_400, 'Miete'],
    ]);
  });

  test('skips account details above the header', async ({ page, api }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    // As DKB exports it: a few lines about the account, a blank line, then the table
    const dialog = await importCsv(
      page,
      '"Konto:";"DE89 3704 0044 0532 0130 00";\r\n' +
        '"Zeitraum:";"01.01.2025 - 31.01.2025";\r\n' +
        '"Kontostand vom 31.01.2025:";"1.234,56 EUR";\r\n' +
        '\r\n' +
        '"Buchungstag";"Auftraggeber / Empfänger";"Verwendungszweck";"Betrag";\r\n' +
        '"15.01.2025";"Bäckerei";"Brötchen";"-4,50";\r\n' +
        '"20.01.2025";"Arbeitgeber";"Gehalt";"2.500,00";\r\n',
    );

    await expect(dialog.getByRole('textbox', { name: 'Rows above the header' })).toHaveValue('3');
    await expect(dialog).toContainText('Found 2 rows');
    await expect(dialog.getByRole('button', { name: 'Column Betrag' })).toHaveText('Amount');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    expect(await api.balance(checking.id)).toBe(249_550);
  });

  test("rows above the header stop at the server's cap of 1000", async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    // 1003 lines, each telling which line it is: room for 1002 rows above a header, but the
    // settings the import remembers allow 1000 (skipRows in server/src/utils/importSettings.ts)
    const lines = Array.from({ length: 1003 }, (_, i) => `Line${i}a,Line${i}b`);
    const dialog = await importCsv(page, lines.join('\r\n') + '\r\n');
    // A text field with a numeric keyboard, not a spin button (D-14)
    const rows = dialog.getByRole('textbox', { name: 'Rows above the header' });
    const preview = dialog.getByRole('button', { name: 'Preview' });

    await rows.fill('1000');
    await expect(dialog.getByText('Line1000a', { exact: true })).toBeVisible();
    await expect(dialog).toContainText('Found 2 rows');
    await expect(preview).toBeEnabled();

    await rows.fill('1001');
    await expect(dialog.getByRole('alert')).toHaveText('Enter a whole number from 0 to 1000.');
    await expect(rows).toHaveValue('1001');
    // The last table that could be read stays, and nothing is previewed from the bad number
    await expect(dialog.getByText('Line1000a', { exact: true })).toBeVisible();
    await expect(preview).toBeDisabled();
  });

  test('a file with no room above its header takes only 0', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, 'Date,Description,Amount\r\n');
    const rows = dialog.getByRole('textbox', { name: 'Rows above the header' });
    await expect(rows).toHaveValue('0');

    await rows.fill('1');
    await expect(dialog.getByRole('alert')).toHaveText(
      'Enter 0 — this file has no rows above the header.',
    );
    await expect(dialog.getByRole('button', { name: 'Preview' })).toBeDisabled();
    await rows.fill('0');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });

  test('reads Central European files in the encoding the user picks', async ({ page, api }) => {
    const checking = await api.createAccount('Konto', 0);
    await open(page, `/accounts/${checking.id}`);
    // "Łódź" in Windows-1250, as Polish banks export it: valid Windows-1252 too, but wrong
    const header = Buffer.from('Data;Opis;Kwota\r\n2025-01-15;', 'latin1');
    const lodz = Buffer.from([0xa3, 0xf3, 0x64, 0x9f]);
    const rest = Buffer.from(';-12,50\r\n', 'latin1');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import transactions' });
    await dialog.getByLabel('Bank file').setInputFiles({
      name: 'wyciag.csv',
      mimeType: 'text/csv',
      buffer: Buffer.concat([header, lodz, rest]),
    });

    await chooseOption(dialog.getByRole('button', { name: 'Column Opis' }), 'Payee');
    await chooseOption(
      dialog.getByRole('button', { name: 'Encoding' }),
      'Central European (Windows-1250)',
    );
    // Reading the file again in another encoding keeps the mapping
    await expect(dialog.getByRole('button', { name: 'Column Opis' })).toHaveText('Payee');
    await expect(dialog.getByRole('cell', { name: 'Łódź' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');

    const [tx] = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect([tx.payeeName, tx.amount]).toEqual(['Łódź', -1_250]);
  });

  test("asks for the bank's word for money out when it doesn't know it", async ({ page, api }) => {
    const checking = await api.createAccount('Rekening', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(
      page,
      'Datum,Omschrijving,Richting,Bedrag\r\n' +
        '2025-01-15,Albert Heijn,Uit,"12,50"\r\n' +
        '2025-01-25,Werkgever,In,"2500,00"\r\n',
    );
    await chooseOption(
      dialog.getByRole('button', { name: 'Column Richting' }),
      'Direction (in/out)',
    );
    await expect(dialog).toContainText('doesn\'t know what "Uit"');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('Type the word your bank uses for money going out');

    await dialog.getByRole('textbox', { name: 'Word for money out' }).fill('Uit');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    expect(await api.balance(checking.id)).toBe(248_750);
  });

  test('imports CAMT.053 statements: booked entries only, and duplicates on re-import', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    const entry = (
      ref: string,
      amount: string,
      ind: string,
      sts: string,
      day: string,
      name: string,
    ) => `
      <Ntry>
        <AcctSvcrRef>${ref}</AcctSvcrRef>
        <Amt Ccy="EUR">${amount}</Amt><CdtDbtInd>${ind}</CdtDbtInd><Sts>${sts}</Sts>
        <BookgDt><Dt>${day}</Dt></BookgDt><ValDt><Dt>2025-01-31</Dt></ValDt>
        <NtryDtls><TxDtls><RltdPties>
          <${ind === 'DBIT' ? 'Cdtr' : 'Dbtr'}><Nm>${name}</Nm></${ind === 'DBIT' ? 'Cdtr' : 'Dbtr'}>
        </RltdPties><RmtInf><Ustrd>Ref ${ref}</Ustrd></RmtInf></TxDtls></NtryDtls>
      </Ntry>`;
    const statement = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
  <Acct><Id><IBAN>DE89370400440532013000</IBAN></Id></Acct>
  ${entry('A1', '12.50', 'DBIT', 'BOOK', '2025-01-15', 'Bäckerei Müller')}
  ${entry('A2', '2500.00', 'CRDT', 'BOOK', '2025-01-20', 'Arbeitgeber GmbH')}
  ${entry('A3', '99.00', 'DBIT', 'PDNG', '2025-01-30', 'Pending Shop')}
</Stmt></BkToCstmrStmt></Document>`;
    const importStatement = async () => {
      await page.getByRole('button', { name: 'Import CSV' }).click();
      const dialog = page.getByRole('dialog', { name: 'Import transactions' });
      await dialog.getByLabel('Bank file').setInputFiles({
        name: 'statement.xml',
        mimeType: 'application/xml',
        buffer: Buffer.from(statement, 'utf8'),
      });
      return dialog;
    };

    let dialog = await importStatement();
    // No columns to map: straight to the preview
    await expect(dialog).toContainText('2 transactions found. 0 duplicates detected.');
    await expect(dialog).toContainText("1 entry is pending or couldn't be read");
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect(txs.map((t) => [t.date, t.payeeName, t.amount, t.notes]).sort()).toEqual([
      ['2025-01-15', 'Bäckerei Müller', -1_250, 'Ref A1'],
      ['2025-01-20', 'Arbeitgeber GmbH', 250_000, 'Ref A2'],
    ]);

    dialog = await importStatement();
    await expect(dialog).toContainText('2 transactions found. 2 duplicates detected. 0 will be');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });

  test('warns when a statement is for another account than last time', async ({ page, api }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    const statementFor = (
      iban: string,
      ref: string,
      day: string,
    ) => `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
  <Acct><Id><IBAN>${iban}</IBAN></Id></Acct>
  <Ntry><AcctSvcrRef>${ref}</AcctSvcrRef><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>DBIT</CdtDbtInd>
    <Sts>BOOK</Sts><BookgDt><Dt>${day}</Dt></BookgDt></Ntry>
</Stmt></BkToCstmrStmt></Document>`;
    // A different day each time: the same amount within 3 days would be flagged as a repeat
    const importStatement = async (iban: string, ref: string, day: string) => {
      await page.getByRole('button', { name: 'Import CSV' }).click();
      const dialog = page.getByRole('dialog', { name: 'Import transactions' });
      await dialog.getByLabel('Bank file').setInputFiles({
        name: 'statement.xml',
        mimeType: 'application/xml',
        buffer: Buffer.from(statementFor(iban, ref, day), 'utf8'),
      });
      await expect(dialog).toContainText('1 transactions found.');
      return dialog;
    };

    let dialog = await importStatement('DE89370400440532013000', 'B1', '2025-02-03');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The same account written in groups of four is the same account
    dialog = await importStatement('DE89 3704 0044 0532 0130 00', 'B2', '2025-03-03');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close' }).click();

    dialog = await importStatement('NL91ABNA0417164300', 'B3', '2025-04-03');
    await expect(dialog.getByRole('alert')).toContainText(
      'This statement is for account NL91ABNA0417164300, but the last statement imported into ' +
        'this account was for DE89370400440532013000.',
    );
    // It's a warning: the import still goes ahead if it's meant
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');
  });

  test('asks which statement to import from a file for several accounts', async ({ page, api }) => {
    const checking = await api.createAccount('Girokonto', 0);
    await open(page, `/accounts/${checking.id}`);
    const statementFor = (iban: string, ref: string, amount: string) => `<Stmt>
  <Acct><Id><IBAN>${iban}</IBAN></Id></Acct>
  <Ntry><AcctSvcrRef>${ref}</AcctSvcrRef><Amt Ccy="EUR">${amount}</Amt><CdtDbtInd>DBIT</CdtDbtInd>
    <Sts>BOOK</Sts><BookgDt><Dt>2025-02-03</Dt></BookgDt></Ntry>
</Stmt>`;
    const file = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt>
${statementFor('DE89370400440532013000', 'S1', '10.00')}
${statementFor('NL91ABNA0417164300', 'S2', '25.00')}
</BkToCstmrStmt></Document>`;
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import transactions' });
    await dialog.getByLabel('Bank file').setInputFiles({
      name: 'statements.xml',
      mimeType: 'application/xml',
      buffer: Buffer.from(file, 'utf8'),
    });
    await expect(dialog).toContainText('This file has statements for 2 accounts.');
    // The shared Select: a button named Statement that shows the chosen statement
    const statement = dialog.getByRole('button', { name: 'Statement' });
    await expect(statement).toHaveText('DE89370400440532013000 (1 transactions)');
    await chooseOption(statement, 'NL91ABNA0417164300 (1 transactions)');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');
    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    expect(txs.map((t) => t.amount)).toEqual([-2_500]);
  });

  test("a file with other columns doesn't inherit the last import's formats", async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    let dialog = await importCsv(page, 'Datum;Empfänger;Betrag\r\n01.02.2025;Miete;-1.234\r\n');
    await chooseOption(dialog.getByRole('button', { name: 'Dates' }), 'DD/MM/YYYY');
    await chooseOption(dialog.getByRole('button', { name: 'Amounts' }), '1.234,56');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // A US export into the same account: just as ambiguous, but it may be another bank
    dialog = await importCsv(page, 'Date,Description,Amount\r\n03/04/2025,Rent,-1.234\r\n');
    await expect(dialog).toContainText('Choose the format your bank uses');
    await expect(dialog.getByRole('button', { name: 'Dates' })).toHaveText('Choose…');
    await expect(dialog.getByRole('button', { name: 'Amounts' })).toHaveText('Choose…');
  });

  test('a money-out word typed for one file never flips another file', async ({ page, api }) => {
    const checking = await api.createAccount('Rekening', 0);
    await open(page, `/accounts/${checking.id}`);
    let dialog = await importCsv(
      page,
      'Datum,Omschrijving,Richting,Bedrag\r\n2025-01-15,Albert Heijn,Uit,"12,50"\r\n',
    );
    await chooseOption(
      dialog.getByRole('button', { name: 'Column Richting' }),
      'Direction (in/out)',
    );
    await dialog.getByRole('textbox', { name: 'Word for money out' }).fill('Uit');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // Another export with other columns and the words Allotment knows
    dialog = await importCsv(
      page,
      'Datum,Naam / Omschrijving,Af Bij,Bedrag (EUR)\r\n' +
        '2025-02-15,Jumbo,Af,"20,00"\r\n' +
        '2025-02-25,Werkgever,Bij,"2500,00"\r\n',
    );
    await expect(dialog.getByRole('textbox', { name: 'Word for money out' })).toHaveValue('');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    expect(await api.balance(checking.id)).toBe(-1_250 - 2_000 + 250_000);
  });

  test('closing while a file loads starts the next import afresh', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    // Hold the saved-settings lookup until the dialog has been closed
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    let first = true;
    await page.route('**/import-settings', async (route) => {
      if (first) {
        first = false;
        await held;
      }
      await route.continue();
    });

    let dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    release();

    await page.getByRole('button', { name: 'Import CSV' }).click();
    dialog = page.getByRole('dialog', { name: 'Import transactions' });
    await expect(dialog).toContainText('Drag and drop a file from your bank');
    // The abandoned file doesn't turn up later either
    await page.waitForTimeout(300);
    await expect(dialog).not.toContainText('Map each column');
  });

  test('closing while importing starts the next import afresh', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/import/confirm', async (route) => {
      await held;
      await route.continue();
    });

    let dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    const confirmed = page.waitForResponse('**/import/confirm');
    release();
    await confirmed;

    // The import happened, but its result isn't what the next import opens on
    await expect
      .poll(async () => (await api.transactions(`?account_id=${checking.id}`)).length)
      .toBe(4);
    await page.getByRole('button', { name: 'Import CSV' }).click();
    dialog = page.getByRole('dialog', { name: 'Import transactions' });
    await expect(dialog).toContainText('Drag and drop a file from your bank');
    await expect(dialog).not.toContainText('Import complete');
  });

  test('changing the rows above the header keeps the columns mapped by hand', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    // A title line as wide as the table: taken for the header at first
    const dialog = await importCsv(
      page,
      'Export,of,transactions\r\nWhen,Text,Value\r\n2025-01-15,Bakery,-4.50\r\n2025-01-16,Rent,-900.00\r\n',
    );
    await expect(dialog.getByRole('textbox', { name: 'Rows above the header' })).toHaveValue('0');
    await chooseOption(dialog.getByRole('button', { name: 'Column Export' }), 'Date');
    await chooseOption(dialog.getByRole('button', { name: 'Column of' }), 'Notes');
    await chooseOption(dialog.getByRole('button', { name: 'Column transactions' }), 'Amount');

    await dialog.getByRole('textbox', { name: 'Rows above the header' }).fill('1');
    await expect(dialog.getByRole('button', { name: 'Column When' })).toHaveText('Date');
    await expect(dialog.getByRole('button', { name: 'Column Text' })).toHaveText('Notes');
    await expect(dialog.getByRole('button', { name: 'Column Value' })).toHaveText('Amount');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
  });

  test('a placeholder in the unused inflow or outflow column is read as empty', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(
      page,
      'Date,Description,Debit,Credit\r\n2026-03-01,Coffee,4.50,-\r\n2026-03-02,Refund,n/a,10.00\r\n',
    );
    await expect(dialog.getByRole('button', { name: 'Column Debit' })).toHaveText('Outflow');
    await expect(dialog.getByRole('button', { name: 'Column Credit' })).toHaveText('Inflow');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    expect(await api.balance(checking.id)).toBe(-450 + 1_000);
  });

  test('rows with an unreadable amount are reported, not dropped silently', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(
      page,
      'Date,Description,Amount\r\n' +
        '01/15/2025,Corner Coffee,-4.50\r\n' +
        '01/16/2025,Bakery,-7.25\r\n' +
        '01/17/2025,Hardware Store,N/A\r\n',
    );
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('2 transactions found.');
    await expect(dialog.getByRole('status')).toContainText('1 row skipped: row 3, amount "N/A".');
  });

  test('unreadable files explain what went wrong', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, 'Name,Notes\r\nfoo,bar\r\n');
    await chooseOption(dialog.getByRole('button', { name: 'Column Name' }), 'Payee');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('Date column is required');
    expect(await api.transactions(`?account_id=${checking.id}`)).toHaveLength(0);
  });
});

test.describe('export, backup and restore', () => {
  test('exports transactions as CSV, with formula injection neutralized', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_000,
      payeeName: '=HYPERLINK("http://evil.example")',
    });
    await open(page, '/settings');
    await page.getByRole('tab', { name: 'Data' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = fs.readFileSync(await (await download).path(), 'utf8');
    expect(csv.split('\n')[0]).toBe(
      'Date,Account,Payee,Category,Notes,Amount,Reconciled,Tags,Reviewed,Hidden from reports',
    );
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(csv).toContain('-10.00');
  });

  test('a backup restores everything it contained', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 50_000);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -2_500,
      payeeName: 'Before Backup',
    });
    await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });

    await open(page, '/settings');
    await page.getByRole('tab', { name: 'Data' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const backupFile = await (await download).path();
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    expect(backup).toMatchObject({ format: 'flybudget-backup', version: 34 });
    expect(backup.goals).toHaveLength(1);
    // Never any bank credentials or login data
    expect(Object.keys(backup)).not.toContain('plaidItems');
    expect(Object.keys(backup)).not.toContain('sessions');

    // Things change after the backup…
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -99_999,
      payeeName: 'After Backup',
    });
    await api.createAccount('New Account', 1);

    // …and restoring brings it back
    await page.getByLabel('Backup file').setInputFiles(backupFile);
    const confirm = page.getByRole('dialog', { name: 'Restore this backup?' });
    await expect(confirm).toContainText('All of your current data will be replaced');
    await confirm.getByRole('button', { name: 'Replace my data' }).click();
    await expect(page.getByRole('status')).toContainText('Restored');
    await expect(page.getByRole('status')).toContainText('1 transactions');

    expect((await api.accounts()).map((a) => a.name)).toEqual(['Checking']);
    expect(await api.balance(checking.id)).toBe(47_500);
    const payees = (await api.transactions()).map((t) => t.payeeName);
    expect(payees).toEqual(['Before Backup']);
    // The sidebar shows the restored data without reloading
    await expect(page.getByRole('complementary')).toContainText('$475');
  });

  test('restoring a file that is not a backup changes nothing', async ({ page, api }) => {
    await api.createAccount('Checking', 50_000);
    await open(page, '/settings');
    await page.getByRole('tab', { name: 'Data' }).click();
    await page.getByLabel('Backup file').setInputFiles({
      name: 'notes.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    });
    await page
      .getByRole('dialog', { name: 'Restore this backup?' })
      .getByRole('button', { name: 'Replace my data' })
      .click();
    await expect(page.getByRole('status')).toContainText('This is not an Allotment backup file');
    expect((await api.accounts()).map((a) => a.name)).toEqual(['Checking']);

    await page.getByLabel('Backup file').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not json'),
    });
    await expect(page.getByRole('status')).toContainText(
      'broken.json is not an Allotment backup file',
    );
  });
});
