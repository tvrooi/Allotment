import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, otherDayThisMonth, typeAmount, type Api } from './fixtures';

// Entering and editing transactions in an account register, checking both what the
// page shows and what the server stored.

async function setup(api: Api) {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  const savings = await api.createAccount('Rainy Day Savings', 500_000, 'savings');
  return { checking, savings };
}

const header = (page: Page) => page.getByRole('main').locator('div').first();

const newForm = (page: Page) => page.getByRole('form', { name: 'New transaction' });

/** The register row for a payee */
const row = (page: Page, payee: string) =>
  page.getByTestId('transaction-row').filter({ hasText: payee });

async function fillNewTransaction(
  page: Page,
  fields: { payee?: string; category?: string; notes?: string; outflow?: string; inflow?: string },
) {
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  const form = newForm(page);
  if (fields.payee) await form.getByRole('textbox', { name: 'Payee' }).fill(fields.payee);
  if (fields.category) {
    await form.getByRole('combobox', { name: 'Category' }).selectOption({ label: fields.category });
  }
  if (fields.notes) await form.getByRole('textbox', { name: 'Notes' }).fill(fields.notes);
  if (fields.outflow) await form.getByRole('textbox', { name: 'Outflow' }).fill(fields.outflow);
  if (fields.inflow) await form.getByRole('textbox', { name: 'Inflow' }).fill(fields.inflow);
}

test.describe('account register', () => {
  test('adds an expense with a payee and category', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, {
      payee: 'Corner Grocery',
      category: 'Groceries',
      notes: 'weekly shop',
      outflow: '42.50',
    });
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    // The payee is row text (#243); the category is the row's one inline control
    await expect(row(page, 'Corner Grocery')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Category for Corner Grocery: Groceries' }),
    ).toBeVisible();
    await expect(header(page)).toContainText('$957.50');
    expect(await api.balance(checking.id)).toBe(95_750);

    const [tx] = await api.transactions(`?account_id=${checking.id}`);
    expect(tx).toMatchObject({ amount: -4_250, payeeName: 'Corner Grocery', notes: 'weekly shop' });
    expect(tx.categoryId).toBe((await api.category('Groceries')).id);
    // A new payee was created for it
    const payees = await api.call<{ name: string }[]>('GET', '/payees');
    expect(payees.map((p) => p.name)).toContain('Corner Grocery');
  });

  test("never saves text that isn't an amount as 0", async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { payee: 'Corner Grocery', outflow: 'abc' });
    const form = newForm(page);
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.getByRole('textbox', { name: 'Outflow' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(form.getByRole('alert')).toHaveText(
      "That isn't an amount. Type it like 12.50 or 12,50.",
    );
    expect(await api.transactions(`?account_id=${checking.id}`)).toHaveLength(0);

    // Fixed, it saves
    await form.getByRole('textbox', { name: 'Outflow' }).fill('4,50');
    await expect(form.getByRole('alert')).toBeHidden();
    await form.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => api.balance(checking.id)).toBe(100_000 - 450);
  });

  test('adds income as an inflow', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, {
      payee: 'Acme Corp',
      category: 'Paychecks',
      inflow: '2500',
    });
    await newForm(page).getByRole('button', { name: 'Save' }).click();
    await expect(header(page)).toContainText('$3,500');
    expect(await api.balance(checking.id)).toBe(350_000);
  });

  test('tabbing past the inflow keeps the outflow (#92)', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { payee: 'Corner Grocery', outflow: '12.34' });
    const form = newForm(page);
    await form.getByRole('textbox', { name: 'Outflow' }).press('Tab');
    await expect(form.getByRole('textbox', { name: 'Inflow' })).toBeFocused();
    await expect(form.getByRole('textbox', { name: 'Outflow' })).toHaveValue('12.34');
    // Typing an inflow still replaces the outflow
    await page.keyboard.type('5');
    await expect(form.getByRole('textbox', { name: 'Outflow' })).toHaveValue('');
    await form.getByRole('textbox', { name: 'Outflow' }).fill('12.34');
    await expect(form.getByRole('textbox', { name: 'Inflow' })).toHaveValue('');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(header(page)).toContainText('$987.66');
  });

  test('a split transaction counts once toward the balance', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { payee: 'Big Box Store', outflow: '100' });
    const form = newForm(page);
    await form.getByRole('button', { name: 'Split transaction' }).click();
    await form
      .getByRole('combobox', { name: 'Split 1 category' })
      .selectOption({ label: 'Groceries' });
    await form.getByRole('textbox', { name: 'Split 1 amount' }).fill('60');
    await expect(form.getByText('$40 remaining')).toBeVisible();
    await form
      .getByRole('combobox', { name: 'Split 2 category' })
      .selectOption({ label: 'Rent / Mortgage' });
    await form.getByRole('textbox', { name: 'Split 2 amount' }).fill('40');
    await expect(form.getByText('Balanced')).toBeVisible();
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Split (2)' })).toBeVisible();
    // $1,000 − $100, not − $200
    await expect(header(page)).toContainText('$900');
    expect(await api.balance(checking.id)).toBe(90_000);

    const [parent] = await api.transactions(`?account_id=${checking.id}`);
    const parts = parent.children.map((c: { amount: number }) => c.amount);
    expect(parts.sort((a: number, b: number) => a - b)).toEqual([-6_000, -4_000]);
  });

  test('a transfer moves money between two accounts', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { category: 'Transfer: Rainy Day Savings', outflow: '250' });
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Transfer to Rainy Day Savings')).toBeVisible();
    expect(await api.balance(checking.id)).toBe(75_000);
    expect(await api.balance(savings.id)).toBe(525_000);

    // Deleting one side removes it and unlinks the other
    const [out] = await api.transactions(`?account_id=${checking.id}`);
    await api.call('DELETE', `/transactions/${out.id}`);
    const [other] = await api.transactions(`?account_id=${savings.id}`);
    expect(other.transferTransactionId).toBeNull();
  });

  test('edits the category, payee, date and notes from the detail panel', async ({ page, api }) => {
    const { checking } = await setup(api);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    // Rows open with the keyboard too
    await row(page, 'Streamflix').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Transaction details')).toBeVisible();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });

    // Category via the searchable picker
    await panel.getByRole('button', { name: 'Uncategorised' }).click();
    await page.getByPlaceholder('Search categories...').fill('stream');
    await page.getByRole('button', { name: /Streaming Services/ }).click();

    await panel.getByRole('textbox', { name: 'Notes' }).fill('family plan');
    await panel.getByRole('textbox', { name: 'Notes' }).blur();
    await panel.getByRole('textbox', { name: 'Date' }).fill(otherDayThisMonth());
    await panel.getByRole('textbox', { name: 'Date' }).blur();

    await expect
      .poll(async () => (await api.transactions(`?account_id=${checking.id}`))[0])
      .toMatchObject({
        id: tx.id,
        notes: 'family plan',
        date: otherDayThisMonth(),
        categoryId: (await api.category('Streaming Services')).id,
      });
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page.getByText('Transaction details')).toBeHidden();
  });

  test('steps through the listed rows from the detail panel, keeping edits', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    // Newest first: Grocery, (Streamflix), Bakery, Cafe. A search for "corner" leaves out Streamflix
    for (const [i, payeeName] of [
      'Corner Grocery',
      'Streamflix',
      'Corner Bakery',
      'Corner Cafe',
    ].entries())
      await api.createTransaction({
        accountId: checking.id,
        date: isoDay(-i),
        amount: -(1_000 + i * 100),
        payeeName,
      });
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'All time' }).click();
    await page.getByPlaceholder('Search payee or notes…').fill('corner');
    await expect(page.getByText('3 transactions', { exact: true })).toBeVisible();

    await row(page, 'Corner Grocery').focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const previous = panel.getByRole('button', { name: 'Previous transaction' });
    const next = panel.getByRole('button', { name: 'Next transaction' });
    await expect(panel.getByText('Corner Grocery', { exact: true })).toBeVisible();
    await expect(previous).toBeDisabled();

    // A note typed but not yet saved is saved to its own transaction when moving on
    await panel.getByRole('textbox', { name: 'Notes' }).fill('bread');
    await next.click();
    await expect(panel.getByText('Corner Bakery', { exact: true })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Notes' })).toHaveValue('');

    // The keyboard reaches both buttons, and focus stays put at the last row
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(panel.getByText('Corner Cafe', { exact: true })).toBeVisible();
    await expect(next).toBeDisabled();
    await page.keyboard.press('Enter');
    await expect(panel.getByText('Corner Cafe', { exact: true })).toBeVisible();
    await expect(next).toBeFocused();
    await previous.click();
    await expect(panel.getByText('Corner Bakery', { exact: true })).toBeVisible();

    // Closing hands the keyboard back to the row that was open
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(row(page, 'Corner Bakery')).toBeFocused();

    // Only the typed note was written
    const saved = await api.transactions(`?account_id=${checking.id}`);
    const notes = Object.fromEntries(saved.map((t) => [t.payeeName, t.notes]));
    expect(notes).toEqual({
      'Corner Grocery': 'bread',
      Streamflix: null,
      'Corner Bakery': null,
      'Corner Cafe': null,
    });
  });

  test('deletes a transaction after confirming', async ({ page, api }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Oops Store',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Oops Store').click();
    const details = page.getByRole('complementary', { name: 'Transaction details' });
    // Delete is in the details' menu, not a big red button; Done is the main action
    await expect(details.getByRole('button', { name: 'Delete transaction' })).toHaveCount(0);
    await expect(details.getByRole('button', { name: 'Done' })).toBeVisible();
    await details.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete transaction' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No transactions yet')).toBeVisible();
    expect(await api.balance(checking.id)).toBe(100_000);
  });

  test('opening the details menu while the panel slides in keeps it open', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Oops Store',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Oops Store').click();
    const details = page.getByRole('complementary', { name: 'Transaction details' });
    await expect(details).toBeVisible();
    // Hold the panel part-way through its slide-in (the translate it animates) and focus ⋮, as
    // Tab or a click's scroll-into-view does then. No box around ⋮ may scroll: the slide kept
    // moving that scroll position, and the scroll events closed a ⋮ menu opened then
    const scrolled = await details.evaluate((aside) => {
      const slide = aside.parentElement!;
      slide.style.transition = 'none';
      slide.style.translate = '50% 0';
      aside.querySelector<HTMLElement>('button[aria-label="More actions"]')!.focus();
      let max = 0;
      for (let el = slide.parentElement; el; el = el.parentElement)
        max = Math.max(max, el.scrollLeft);
      slide.style.translate = '';
      slide.style.transition = '';
      return max;
    });
    expect(scrolled).toBe(0);
    await details.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete transaction' })).toBeVisible();
  });

  test('details link the payee, category and account to the filtered register', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_234,
      payeeName: 'Corner Grocery',
      categoryId: groceries.id,
    });
    await api.createTransaction({
      accountId: savings.id,
      date: isoDay(),
      amount: -999,
      payeeName: 'Other Shop',
      categoryId: groceries.id,
    });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -500,
      payeeName: 'Bus Fare',
    });
    const details = page.getByRole('complementary', { name: 'Transaction details' });
    const openDetails = async () => {
      await open(page, '/transactions');
      // One click model (#243): the payee text is part of the row, and opens the details
      await row(page, 'Corner Grocery').getByText('Corner Grocery', { exact: true }).click();
      await expect(details).toBeVisible();
    };

    await openDetails();
    await details.getByRole('link', { name: 'All Corner Grocery transactions' }).click();
    await expect(details).toBeHidden();
    await expect(row(page, 'Corner Grocery')).toBeVisible();
    await expect(row(page, 'Other Shop')).toHaveCount(0);
    await expect(row(page, 'Bus Fare')).toHaveCount(0);

    await openDetails();
    await details.getByRole('link', { name: 'All Groceries transactions' }).click();
    await expect(row(page, 'Other Shop')).toBeVisible();
    await expect(row(page, 'Corner Grocery')).toBeVisible();
    await expect(row(page, 'Bus Fare')).toHaveCount(0);

    await openDetails();
    await details.getByRole('link', { name: 'All Everyday Checking transactions' }).click();
    await expect(row(page, 'Bus Fare')).toBeVisible();
    await expect(row(page, 'Corner Grocery')).toBeVisible();
    await expect(row(page, 'Other Shop')).toHaveCount(0);

    // The payee's name opens its own page (#235)
    await openDetails();
    await details.getByRole('link', { name: 'Payee page for Corner Grocery' }).click();
    await expect(page).toHaveURL(/#\/payees\/[\w-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Corner Grocery' })).toBeVisible();
  });

  test('searches and filters by date range', async ({ page, api }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_000,
      payeeName: 'Coffee Corner',
    });
    await api.createTransaction({
      accountId: checking.id,
      date: '2020-06-15',
      amount: -2_000,
      payeeName: 'Old Bookshop',
    });
    await open(page, `/accounts/${checking.id}`);
    // "This month" by default: the 2020 purchase is hidden
    await expect(row(page, 'Coffee Corner')).toBeVisible();
    await expect(row(page, 'Old Bookshop')).toBeHidden();

    await page.getByRole('button', { name: 'All time' }).click();
    await expect(page.getByText('2 transactions')).toBeVisible();
    await page.getByPlaceholder('Search payee or notes…').fill('book');
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    await expect(row(page, 'Old Bookshop')).toBeVisible();
  });

  test('the all-transactions page lists every account', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1,
      payeeName: 'A-Mart',
    });
    await api.createTransaction({
      accountId: savings.id,
      date: isoDay(),
      amount: 2,
      payeeName: 'B-Bank',
    });
    await open(page, '/transactions');
    await expect(row(page, 'A-Mart')).toBeVisible();
    await expect(row(page, 'B-Bank')).toBeVisible();
    // The account column names each row's account (its register is linked from the details)
    await expect(row(page, 'B-Bank')).toContainText('Rainy Day Savings');
  });

  test('combines filters, summarises the selection and keeps it in the link', async ({
    page,
    api,
  }) => {
    // The phase 8 fixture (docs/MONARCH-DEVELOPMENT-PHASE.md), mock data only
    const { checking, savings } = await setup(api);
    const day = isoDay();
    for (const [accountId, amount, payeeName] of [
      [checking.id, 200_000, 'Mock payroll'],
      [checking.id, -12_000, 'Mock grocer'],
      [checking.id, -4_500, 'Mock cafe'],
      [checking.id, -9_000, 'Mock grocer'],
      [savings.id, -20_000, 'Mock grocer'],
    ] as const) {
      await api.createTransaction({ accountId, date: day, amount, payeeName });
    }
    await open(page, '/transactions');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('tab', { name: 'Accounts', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Everyday Checking' }).check();
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await page.getByRole('button', { name: 'Money out', exact: true }).click();
    await page.getByLabel('At least').fill('100.01');
    await page.getByLabel('At least').press('Enter');

    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    await expect(row(page, 'Mock grocer')).toHaveCount(1);
    await expect(
      page.getByRole('term').filter({ hasText: 'Money out' }).locator('..').getByRole('definition'),
    ).toHaveText('$120');

    // The selection is in the URL: a reload keeps it
    await page.reload();
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText('5 transactions', { exact: true })).toBeVisible();

    // Search covers payees across accounts
    await page.getByPlaceholder('Search payee or notes…').fill('grocer');
    await expect(page.getByText('3 transactions', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('term').filter({ hasText: 'Money out' }).locator('..').getByRole('definition'),
    ).toHaveText('$410');
  });
});

test('the Add transaction dialog makes transfers too', async ({ page, api }) => {
  const { checking, savings } = await setup(api);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });

  await dialog.getByRole('button', { name: 'Credit' }).click();
  await typeAmount(dialog.getByLabel('Amount', { exact: true }), '300');
  await dialog.getByRole('button', { name: /Select account/ }).click();
  await dialog.getByRole('button', { name: /Everyday Checking/ }).click();
  await dialog.getByRole('button', { name: /^Category:/ }).click();
  await dialog.getByRole('button', { name: 'Transfer: Rainy Day Savings' }).click();

  // A transfer is named after the other account, so it needs no payee
  await expect(dialog.getByText('Payee *')).toBeHidden();
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();

  // A credit brings the money into the chosen account
  expect(await api.balance(checking.id)).toBe(130_000);
  expect(await api.balance(savings.id)).toBe(470_000);
  const [into] = await api.transactions(`?account_id=${checking.id}`);
  expect(into.transferTransactionId).not.toBeNull();
});

test('the Add transaction dialog lists transfers before an account is chosen (#89)', async ({
  page,
  api,
}) => {
  const { checking, savings } = await setup(api);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });

  await typeAmount(dialog.getByLabel('Amount', { exact: true }), '200');
  // The category list ends with every account as "Transfer: name", as the guide says
  await dialog.getByRole('button', { name: /^Category:/ }).click();
  await dialog.getByRole('button', { name: 'Transfer: Rainy Day Savings' }).click();

  // A debit transfer asks where the money comes from, and can't come from the same account
  await expect(dialog.getByText('From account *')).toBeVisible();
  await dialog.getByRole('button', { name: /Select account/ }).click();
  await expect(dialog.getByRole('button', { name: /Rainy Day Savings/ })).toHaveCount(1);
  await dialog.getByRole('button', { name: /Everyday Checking/ }).click();
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();

  expect(await api.balance(checking.id)).toBe(80_000);
  expect(await api.balance(savings.id)).toBe(520_000);
});

test('an inflow marked as a transfer brings the money in from the other account', async ({
  page,
  api,
}) => {
  const { checking, savings } = await setup(api);
  await open(page, `/accounts/${checking.id}`);
  await fillNewTransaction(page, { category: 'Transfer: Rainy Day Savings', inflow: '100' });
  await newForm(page).getByRole('button', { name: 'Save' }).click();

  await expect(row(page, 'Transfer from Rainy Day Savings')).toBeVisible();
  expect(await api.balance(checking.id)).toBe(110_000);
  expect(await api.balance(savings.id)).toBe(490_000);
});

/** Bank rows, as a CSV import or bank sync brings them in */
async function importRows(
  api: Api,
  accountId: string,
  rows: { date: string; amount: number; payeeName: string }[],
) {
  await api.call('POST', '/transactions/import/confirm', {
    accountId,
    rows: rows.map((r, i) => ({ ...r, importedId: `${accountId}-${i}` })),
  });
}

test.describe('transfers between existing transactions (#89)', () => {
  test('an existing transaction becomes a transfer from its category, and back', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await importRows(api, checking.id, [
      { date: isoDay(), amount: -25_000, payeeName: 'ONLINE TRANSFER 0042' },
    ]);
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'ONLINE TRANSFER 0042').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });

    await panel.getByRole('button', { name: 'Uncategorised' }).click();
    await page.getByPlaceholder('Search categories...').fill('transfer');
    await page.getByRole('button', { name: 'Transfer: Rainy Day Savings' }).click();

    // Nothing matched in savings, so the other side was created there
    await expect(panel.getByRole('button', { name: 'Not a transfer' })).toBeVisible();
    await expect(row(page, 'Transfer to Rainy Day Savings')).toBeVisible();
    expect(await api.balance(checking.id)).toBe(75_000);
    expect(await api.balance(savings.id)).toBe(525_000);

    await panel.getByRole('button', { name: 'Not a transfer' }).click();
    await expect(panel.getByRole('button', { name: 'Uncategorised' })).toBeVisible();
    const [tx] = await api.transactions(`?account_id=${checking.id}`);
    expect(tx).toMatchObject({ transferTransactionId: null, payeeName: 'ONLINE TRANSFER 0042' });
  });

  test('both sides imported from the banks are suggested and linked', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    const card = await api.createAccount('Travel Card', -30_000, 'credit');
    await importRows(api, checking.id, [
      { date: isoDay(), amount: -30_000, payeeName: 'CARD PAYMENT' },
      { date: isoDay(), amount: -4_000, payeeName: 'CORNER GROCERY' },
    ]);
    await importRows(api, card.id, [
      { date: isoDay(), amount: 30_000, payeeName: 'PAYMENT RECEIVED' },
    ]);
    // Looks like a transfer (same amount, same day, another account) but isn't one
    await importRows(api, savings.id, [{ date: isoDay(), amount: 4_000, payeeName: 'INTEREST' }]);
    const before = [await api.balance(checking.id), await api.balance(card.id)];

    await open(page, `/accounts/${checking.id}`);
    const banner = page.getByRole('region', { name: 'Possible transfers' });
    await expect(banner).toContainText('2 possible transfers');
    await banner.getByRole('button', { name: 'Review' }).click();
    const dialog = page.getByRole('dialog', { name: 'Possible transfers' });
    // The grocery run and the interest only look alike: say so, and it's not suggested again
    await dialog
      .getByRole('button', { name: /Not a transfer: \$40 from Everyday Checking/ })
      .click();
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Link 1 transfer' }).click();
    await expect(dialog).toBeHidden();
    await expect(banner).toContainText('Linked 1 transfer.');

    await expect(row(page, 'Transfer to Travel Card')).toBeVisible();
    await expect(row(page, 'CORNER GROCERY')).toBeVisible();
    // Linking moves no money: both sides were already there
    expect([await api.balance(checking.id), await api.balance(card.id)]).toEqual(before);
    const [payment] = await api.transactions(`?account_id=${card.id}`);
    expect(payment).toMatchObject({ payeeName: 'Transfer: Everyday Checking' });
    expect(payment.transferTransactionId).not.toBeNull();
  });
});

test('categorises a transfer across the budget boundary without changing either bank row', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Budget checking', 100_000);
  const retirement = await api.createAccount('Retirement tracking', 0, 'retirement');
  await importRows(api, checking.id, [
    { date: isoDay(), amount: -10_000, payeeName: 'CONTRIBUTION' },
  ]);
  await importRows(api, retirement.id, [{ date: isoDay(), amount: 10_000, payeeName: 'RECEIVED' }]);
  const [out] = await api.transactions(`?account_id=${checking.id}`);
  const [into] = await api.transactions(`?account_id=${retirement.id}`);
  await api.call('POST', '/transactions/transfers/link', {
    transactionId: out.id,
    otherTransactionId: into.id,
  });
  await open(page, `/accounts/${checking.id}`);
  await row(page, 'Transfer to Retirement tracking').click();
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel.getByText(/Transfer across the budget boundary/)).toBeVisible();
  await panel.getByRole('button', { name: 'Uncategorised', exact: true }).click();
  await page.getByPlaceholder('Search categories...').fill('Savings');
  await page.getByRole('button', { name: /Savings$/ }).click();
  await expect(panel.getByRole('button', { name: /Savings$/ })).toBeVisible();
  const [reviewed] = await api.transactions(`?account_id=${checking.id}`);
  expect(reviewed).toMatchObject({
    id: out.id,
    importedId: out.importedId,
    amount: -10_000,
    categoryId: (await api.category('Savings')).id,
    transferTransactionId: into.id,
  });
  const [counterpart] = await api.transactions(`?account_id=${retirement.id}`);
  expect(counterpart).toMatchObject({
    id: into.id,
    importedId: into.importedId,
    amount: 10_000,
    categoryId: null,
  });
  await panel.getByRole('button', { name: 'Not a transfer', exact: true }).click();
  await expect(row(page, 'CONTRIBUTION')).toBeVisible();
  expect((await api.transactions(`?account_id=${checking.id}`))[0].categoryId).toBe(
    reviewed.categoryId,
  );
});

test('sending a new transaction twice (offline retry) saves it once', async ({ api }) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  const savings = await api.createAccount('Savings', 0, 'savings');
  const post = (path: string, data: object) => api.request.post(`/api${path}`, { data });

  const tx = {
    id: 'offline-tx-00000000001',
    accountId: checking.id,
    date: isoDay(),
    amount: -475,
    payeeName: 'Coffee Cart',
  };
  const first = await post('/transactions', tx);
  expect(first.status()).toBe(201);
  const again = await post('/transactions', { ...tx, amount: -999_999 });
  // The same saved transaction comes back; nothing new is created or changed
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ id: tx.id, amount: -475 });

  const split = {
    id: 'offline-split-000000001',
    accountId: checking.id,
    date: isoDay(),
    amount: -3_000,
    payeeName: 'Market',
    splits: [
      { categoryId: null, amount: -1_000 },
      { categoryId: null, amount: -2_000 },
    ],
  };
  expect((await post('/transactions', split)).status()).toBe(201);
  const splitAgain = await post('/transactions', split);
  expect(splitAgain.status()).toBe(200);
  expect((await splitAgain.json()).children).toHaveLength(2);

  const transfer = {
    id: 'offline-transfer-000001',
    fromAccountId: checking.id,
    toAccountId: savings.id,
    date: isoDay(),
    amount: 10_000,
  };
  expect((await post('/transactions/transfer', transfer)).status()).toBe(201);
  const transferAgain = await post('/transactions/transfer', transfer);
  expect(transferAgain.status()).toBe(200);
  expect(await transferAgain.json()).toHaveLength(2);

  // Ids from a device must look like ids
  expect((await post('/transactions', { ...tx, id: 'short' })).status()).toBe(400);
  expect((await post('/transactions', { ...tx, id: 'has spaces in it, 1234' })).status()).toBe(400);

  const rows = await api.call<{ id: string }[]>('GET', '/transactions');
  expect(rows.filter((r) => r.id === tx.id)).toHaveLength(1);
  // Balances count each one once: 1,000.00 − 4.75 − 30.00 − 100.00
  const accounts = await api.accounts();
  expect(accounts.find((a) => a.id === checking.id)!.balance).toBe(100_000 - 475 - 3_000 - 10_000);
  expect(accounts.find((a) => a.id === savings.id)!.balance).toBe(10_000);
});

/** Seeds `count` transactions of -$1.00, one a day going back from today ("Shop 0" is today) */
async function seedDaily(api: Api, accountId: string, count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    date: isoDay(-i),
    amount: -100,
    payeeName: `Shop ${i}`,
    importedId: `seed-${i}`,
  }));
  await api.call('POST', '/transactions/import/confirm', { accountId, rows });
}

test.describe('long histories', () => {
  test('the register lists every transaction, drawing them a page at a time', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    await seedDaily(api, checking.id, 650);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'All time' }).click();

    await expect(page.getByText('650 transactions', { exact: true })).toBeVisible();
    await expect(page.getByText('Showing 300 of 650 transactions')).toBeVisible();
    await expect(page.getByTestId('transaction-row')).toHaveCount(300);
    await page.getByRole('button', { name: 'Show 300 more' }).click();
    await page.getByRole('button', { name: 'Show 50 more' }).click();
    await expect(row(page, 'Shop 649')).toBeVisible();
    await expect(page.getByTestId('transaction-row')).toHaveCount(650);
    await expect(page.getByRole('button', { name: /^Show \d+ more$/ })).toHaveCount(0);
  });

  test('search finds transactions that are not drawn yet', async ({ page, api }) => {
    const { checking } = await setup(api);
    await seedDaily(api, checking.id, 650);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'All time' }).click();
    await expect(row(page, 'Shop 649')).toHaveCount(0);

    await page.getByPlaceholder('Search payee or notes…').fill('Shop 649');
    await expect(row(page, 'Shop 649')).toBeVisible();
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
  });

  test('reconcile counts every unreconciled transaction', async ({ page, api }) => {
    const { checking } = await setup(api);
    await seedDaily(api, checking.id, 250);
    await open(page, `/accounts/${checking.id}/reconcile`);
    // The opening screen shows the full dated register, rather than the unselected base.
    await expect(page.getByText('Current register balance').locator('..')).toContainText('$750');
    await page.getByRole('button', { name: 'Start Reconciliation' }).click();
    await expect(page.getByText('Shop 249')).toBeVisible();
  });
});

test.describe('Add transaction from any page (#222, #223)', () => {
  const sidebarAdd = (page: Page) =>
    page.getByRole('complementary').getByRole('button', { name: 'Add a transaction' });

  test("opens on Amount, with the page's account or else the last one used", async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    const dialog = page.getByRole('dialog', { name: 'Add transaction' });
    const amount = dialog.getByLabel('Amount', { exact: true });

    // On an account's page: that account
    await open(page, `/accounts/${savings.id}`);
    await sidebarAdd(page).click();
    await expect(amount).toBeFocused();
    await expect(dialog.getByRole('button', { name: /Rainy Day Savings/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // From the dashboard, with none used yet on this device: no account until one is chosen
    await open(page, '/dashboard');
    await sidebarAdd(page).click();
    await expect(amount).toBeFocused();
    await page.keyboard.type('12.50');
    await dialog.getByPlaceholder('Search payees...').fill('Corner cafe');
    await dialog.getByRole('button', { name: /Create new payee/ }).click();
    await dialog.getByRole('button', { name: /Select account/ }).click();
    await dialog.getByRole('button', { name: /Everyday Checking/ }).click();
    await dialog.getByRole('button', { name: 'Add transaction' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => api.balance(checking.id)).toBe(100_000 - 1_250);

    // Next time, on any page (here with N): the account used last
    await open(page, '/reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
    await page.keyboard.press('n');
    await expect(amount).toBeFocused();
    // A fresh form: not the amount typed last time
    await expect(amount).toHaveValue('');
    await expect(dialog.getByRole('button', { name: /Everyday Checking/ })).toBeVisible();
  });

  test('a closed account is never chosen for you', async ({ page, api }) => {
    const old = await api.createAccount('Old savings', 0);
    await api.createAccount('Everyday Checking', 100_000);
    // Closing is DELETE (an account at zero); it stays in the database as closed
    await api.call('DELETE', `/accounts/${old.id}`);
    await open(page, `/accounts/${old.id}`);
    await sidebarAdd(page).click();
    const dialog = page.getByRole('dialog', { name: 'Add transaction' });
    await expect(dialog.getByRole('button', { name: /Select account/ })).toBeVisible();
  });
});

test.describe('one click model on desktop rows (#243) and Back (#245)', () => {
  test('a click anywhere opens details; the category is the one inline edit, with Undo', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_250,
      payeeName: 'Mock Bakery',
    });
    await open(page, `/accounts/${checking.id}`);
    const details = page.getByRole('complementary', { name: 'Transaction details' });

    // The payee text is part of the row: no inline payee picker any more
    await row(page, 'Mock Bakery').getByText('Mock Bakery', { exact: true }).click();
    await expect(details).toBeVisible();
    await expect(page.getByPlaceholder('Search payees...')).toHaveCount(0);
    await details.getByRole('button', { name: 'Close details' }).click();
    // A double click does nothing more than a click
    await row(page, 'Mock Bakery').getByText('Mock Bakery', { exact: true }).dblclick();
    await expect(details).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search categories' })).toHaveCount(0);
    await details.getByRole('button', { name: 'Close details' }).click();
    // The row-end Edit is always shown
    await page.getByRole('button', { name: 'Edit details for Mock Bakery' }).click();
    await expect(details).toBeVisible();
    await details.getByRole('button', { name: 'Close details' }).click();
    // No hover-only arrows
    await expect(page.getByRole('button', { name: /^Show all "/ })).toHaveCount(0);

    const pill = page.getByRole('button', { name: 'Category for Mock Bakery: Uncategorised' });
    await expect(pill).toBeVisible();
    await pill.click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(details).toBeHidden();
    const toast = page.getByTestId('undo-toast');
    await expect(toast).toContainText('Mock Bakery categorised as Groceries.');
    // Undo reverses exactly the category: a note added since stays
    await api.call('PUT', `/transactions/${tx.id}`, { notes: 'Added elsewhere' });
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect
      .poll(async () => (await api.transactions()).find((t) => t.id === tx.id)?.categoryId)
      .toBeNull();
    expect((await api.transactions()).find((t) => t.id === tx.id)?.notes).toBe('Added elsewhere');
  });

  test("Back returns to an account's filters and the register's scroll; a fresh visit starts afresh", async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    for (let i = 0; i < 60; i++) {
      await api.createTransaction({
        accountId: checking.id,
        date: isoDay(-i),
        amount: -(100 + i),
        payeeName: `Mock Shop ${String(i).padStart(2, '0')}`,
      });
    }
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'All time' }).click();
    await expect(page).toHaveURL(/range=all/);
    const register = row(page, 'Mock Shop 00')
      .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]')
      .first();
    await register.evaluate((el) => (el.scrollTop = 1200));
    await expect.poll(() => register.evaluate((el) => el.scrollTop)).toBe(1200);
    await row(page, 'Mock Shop 30').click();
    const before = await register.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(500);
    const details = page.getByRole('complementary', { name: 'Transaction details' });
    await details.getByRole('link', { name: 'Payee page for Mock Shop 30' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mock Shop 30' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/range=all/);
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    await expect.poll(() => register.evaluate((el) => el.scrollTop)).toBe(before);

    // A fresh visit: default filters, at the top
    await open(page, `/accounts/${checking.id}`);
    await expect(row(page, 'Mock Shop 59')).toHaveCount(0);
    await expect.poll(() => register.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('a filter change keeps the scroll for Back, though it replaces the history entry', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    for (let i = 0; i < 60; i++) {
      await api.createTransaction({
        accountId: checking.id,
        date: isoDay(-i),
        amount: -(100 + i),
        payeeName: `Mock Shop ${String(i).padStart(2, '0')}`,
      });
    }
    await open(page, `/accounts/${checking.id}?range=all`);
    const register = row(page, 'Mock Shop 00')
      .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]')
      .first();
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    // Every row is uncategorised, so with both lists loaded once, the filter swaps one list for
    // the same rows at once, and the page keeps its offset while the URL entry is replaced
    const uncategorised = page.getByRole('button', { name: 'Uncategorised', exact: true }).first();
    await uncategorised.click();
    await expect(page).toHaveURL(/uncategorized=1/);
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    await uncategorised.click();
    await expect(page).not.toHaveURL(/uncategorized=1/);
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    await register.evaluate((el) => (el.scrollTop = 1200));
    await expect.poll(() => register.evaluate((el) => el.scrollTop)).toBe(1200);
    await uncategorised.click();
    await expect(page).toHaveURL(/uncategorized=1/);
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    const before = await register.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(500);
    // Away without scrolling the list, then Back
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Budget' })
      .click();
    await expect(page).toHaveURL(/#\/budget/);
    await page.goBack();
    await expect(page).toHaveURL(/uncategorized=1/);
    await expect(row(page, 'Mock Shop 59')).toBeAttached();
    await expect.poll(() => register.evaluate((el) => el.scrollTop)).toBe(before);
  });

  for (const phone of [false, true]) {
    test(`the follow-up and undo toasts form one tidy stack${phone ? ' on a phone' : ''}`, async ({
      page,
      api,
    }) => {
      if (phone) await page.setViewportSize({ width: 390, height: 844 });
      const { checking } = await setup(api);
      for (const day of [0, -1]) {
        await api.createTransaction({
          accountId: checking.id,
          date: isoDay(day),
          amount: -1_250,
          payeeName: 'Mock Bakery',
        });
      }
      await open(page, `/accounts/${checking.id}`);
      if (phone) {
        await page.getByTestId('transaction-card').first().click();
        const panel = page.getByRole('complementary', { name: 'Transaction details' });
        await panel.getByRole('button', { name: 'Uncategorised' }).click();
      } else {
        await page
          .getByRole('button', { name: 'Category for Mock Bakery: Uncategorised' })
          .first()
          .click();
      }
      await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
      await page.keyboard.press('Enter');
      const followup = page.getByRole('status', { name: 'Category follow-up' });
      const undo = page.getByTestId('undo-toast');
      await expect(followup).toBeVisible();
      await expect(undo).toBeVisible();
      const a = (await followup.boundingBox())!;
      const b = (await undo.boundingBox())!;
      // One column: the same width and centre, one gap, the undo toast under the follow-up
      expect(Math.round(a.width)).toBe(Math.round(b.width));
      expect(Math.round(a.x)).toBe(Math.round(b.x));
      expect(Math.round(b.y - (a.y + a.height))).toBe(8);
      const view = page.viewportSize()!;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(view.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(view.width);
      if (phone) {
        const tabs = (await page.getByRole('navigation', { name: 'Main pages' }).boundingBox())!;
        expect(b.y + b.height).toBeLessThanOrEqual(tabs.y);
      }
      // It names the change, from the register and from the details alike
      await expect(undo).toContainText('Mock Bakery categorised as Groceries.');
      // Neither toast lost its actions
      await expect(
        followup.getByRole('button', { name: 'Always use for this payee' }),
      ).toBeVisible();
      await expect(undo.getByRole('button', { name: 'Undo' })).toBeVisible();
    });
  }
});

test("a payee's page leaves out other accounts' transfer suggestions (#235)", async ({
  page,
  api,
}) => {
  const { checking } = await setup(api);
  const card = await api.createAccount('Travel Card', -30_000, 'credit');
  await importRows(api, checking.id, [
    { date: isoDay(), amount: -30_000, payeeName: 'CARD PAYMENT' },
    { date: isoDay(), amount: -1_000, payeeName: 'Mock Bakery' },
  ]);
  await importRows(api, card.id, [
    { date: isoDay(), amount: 30_000, payeeName: 'PAYMENT RECEIVED' },
  ]);
  // The account's register offers the pair
  await open(page, `/accounts/${checking.id}`);
  await expect(page.getByRole('region', { name: 'Possible transfers' })).toBeVisible();
  const bakery = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
    (p) => p.name === 'Mock Bakery',
  )!;
  await open(page, `/payees/${bakery.id}`);
  await expect(row(page, 'Mock Bakery')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Possible transfers' })).toHaveCount(0);
});

test("a scoped page's URL can't add a filter on its own account (#245)", async ({ page, api }) => {
  const { checking, savings } = await setup(api);
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -1_000,
    payeeName: 'Mock Bakery',
  });
  await open(page, `/accounts/${checking.id}?account_ids=${savings.id}&range=all`);
  await expect(row(page, 'Mock Bakery')).toBeVisible();
  // No filter count on the Filters button, as no filter narrows this list
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
});

test("a category's and a payee's page don't offer their own dimension as a filter (#245)", async ({
  page,
  api,
}) => {
  const { checking } = await setup(api);
  const groceries = await api.category('Groceries');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -1_000,
    payeeName: 'Mock Bakery',
    categoryId: groceries.id,
  });
  const panelTabs = () => page.getByRole('tablist').getByRole('tab');

  await open(page, `/budget/category/${groceries.id}`);
  await expect(row(page, 'Mock Bakery')).toBeVisible();
  // No "Uncategorised" quick filter, no Categories section
  await expect(page.getByRole('button', { name: 'Uncategorised', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(panelTabs().filter({ hasText: 'Payees' })).toBeVisible();
  await expect(panelTabs().filter({ hasText: 'Categories' })).toHaveCount(0);

  const bakery = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
    (p) => p.name === 'Mock Bakery',
  )!;
  await open(page, `/payees/${bakery.id}`);
  await expect(row(page, 'Mock Bakery')).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(panelTabs().filter({ hasText: 'Categories' })).toBeVisible();
  await expect(panelTabs().filter({ hasText: 'Payees' })).toHaveCount(0);
});
