import type { Page } from '@playwright/test';
import {
  test,
  expect,
  open,
  isoDay,
  otherDayThisMonth,
  typeAmount,
  categoryOption,
  chooseOption,
  fillDate,
  setToggle,
  tokenColour,
  type Api,
} from './fixtures';
import { startDesktopServer, stopDesktopServer } from './serverControl';

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
  if (fields.payee) {
    const payee = form.getByRole('combobox', { name: 'Payee' });
    await payee.fill(fields.payee);
    // React Aria hide-outside: Tab closes the list (02-19 checkpoint decision, option 1)
    await payee.press('Tab');
  }
  if (fields.category) {
    // The category button opens the searchable picker (D-05)
    await form.getByRole('button', { name: /^Category:/ }).click();
    await categoryOption(form, fields.category, { exact: true }).click();
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
    // The shared CurrencyInput formats an amount once it is left
    await expect(form.getByRole('textbox', { name: 'Outflow' })).toHaveValue('$12.34');
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
    await form.getByRole('button', { name: /^Split 1 category:/ }).click();
    await categoryOption(form, 'Groceries', { exact: true }).click();
    await form.getByRole('textbox', { name: 'Split 1 amount' }).fill('60');
    await expect(form.getByText('$40 remaining')).toBeVisible();
    await form.getByRole('button', { name: /^Split 2 category:/ }).click();
    await categoryOption(form, 'Rent / Mortgage', { exact: true }).click();
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
    await categoryOption(page, /Streaming Services/).click();

    await panel.getByRole('textbox', { name: 'Notes' }).fill('family plan');
    await panel.getByRole('textbox', { name: 'Notes' }).blur();
    // The date is the shared DatePicker (D-07): typed into its segments, saved once it is left
    await fillDate(panel, 'Date', otherDayThisMonth());
    // Leave it: the segment holding focus depends on the Date format's order
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

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

  // D-07 / 03-RESEARCH Pitfall 2: a day picked from the calendar, or Today, saves at once. The
  // field keeps focus after a pick, so a save that waited for it to be left would never come
  test('a day picked in the detail panel saves at once, without leaving the field', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: otherDayThisMonth(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Streamflix').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const saved = async () =>
      (await api.transactions(`?account_id=${checking.id}`)).find((t) => t.id === tx.id)?.date;
    // The register heads each day with its long date (en-US: "19 November 2026")
    const dayHeading = (iso: string) =>
      page.getByText(
        new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        { exact: true },
      );

    // Today, from the calendar's footer
    await panel.getByRole('button', { name: 'Choose from a calendar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Select today' }).click();
    await expect.poll(saved).toBe(isoDay());
    await expect(dayHeading(isoDay())).toBeVisible();
    await expect(row(page, 'Streamflix')).toBeVisible();

    // A day from the grid, by the keyboard: the calendar opens on the chosen day
    await panel.getByRole('button', { name: 'Choose from a calendar' }).click();
    const calendar = page.getByRole('dialog').filter({ has: page.getByRole('grid') });
    await expect(calendar.locator('[role="gridcell"] [data-focused]')).toBeVisible();
    await page.keyboard.press(otherDayThisMonth() < isoDay() ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('Enter');
    await expect(calendar).toHaveCount(0);
    await expect.poll(saved).toBe(otherDayThisMonth());
    await expect(dayHeading(otherDayThisMonth())).toBeVisible();
    // Nothing was left: the panel is open and focus is back in the date field
    await expect(panel).toBeVisible();
    expect(
      await panel
        .getByRole('group', { name: 'Date', exact: true })
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  });

  // 03-13 review WR-01: a day whose save failed is not counted as sent, so choosing it again retries
  test('a picked day whose save failed is sent again when picked again', async ({ page, api }) => {
    const { checking } = await setup(api);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: otherDayThisMonth(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Streamflix').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const saved = async () =>
      (await api.transactions(`?account_id=${checking.id}`)).find((t) => t.id === tx.id)?.date;

    // The first save is refused
    let puts = 0;
    await page.route(new RegExp(`/api/transactions/${tx.id}$`), async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      puts += 1;
      if (puts === 1)
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Refused for the test' }),
        });
      return route.continue();
    });

    const pickToday = async () => {
      await panel.getByRole('button', { name: 'Choose from a calendar' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Select today' }).click();
    };
    await pickToday();
    await expect.poll(() => puts).toBe(1);
    expect(await saved()).toBe(otherDayThisMonth());

    await pickToday();
    await expect.poll(() => puts).toBe(2);
    await expect.poll(saved).toBe(isoDay());
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
    // setToggle, not .check(): the shared Checkbox's visual box covers React Aria's 1 px input
    // once the register filters move onto it (03-24); it clicks the label, as before
    await setToggle(page.getByRole('checkbox', { name: 'Everyday Checking' }));
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
  await dialog.getByRole('combobox', { name: 'Account' }).click();
  await dialog.getByRole('option', { name: /Everyday Checking/ }).click();
  await dialog.getByRole('button', { name: /^Category:/ }).click();
  await categoryOption(dialog, 'Transfer: Rainy Day Savings').click();

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
  await categoryOption(dialog, 'Transfer: Rainy Day Savings').click();

  // A debit transfer asks where the money comes from, and can't come from the same account
  await expect(dialog.getByText('From account *')).toBeVisible();
  await dialog.getByRole('combobox', { name: 'From account' }).click();
  await expect(dialog.getByRole('option', { name: /Everyday Checking/ })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /Rainy Day Savings/ })).toHaveCount(0);
  await dialog.getByRole('option', { name: /Everyday Checking/ }).click();
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
    await categoryOption(page, 'Transfer: Rainy Day Savings').click();

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
  await categoryOption(page, /Savings$/).click();
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
    await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue(
      'Rainy Day Savings',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // From the dashboard, with none used yet on this device: no account until one is chosen
    await open(page, '/dashboard');
    await sidebarAdd(page).click();
    await expect(amount).toBeFocused();
    await page.keyboard.type('12.50');
    await dialog.getByPlaceholder('Search payees...').fill('Corner cafe');
    await dialog.getByRole('button', { name: /Create new payee/ }).click();
    await dialog.getByRole('combobox', { name: 'Account' }).click();
    await dialog.getByRole('option', { name: /Everyday Checking/ }).click();
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
    await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue(
      'Everyday Checking',
    );
  });

  test('a closed account is never chosen for you', async ({ page, api }) => {
    const old = await api.createAccount('Old savings', 0);
    await api.createAccount('Everyday Checking', 100_000);
    // Closing is DELETE (an account at zero); it stays in the database as closed
    await api.call('DELETE', `/accounts/${old.id}`);
    await open(page, `/accounts/${old.id}`);
    await sidebarAdd(page).click();
    const dialog = page.getByRole('dialog', { name: 'Add transaction' });
    await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue('');
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

// The payee field's behaviour, pinned before it moved onto the shared Combobox (#267): these
// tests must pass unchanged on both, apart from the field's role in their selectors. A
// suggestion is found by its text, whatever element draws it.
test.describe('the payee field', () => {
  const suggestion = (page: Page, name: string) => page.getByText(name, { exact: true });

  /** Payees known from another account, so their names are not register rows here */
  async function seedPayees(api: Api, accountId: string, names: string[]) {
    for (const payeeName of names) {
      await api.createTransaction({ accountId, date: isoDay(), amount: -100, payeeName });
    }
  }

  test('suggests payees on focus, names a new one, and keeps a typed or picked name', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery', 'Corner Bakery', 'Fuel Stop']);
    const bakery = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
      (p) => p.name === 'Corner Bakery',
    )!;
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    const form = newForm(page);
    const field = form.getByRole('combobox', { name: 'Payee' });

    await field.click();
    await expect(suggestion(page, 'Fuel Stop')).toBeVisible();

    // Typing narrows the list (letter case ignored) and names the new payee
    await field.fill('corner');
    await expect(suggestion(page, 'Corner Grocery')).toBeVisible();
    await expect(suggestion(page, 'Fuel Stop')).toBeHidden();
    await expect(page.getByText('New payee: "corner"')).toBeVisible();
    // An exact match in any letter case is not a new payee
    await field.fill('CORNER GROCERY');
    await expect(page.getByText(/^New payee:/)).toBeHidden();
    // The hint shows even when nothing matches
    await field.fill('Night Market');
    await expect(page.getByText('New payee: "Night Market"')).toBeVisible();

    // Enter in the field saves nothing and keeps the row open with the typed name
    await field.press('Enter');
    await expect(form).toBeVisible();
    await expect(field).toHaveValue('Night Market');
    expect(await api.transactions(`?account_id=${checking.id}`)).toHaveLength(0);

    // Escape with suggestions open keeps the row and the typed text
    await field.fill('Corner');
    await expect(suggestion(page, 'Corner Bakery')).toBeVisible();
    await field.press('Escape');
    await expect(form).toBeVisible();
    await expect(field).toHaveValue('Corner');

    // Clicking a suggestion sets that payee
    await field.fill('Corner B');
    await suggestion(page, 'Corner Bakery').click();
    await expect(field).toHaveValue('Corner Bakery');
    await form.getByRole('textbox', { name: 'Outflow' }).fill('5');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(row(page, 'Corner Bakery')).toBeVisible();
    const [tx] = await api.transactions(`?account_id=${checking.id}`);
    expect(tx).toMatchObject({ payeeId: bakery.id, payeeName: 'Corner Bakery' });
  });

  test('in the detail panel, Enter keeps the typed name and a suggestion saves at once', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery']);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Streamflix').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const field = panel.getByRole('combobox', { name: 'Payee' });

    await field.fill('Night Market');
    await field.press('Enter');
    await expect(panel).toBeVisible();
    await expect(field).toHaveValue('Night Market');

    await field.fill('corner');
    await suggestion(page, 'Corner Grocery').click();
    await expect(field).toHaveValue('Corner Grocery');
    await expect
      .poll(async () => (await api.transactions(`?account_id=${checking.id}`))[0])
      .toMatchObject({ id: tx.id, payeeName: 'Corner Grocery' });
  });

  // D-12: Escape with the list open closes only the list, as in the add row and the phone
  // sheet; a second Escape, with the list closed, closes the panel
  test('in the detail panel, Escape with suggestions open closes only the list', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery']);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Streamflix').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const field = panel.getByRole('combobox', { name: 'Payee' });
    // Clicked first, as a person does: the click waits for the panel to finish sliding in. A
    // list closes when the panel moves under it, which filling a field still moving does
    await field.click();
    // The field holds the payee's own name, so the list shows only that payee until typing
    await field.fill('corner');
    await expect(suggestion(page, 'Corner Grocery')).toBeVisible();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await field.press('Escape');
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('corner');
    await field.press('Escape');
    await expect(panel).toBeHidden();
  });

  // 02-REVIEW-DISPOSITION residual: a new payee typed in the panel, then Escape for the list and
  // Escape again for the panel, is kept
  test('in the detail panel, a typed payee is kept when two Escapes close the panel', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery']);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Streamflix').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    const field = panel.getByRole('combobox', { name: 'Payee' });
    await field.click();
    await field.fill('Night Market');
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await field.press('Escape');
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await field.press('Escape');
    await expect(panel).toBeHidden();

    await row(page, 'Night Market').click();
    await expect(panel.getByRole('combobox', { name: 'Payee' })).toHaveValue('Night Market');
    expect(
      (await api.transactions(`?account_id=${checking.id}`)).find((t) => t.id === tx.id),
    ).toMatchObject({ payeeName: 'Night Market' });
  });

  // D-12, owner-approved 17 Nov 2026: before the shared Combobox this Escape closed the sheet
  // with the list, losing what was typed; now it closes only the list, and a second Escape
  // closes the sheet
  test('in the phone sheet, Escape with suggestions open closes only the list', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery']);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    const sheet = page.getByRole('dialog', { name: 'New transaction' });
    const field = sheet.getByRole('combobox', { name: 'Payee' });
    // Clicked first, as a person taps it: the click waits for the sheet to finish sliding in.
    // A list closes when the sheet scrolls under it, which filling a field still moving does
    await field.click();
    await field.fill('Corner');
    await expect(suggestion(page, 'Corner Grocery')).toBeVisible();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await field.press('Escape');
    await expect(suggestion(page, 'Corner Grocery')).toBeHidden();
    // The sheet is still open, not fading out, and saves what was typed in it
    await sheet.getByRole('textbox', { name: 'Outflow' }).fill('5');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();
    const [tx] = await api.transactions(`?account_id=${checking.id}`);
    expect(tx).toMatchObject({ amount: -500, payeeName: 'Corner' });

    // With the list closed, Escape closes the sheet
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    await field.click();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await field.press('Escape');
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await field.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('ArrowDown then Enter picks the first suggestion', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await seedPayees(api, savings.id, ['Corner Grocery', 'Corner Bakery']);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    const field = newForm(page).getByRole('combobox', { name: 'Payee' });
    await field.fill('corner');
    await field.press('ArrowDown');
    await field.press('Enter');
    await expect(field).toHaveValue('Corner Grocery');
    await expect(newForm(page)).toBeVisible();
  });
});

// Today's category picker, pinned before it moves onto the shared searchable list (#267, plan
// 02-10). Each test is a rule the other suites do not assert; plan 02-18's wrapper must pass them.
test.describe('category picker', () => {
  /** Opens the detail panel of a Groceries transaction and its category picker */
  async function openPicker(page: Page, api: Api) {
    const { checking } = await setup(api);
    const groceries = await api.category('Groceries');
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_250,
      payeeName: 'Mock Bakery',
      categoryId: groceries.id,
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Mock Bakery').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    await panel.getByRole('button', { name: 'Groceries', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search categories' });
    await expect(search).toBeFocused();
    const categoryId = async () =>
      (await api.transactions(`?account_id=${checking.id}`)).find((t) => t.id === tx.id)
        ?.categoryId;
    return { panel, search, categoryId, groceries };
  }

  test('Enter with nothing typed picks nothing and leaves the picker open', async ({
    page,
    api,
  }) => {
    const { search, categoryId, groceries } = await openPicker(page, api);
    await page.keyboard.press('Enter');
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
    expect(await categoryId()).toBe(groceries.id);
  });

  test('with a search typed the no-category row still shows, and clicking it clears the category', async ({
    page,
    api,
  }) => {
    const { panel, search, categoryId } = await openPicker(page, api);
    await search.fill('gro');
    // The search filters the categories (the panel's own field is also named Groceries)
    await expect(categoryOption(panel, /Streaming Services/)).toHaveCount(0);
    const none = categoryOption(panel, 'Uncategorised', { exact: true });
    await expect(none).toBeVisible();
    await none.click();
    await expect.poll(categoryId).toBeNull();
  });

  test('ArrowDown from an empty search lands on the no-category row, and Enter picks it', async ({
    page,
    api,
  }) => {
    // Only the no-category row clears it, so the outcome shows where ArrowDown landed, with no
    // reliance on how the picker marks its highlighted row
    const { categoryId } = await openPicker(page, api);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(categoryId).toBeNull();
  });

  test('a click outside closes the picker with no change', async ({ page, api }) => {
    const { panel, search, categoryId, groceries } = await openPicker(page, api);
    await panel.getByText('Transaction details', { exact: true }).click();
    await expect(search).toHaveCount(0);
    await expect(panel).toBeVisible();
    expect(await categoryId()).toBe(groceries.id);
  });

  test('Escape inside the Add transaction dialog closes only the picker', async ({ page, api }) => {
    await setup(api);
    await open(page, '/transactions?add=1');
    const dialog = page.getByRole('dialog', { name: 'Add transaction' });
    await dialog.getByRole('button', { name: /^Category:/ }).click();
    const search = dialog.getByRole('textbox', { name: 'Search categories' });
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(search).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Category:/ })).toBeVisible();
  });
});

test.describe('the Split transaction dialog', () => {
  async function openSplit(page: Page, api: Api) {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -10_000,
      payeeName: 'Big Box Store',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Big Box Store').click();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    await panel.getByRole('button', { name: 'Split across categories' }).click();
    return { checking, panel, dialog: page.getByRole('dialog', { name: 'Split transaction' }) };
  }

  test('a part amount formats when left, and text that is not an amount is marked', async ({
    page,
    api,
  }) => {
    const { dialog } = await openSplit(page, api);
    const first = dialog.getByRole('textbox', { name: 'Part 1 amount' });
    await first.fill('60');
    await first.blur();
    await expect(first).toHaveValue('$60');
    await expect(dialog.getByRole('button', { name: 'Left to split: $40' })).toBeVisible();

    const second = dialog.getByRole('textbox', { name: 'Part 2 amount' });
    await second.fill('abc');
    await second.blur();
    await expect(second).toHaveValue('abc');
    await expect(second).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByRole('alert')).toContainText("That isn't an amount.");
    await expect(dialog.getByRole('button', { name: 'Split into 2' })).toBeDisabled();
  });

  test('splits by amount with the category buttons, then changes the parts by percent', async ({
    page,
    api,
  }) => {
    const { checking, panel, dialog } = await openSplit(page, api);
    await dialog.getByRole('button', { name: 'Part 1 category: Uncategorised' }).click();
    await categoryOption(dialog, 'Groceries').click();
    await typeAmount(dialog.getByRole('textbox', { name: 'Part 1 amount' }), '60');
    await dialog.getByRole('button', { name: 'Part 2 category: Uncategorised' }).click();
    await categoryOption(dialog, 'Rent / Mortgage').click();
    await typeAmount(dialog.getByRole('textbox', { name: 'Part 2 amount' }), '40');
    await dialog.getByRole('textbox', { name: 'Part 2 notes' }).fill('half the rent');
    await expect(dialog.getByText('Fully split')).toBeVisible();
    await dialog.getByRole('button', { name: 'Split into 2' }).click();
    await expect(dialog).toBeHidden();

    const groceries = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    const parts = async () => {
      const [parent] = await api.transactions(`?account_id=${checking.id}`);
      return parent.children
        .map((c: { amount: number; categoryId: string; notes: string | null }) => [
          c.amount,
          c.categoryId,
          c.notes,
        ])
        .sort((a: [number], b: [number]) => a[0] - b[0]);
    };
    expect(await parts()).toEqual([
      [-6_000, groceries.id, null],
      [-4_000, rent.id, 'half the rent'],
    ]);

    // By percent the complete parts carry across, and a typed percentage that isn't one is marked
    await panel.getByRole('button', { name: 'Edit split' }).click();
    await dialog.getByRole('button', { name: 'By percent' }).click();
    const first = dialog.getByRole('textbox', { name: 'Part 1 percentage' });
    const second = dialog.getByRole('textbox', { name: 'Part 2 percentage' });
    await expect(first).toHaveValue('60');
    await expect(second).toHaveValue('40');
    await first.fill('7x');
    await expect(first).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByRole('button', { name: 'Save parts' })).toBeDisabled();
    await first.fill('75');
    await second.fill('25');
    await dialog.getByRole('button', { name: 'Save parts' }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await parts()).map((p: [number]) => p[0]))
      .toEqual([-7_500, -2_500]);
  });
});

test.describe('Select all makes the whole list the selection', () => {
  const bar = (page: Page) => page.getByRole('region', { name: 'Selected transactions' });

  /** Mock one, two and three on checking; the list opened */
  async function threeRows(api: Api, page: Page, path = '') {
    const { checking } = await setup(api);
    for (const [payeeName, amount] of [
      ['Mock one', -100],
      ['Mock two', -200],
      ['Mock three', -300],
    ] as const)
      await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
    await open(page, `/accounts/${checking.id}${path}`);
    return checking;
  }

  test('Select all, then the selection menu sets the category, notes, payee and report visibility on the whole list', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    for (const [payeeName, amount] of [
      ['Corner Grocery', -2_500],
      ['Big Box Store', -7_000],
    ] as const) {
      await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
    }
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Select all 2' }).click();

    // Every row is ticked and the bar says so; right-click either row for the selection's menu
    await expect(bar(page)).toContainText('All 2 selected');
    await expect(page.getByRole('checkbox', { name: /^Select / })).toHaveCount(2);
    for (const box of await page.getByRole('checkbox', { name: /^Select / }).all())
      await expect(box).toBeChecked();
    const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
    const openMenu = async () => {
      await page.getByTestId('transaction-row').first().click({ button: 'right' });
      await expect(menu).toBeVisible();
      return menu;
    };

    await (await openMenu()).getByRole('menuitem', { name: 'Category…' }).click();
    await categoryOption(page, 'Groceries', { exact: true }).click();
    await expect(page.getByTestId('undo-toast')).toContainText('Changed 2 of 2 transactions.');

    await (await openMenu()).getByRole('menuitem', { name: 'Payee…' }).click();
    await page.getByRole('textbox', { name: 'New payee' }).fill('Corner Shop');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Payee for 2 transactions' })).toBeHidden();

    await (await openMenu()).getByRole('menuitem', { name: 'Replace notes…' }).click();
    await page.getByRole('textbox', { name: 'New notes' }).fill('weekly shop');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Notes for 2 transactions' })).toBeHidden();

    await (await openMenu()).getByRole('menuitem', { name: 'Reports' }).hover();
    await page
      .getByRole('menu', { name: 'Reports' })
      .getByRole('menuitem', { name: 'Hide from reports' })
      .click();

    const groceries = await api.category('Groceries');
    await expect
      .poll(async () =>
        (await api.transactions(`?account_id=${checking.id}`)).map((tx) => ({
          categoryId: tx.categoryId,
          payeeName: tx.payeeName,
          notes: tx.notes,
          hiddenFromReports: tx.hiddenFromReports,
        })),
      )
      .toEqual(
        Array(2).fill({
          categoryId: groceries.id,
          payeeName: 'Corner Shop',
          notes: 'weekly shop',
          hiddenFromReports: 1,
        }),
      );
    // Each edit refetched the list; the same filters keep the whole-list selection
    await expect(bar(page)).toContainText('All 2 selected');
  });

  test('a row unticked after Select all is left out of a review, and the bar says 2 selected', async ({
    page,
    api,
  }) => {
    const checking = await threeRows(api, page);
    const reviewed = async () =>
      Object.fromEntries(
        (await api.transactions(`?account_id=${checking.id}`)).map((t) => [
          t.payeeName,
          Boolean(t.reviewedAt),
        ]),
      );
    await page.getByRole('button', { name: 'Select all 3' }).click();
    await expect(bar(page)).toContainText('All 3 selected');
    await page.getByRole('checkbox', { name: /^Select Mock two/ }).uncheck();
    await expect(bar(page)).toContainText('2 selected');
    await expect(bar(page)).not.toContainText('All 3 selected');

    await bar(page).getByRole('button', { name: 'More actions' }).click();
    await page
      .getByRole('menu', { name: 'Actions for 2 selected transactions' })
      .getByRole('menuitem', { name: 'Review' })
      .hover();
    await page
      .getByRole('menu', { name: 'Review' })
      .getByRole('menuitem', { name: 'Mark reviewed' })
      .click();
    await expect(page.getByTestId('undo-toast')).toContainText('Marked 2 reviewed.');
    await expect
      .poll(reviewed)
      .toEqual({ 'Mock one': true, 'Mock two': false, 'Mock three': true });
  });

  test('a row unticked after Select all is not deleted', async ({ page, api }) => {
    const checking = await threeRows(api, page);
    await page.getByRole('button', { name: 'Select all 3' }).click();
    await page.getByRole('checkbox', { name: /^Select Mock two/ }).uncheck();
    await bar(page).getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete 2' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete 2 transactions' });
    await dialog.getByLabel('Type delete to confirm').fill('delete');
    await dialog.getByRole('button', { name: 'Delete 2', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Deleted' })
      .getByRole('button', { name: 'Done' })
      .click();
    expect((await api.transactions(`?account_id=${checking.id}`)).map((t) => t.payeeName)).toEqual([
      'Mock two',
    ]);
  });

  test('changing the date range ends a whole-list selection', async ({ page, api }) => {
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
    await page.getByRole('button', { name: 'Select all 1' }).click();
    await expect(bar(page)).toContainText('All 1 selected');

    // The whole-list selection does not carry over to a list the owner has not chosen.
    // SelectionSummary ("2 transactions") is invisible under the selection bar while selecting (03-33).
    await page.getByRole('button', { name: 'All time' }).click();
    await expect(page.getByTestId('transaction-row')).toHaveCount(2);
    await expect(bar(page)).toContainText('0 selected');
    await expect(bar(page)).not.toContainText('All');
    await expect(page.getByRole('checkbox', { name: /^Select / })).toHaveCount(2);
    for (const box of await page.getByRole('checkbox', { name: /^Select / }).all())
      await expect(box).not.toBeChecked();
  });

  test('a one-row list reads All 1 selected, and reviewing the whole list ends selecting', async ({
    page,
    api,
  }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -100,
      payeeName: 'Mock one',
    });
    await open(page, '/transactions?range=this-month&reviewed=0');
    await page.getByRole('button', { name: 'Select all 1' }).click();
    await expect(bar(page)).toContainText('All 1 selected');
    await row(page, 'Mock one').click({ button: 'right' });
    await expect(
      page.getByRole('menu', { name: 'Actions for 1 selected transaction' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await bar(page).getByRole('button', { name: 'More actions' }).click();
    await page
      .getByRole('menu', { name: 'Actions for 1 selected transaction' })
      .getByRole('menuitem', { name: 'Review' })
      .hover();
    await page
      .getByRole('menu', { name: 'Review' })
      .getByRole('menuitem', { name: 'Mark reviewed' })
      .click();
    // The list is empty now, and there is nothing left to select
    await expect(page.getByText('No transactions found')).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });
});

test('ticked transactions are marked reviewed from the right-click menu, the rest untouched', async ({
  page,
  api,
}) => {
  const { checking } = await setup(api);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
    ['Mock three', -300],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  const reviewed = async () =>
    Object.fromEntries(
      (await api.transactions(`?account_id=${checking.id}`)).map((t) => [
        t.payeeName,
        Boolean(t.reviewedAt),
      ]),
    );

  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
  await page.getByRole('checkbox', { name: /^Select Mock two/ }).check();
  await expect(page.getByRole('region', { name: 'Selected transactions' })).toContainText(
    '2 selected',
  );

  await row(page, 'Mock one').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Review' }).hover();
  await page
    .getByRole('menu', { name: 'Review' })
    .getByRole('menuitem', { name: 'Mark reviewed' })
    .click();
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Marked 2 reviewed.');
  await expect.poll(reviewed).toEqual({ 'Mock one': true, 'Mock two': true, 'Mock three': false });

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(reviewed)
    .toEqual({ 'Mock one': false, 'Mock two': false, 'Mock three': false });

  // From the keyboard: Shift+F10 and the Menu key on a focused selected row
  const first = row(page, 'Mock one');
  await first.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(first).toBeFocused();
  await page.keyboard.press('ContextMenu');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('ticked transactions take a new payee from the right-click menu', async ({ page, api }) => {
  const { checking } = await setup(api);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
    ['Mock three', -300],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  const payees = async () =>
    Object.fromEntries(
      (await api.transactions(`?account_id=${checking.id}`)).map((t) => [t.amount, t.payeeName]),
    );

  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
  await page.getByRole('checkbox', { name: /^Select Mock two/ }).check();

  await row(page, 'Mock one').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
  await menu.getByRole('menuitem', { name: 'Payee…' }).click();

  // The prompt takes the menu's place: a dialog named for the change, no native select anywhere
  const prompt = page.getByRole('dialog', { name: 'Payee for 2 transactions' });
  const field = prompt.getByRole('textbox', { name: 'New payee' });
  const apply = prompt.getByRole('button', { name: 'Apply' });
  await expect(field).toBeFocused();
  await expect(apply).toBeDisabled();
  await expect(page.locator('select')).toHaveCount(0);
  await field.fill('   ');
  await expect(apply).toBeDisabled();

  // Tab stays inside the prompt: field, Apply, Back, then round again
  await field.fill('Corner Shop');
  await page.keyboard.press('Tab');
  await expect(apply).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt.getByRole('button', { name: 'Back' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();

  // Escape goes back to the menu and changes nothing
  await page.keyboard.press('Escape');
  await expect(prompt).toBeHidden();
  await expect(menu).toBeVisible();
  expect(await payees()).toEqual({ '-100': 'Mock one', '-200': 'Mock two', '-300': 'Mock three' });

  // Back does the same
  await menu.getByRole('menuitem', { name: 'Payee…' }).click();
  await prompt.getByRole('button', { name: 'Back' }).click();
  await expect(menu).toBeVisible();

  await menu.getByRole('menuitem', { name: 'Payee…' }).click();
  await field.fill('Corner Shop');
  await page.keyboard.press('Enter');
  await expect(prompt).toBeHidden();
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Changed 2 of 2 transactions.');
  await expect
    .poll(payees)
    .toEqual({ '-100': 'Corner Shop', '-200': 'Corner Shop', '-300': 'Mock three' });

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(payees)
    .toEqual({ '-100': 'Mock one', '-200': 'Mock two', '-300': 'Mock three' });
});

test.describe('deleting ticked transactions from the selection menu', () => {
  async function threeRows(api: Api) {
    const { checking } = await setup(api);
    const ids: string[] = [];
    for (const [payeeName, amount] of [
      ['Mock one', -100],
      ['Mock two', -200],
      ['Mock three', -300],
    ] as const)
      ids.push(
        (await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName }))
          .id,
      );
    return { checking, ids };
  }
  const payees = async (api: Api, accountId: string) =>
    (await api.transactions(`?account_id=${accountId}`)).map((t) => t.payeeName).sort();

  test('ticked transactions are deleted from the right-click menu after typing delete', async ({
    page,
    api,
  }) => {
    const { checking } = await threeRows(api);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
    await page.getByRole('checkbox', { name: /^Select Mock two/ }).check();

    await row(page, 'Mock one').click({ button: 'right' });
    await page
      .getByRole('menu', { name: 'Actions for 2 selected transactions' })
      .getByRole('menuitem', { name: 'Delete 2' })
      .click();

    // Nothing is deleted until the word is typed
    const dialog = page.getByRole('dialog', { name: 'Delete 2 transactions' });
    const confirm = dialog.getByRole('button', { name: 'Delete 2', exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Type delete to confirm').fill('delete');
    await confirm.click();
    const finished = page.getByRole('dialog', { name: 'Deleted' });
    await expect(finished.getByRole('status')).toContainText('Deleted 2 transactions.');
    await finished.getByRole('button', { name: 'Done' }).click();

    expect(await payees(api, checking.id)).toEqual(['Mock three']);
    await expect(page.getByRole('region', { name: 'Selected transactions' })).toContainText(
      '0 selected',
    );
  });

  test('a ticked reconciled transaction is kept, and the dialog says so', async ({ page, api }) => {
    const { checking, ids } = await threeRows(api);
    await api.call('PUT', `/accounts/${checking.id}/reconcile`, { transactionIds: [ids[2]] });
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
    await page.getByRole('checkbox', { name: /^Select Mock three/ }).check();

    await row(page, 'Mock one').click({ button: 'right' });
    await page
      .getByRole('menu', { name: 'Actions for 2 selected transactions' })
      .getByRole('menuitem', { name: 'Delete 2' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Delete 1 transactions' });
    await expect(dialog).toContainText('1 reconciled (unlock them to delete)');
    await dialog.getByLabel('Type delete to confirm').fill('delete');
    await dialog.getByRole('button', { name: 'Delete 1', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Deleted' })
      .getByRole('button', { name: 'Done' })
      .click();
    expect(await payees(api, checking.id)).toEqual(['Mock three', 'Mock two']);
  });
});

test.describe('the selection menu makes the changes the Edit dialog did', () => {
  /** Mock one, two and three on checking; the first two ticked, their menu open for Mock one */
  async function pickTwo(api: Api, page: Page) {
    const { checking, savings } = await setup(api);
    for (const [payeeName, amount] of [
      ['Mock one', -100],
      ['Mock two', -200],
      ['Mock three', -300],
    ] as const)
      await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
    await page.getByRole('checkbox', { name: /^Select Mock two/ }).check();
    /** One field of every register row, by payee */
    const field = async (name: string) =>
      Object.fromEntries(
        (await api.transactions(`?account_id=${checking.id}`)).map((t) => [t.payeeName, t[name]]),
      );
    const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
    const openMenu = async () => {
      await row(page, 'Mock one').click({ button: 'right' });
      await expect(menu).toBeVisible();
      await expect(page.locator('select')).toHaveCount(0);
      return menu;
    };
    return { checking, savings, field, menu, openMenu };
  }

  test('Category… sets the category of the ticked rows, and Uncategorised clears it', async ({
    page,
    api,
  }) => {
    const { field, openMenu } = await pickTwo(api, page);
    const groceries = (await api.category('Groceries')).id;

    await (await openMenu()).getByRole('menuitem', { name: 'Category…' }).click();
    await categoryOption(page, 'Groceries', { exact: true }).click();
    await expect
      .poll(() => field('categoryId'))
      .toMatchObject({ 'Mock one': groceries, 'Mock two': groceries, 'Mock three': null });
    await expect(page.getByTestId('undo-toast')).toContainText('Changed 2 of 2 transactions.');

    await (await openMenu()).getByRole('menuitem', { name: 'Category…' }).click();
    await categoryOption(page, 'Uncategorised', { exact: true }).click();
    await expect
      .poll(() => field('categoryId'))
      .toMatchObject({ 'Mock one': null, 'Mock two': null, 'Mock three': null });
  });

  test('Replace notes… and Remove notes change the notes of the ticked rows only', async ({
    page,
    api,
  }) => {
    const { field, openMenu } = await pickTwo(api, page);

    await (await openMenu()).getByRole('menuitem', { name: 'Replace notes…' }).click();
    const prompt = page.getByRole('dialog', { name: 'Notes for 2 transactions' });
    await prompt.getByRole('textbox', { name: 'New notes' }).fill('weekly shop');
    await prompt.getByRole('button', { name: 'Apply' }).click();
    await expect
      .poll(() => field('notes'))
      .toMatchObject({ 'Mock one': 'weekly shop', 'Mock two': 'weekly shop', 'Mock three': null });

    await (await openMenu()).getByRole('menuitem', { name: 'Remove notes' }).click();
    await expect
      .poll(() => field('notes'))
      .toMatchObject({ 'Mock one': null, 'Mock two': null, 'Mock three': null });
  });

  test('Add tag, Remove tag and Reports change the ticked rows only', async ({ page, api }) => {
    const holiday = await api.call<{ id: string }>('POST', '/tags', { name: 'Holiday' });
    const { field, openMenu } = await pickTwo(api, page);

    await (await openMenu()).getByRole('menuitem', { name: 'Add tag' }).hover();
    await page
      .getByRole('menu', { name: 'Add tag' })
      .getByRole('menuitem', { name: 'Holiday' })
      .click();
    await expect
      .poll(() => field('tagIds'))
      .toEqual({ 'Mock one': [holiday.id], 'Mock two': [holiday.id], 'Mock three': [] });

    await (await openMenu()).getByRole('menuitem', { name: 'Remove tag' }).hover();
    await page
      .getByRole('menu', { name: 'Remove tag' })
      .getByRole('menuitem', { name: 'Holiday' })
      .click();
    await expect
      .poll(() => field('tagIds'))
      .toEqual({ 'Mock one': [], 'Mock two': [], 'Mock three': [] });

    await (await openMenu()).getByRole('menuitem', { name: 'Reports' }).hover();
    await page
      .getByRole('menu', { name: 'Reports' })
      .getByRole('menuitem', { name: 'Hide from reports' })
      .click();
    await expect
      .poll(() => field('hiddenFromReports'))
      .toEqual({ 'Mock one': 1, 'Mock two': 1, 'Mock three': 0 });

    await (await openMenu()).getByRole('menuitem', { name: 'Reports' }).hover();
    await page
      .getByRole('menu', { name: 'Reports' })
      .getByRole('menuitem', { name: 'Show in reports' })
      .click();
    await expect
      .poll(() => field('hiddenFromReports'))
      .toEqual({ 'Mock one': 0, 'Mock two': 0, 'Mock three': 0 });
  });

  test('with no tags there are no tag items, and one row reads "1 transaction"', async ({
    page,
    api,
  }) => {
    const { openMenu, menu } = await pickTwo(api, page);
    await openMenu();
    await expect(menu.getByRole('menuitem', { name: 'Category…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /tag$/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByRole('checkbox', { name: /^Select Mock two/ }).uncheck();
    await row(page, 'Mock one').click({ button: 'right' });
    await page
      .getByRole('menu', { name: 'Actions for 1 selected transaction' })
      .getByRole('menuitem', { name: 'Payee…' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Payee for 1 transaction' })).toBeVisible();
  });

  test('a ticked transfer keeps its category and the toast says it was left alone', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -100,
      payeeName: 'Mock one',
    });
    await api.call('POST', '/transactions/transfer', {
      fromAccountId: checking.id,
      toAccountId: savings.id,
      date: isoDay(),
      amount: 700,
    });
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
    await page.getByRole('checkbox', { name: /^Select Transfer to Rainy Day Savings/ }).check();

    await row(page, 'Mock one').click({ button: 'right' });
    await page
      .getByRole('menu', { name: 'Actions for 2 selected transactions' })
      .getByRole('menuitem', { name: 'Category…' })
      .click();
    await categoryOption(page, 'Groceries', { exact: true }).click();

    const groceries = (await api.category('Groceries')).id;
    const toast = page.getByTestId('undo-toast');
    await expect(toast).toContainText('Changed 1 of 2 transactions.');
    await expect(toast).toContainText('1 transfer');
    const rows = await api.transactions(`?account_id=${checking.id}`);
    expect(rows.find((t) => t.payeeName === 'Mock one').categoryId).toBe(groceries);
    expect(rows.find((t) => t.transferTransactionId).categoryId).toBeNull();
  });

  test('a ticked row removed before the edit applies is refused, and the selection catches up', async ({
    page,
    api,
  }) => {
    const { checking, field, openMenu } = await pickTwo(api, page);
    const two = (await api.transactions(`?account_id=${checking.id}`)).find(
      (t) => t.payeeName === 'Mock two',
    );
    await api.call('DELETE', `/transactions/${two.id}`);

    const menu = await openMenu();
    await menu.getByRole('menuitem', { name: 'Review' }).hover();
    await page
      .getByRole('menu', { name: 'Review' })
      .getByRole('menuitem', { name: 'Mark reviewed' })
      .click();
    await expect(page.getByTestId('undo-toast')).toContainText(
      'The selection now has 1 transactions, not 2.',
    );
    expect(await field('reviewedAt')).toMatchObject({ 'Mock one': null });
    await expect(page.getByRole('region', { name: 'Selected transactions' })).toContainText(
      '1 selected',
    );
  });
});

test('while saving is paused the selection menu offers no change, then offers them again', async ({
  page,
  api,
}) => {
  const { checking } = await setup(api);
  for (const [payeeName, amount] of [
    ['Mock one', -100],
    ['Mock two', -200],
    ['Mock three', -300],
  ] as const)
    await api.createTransaction({ accountId: checking.id, date: isoDay(), amount, payeeName });
  // A household, so Share shows; a tag, so Add tag does
  await api.call('POST', '/households', {
    name: 'Flat',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Juno'],
    selfIndex: 0,
  });
  await api.call('POST', '/tags', { name: 'Holiday' });
  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Select Mock one/ }).check();
  await page.getByRole('checkbox', { name: /^Select Mock two/ }).check();

  const menu = page.getByRole('menu', { name: 'Actions for 2 selected transactions' });
  const hint = 'Saving is paused until Allotment reconnects.';
  const writing = [/^Payee…/, /^Review/, /^Add tag/, /^Share 2 selected with/, /^Delete 2/];
  const openMenu = async () => {
    await row(page, 'Mock one').click({ button: 'right' });
    await expect(menu).toBeVisible();
  };

  // An unselected row keeps its own menu, whose Share with writes too
  const rowMenu = page.getByRole('menu', { name: 'Actions for Mock three' });
  const openRowMenu = async () => {
    await row(page, 'Mock three').click({ button: 'right' });
    await expect(rowMenu).toBeVisible();
  };

  // Allowed: every writing item is enabled and nothing says saving is paused
  await openMenu();
  for (const name of writing) await expect(menu.getByRole('menuitem', { name })).toBeEnabled();
  await expect(menu).not.toContainText(hint);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await openRowMenu();
  await expect(rowMenu.getByRole('menuitem', { name: /^Share with/ })).toBeEnabled();
  await expect(rowMenu).not.toContainText(hint);
  await page.keyboard.press('Escape');
  await expect(rowMenu).toBeHidden();

  // Paused: the same items are disabled, each says why, and Clear selection still works
  await stopDesktopServer();
  try {
    // The next request finds the server gone: a change chosen now fails, and the app says so
    await openMenu();
    await menu.getByRole('menuitem', { name: 'Review' }).hover();
    await page
      .getByRole('menu', { name: 'Review' })
      .getByRole('menuitem', { name: 'Mark reviewed' })
      .click();
    await expect(page.getByRole('status', { name: 'Connection' })).toContainText(
      "Can't reach Allotment",
    );
    await openMenu();
    for (const name of writing) await expect(menu.getByRole('menuitem', { name })).toBeDisabled();
    await expect(menu).toContainText(hint);
    await expect(menu.getByRole('menuitem', { name: 'Clear selection' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // The row's own menu waits the same way; opening its details still works
    await openRowMenu();
    await expect(rowMenu.getByRole('menuitem', { name: /^Share with/ })).toBeDisabled();
    await expect(rowMenu).toContainText(hint);
    await expect(rowMenu.getByRole('menuitem', { name: 'Open details' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(rowMenu).toBeHidden();
  } finally {
    await startDesktopServer();
  }

  // Back: they are enabled again and the hint is gone
  await page
    .getByRole('status', { name: 'Connection' })
    .getByRole('button', { name: 'Retry now' })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await expect(page.getByRole('button', { name: /^Server status: Online/ })).toBeVisible();
  await openMenu();
  for (const name of writing) await expect(menu.getByRole('menuitem', { name })).toBeEnabled();
  await expect(menu).not.toContainText(hint);
});

test.describe('selecting transactions in the register', () => {
  const names = ['Mock alpha', 'Mock bravo', 'Mock charlie', 'Mock delta', 'Mock echo'];
  const bar = (page: Page) => page.getByRole('region', { name: 'Selected transactions' });
  const boxes = (page: Page) => page.getByRole('checkbox', { name: /^Select / });

  async function fiveRows(api: Api, page: Page) {
    const { checking } = await setup(api);
    for (const [i, payeeName] of names.entries())
      await api.createTransaction({
        accountId: checking.id,
        date: isoDay(),
        amount: -(i + 1) * 100,
        payeeName,
      });
    await open(page, `/accounts/${checking.id}`);
    return page.getByTestId('transaction-row');
  }

  test('Cmd or Ctrl+click and Shift+click select rows without opening details', async ({
    page,
    api,
  }) => {
    const rows = await fiveRows(api, page);
    await rows.nth(0).click({ modifiers: ['ControlOrMeta'] });
    await rows.nth(3).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('4 selected');
    for (const i of [0, 1, 2, 3]) await expect(boxes(page).nth(i)).toBeChecked();
    await expect(boxes(page).nth(4)).not.toBeChecked();
    await expect(page.getByRole('complementary', { name: 'Transaction details' })).toHaveCount(0);

    // While selecting, a plain click toggles the row instead of opening details (owner, UAT G-03-4)
    await rows.nth(4).click({ position: { x: 80, y: 12 } });
    await expect(page.getByRole('complementary', { name: 'Transaction details' })).toHaveCount(0);
    await expect(bar(page)).toContainText('5 selected');
  });

  test('Shift+click on the anchor row selects exactly that row, and a range goes either way', async ({
    page,
    api,
  }) => {
    const rows = await fiveRows(api, page);
    await rows.nth(1).click({ modifiers: ['ControlOrMeta'] });
    await rows.nth(1).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('1 selected');

    // Two rows below the anchor: those three rows and no others
    await rows.nth(1).click({ modifiers: ['Shift'] });
    await rows.nth(3).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('3 selected');
    await expect(boxes(page).nth(0)).not.toBeChecked();
    await expect(boxes(page).nth(4)).not.toBeChecked();

    // Clicked from the lower end first, the range is the same rows
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await rows.nth(3).click({ modifiers: ['ControlOrMeta'] });
    await rows.nth(1).click({ modifiers: ['Shift'] });
    await expect(bar(page)).toContainText('3 selected');
    for (const i of [1, 2, 3]) await expect(boxes(page).nth(i)).toBeChecked();
  });

  test('a search keeps the selected rows still listed and drops the rest', async ({
    page,
    api,
  }) => {
    await fiveRows(api, page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: /^Select Mock alpha/ }).check();
    await page.getByRole('checkbox', { name: /^Select Mock bravo/ }).check();
    await expect(bar(page)).toContainText('2 selected');

    await page.getByPlaceholder('Search payee or notes…').fill('alpha');
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    await expect(bar(page)).toContainText('1 selected');

    // The dropped row does not come back with the search cleared
    await page.getByPlaceholder('Search payee or notes…').fill('');
    await expect(page.getByTestId('transaction-row')).toHaveCount(5);
    await expect(bar(page)).toContainText('1 selected');
    await expect(page.getByRole('checkbox', { name: /^Select Mock bravo/ })).not.toBeChecked();
  });

  test('with nothing selected, More actions is off and a row keeps its own menu', async ({
    page,
    api,
  }) => {
    const rows = await fiveRows(api, page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(bar(page)).toContainText('0 selected');
    await expect(bar(page).getByRole('button', { name: 'More actions' })).toBeDisabled();

    await rows.filter({ hasText: 'Mock alpha' }).click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Actions for Mock alpha' })).toBeVisible();
    await page.keyboard.press('Escape');

    // One selected row: the selection's menu, for that row only
    await page.getByRole('checkbox', { name: /^Select Mock alpha/ }).check();
    await rows.filter({ hasText: 'Mock alpha' }).click({ button: 'right' });
    await expect(
      page.getByRole('menu', { name: 'Actions for 1 selected transaction' }),
    ).toBeVisible();
  });

  test('a selected row changes colour, shows no checkbox, and nothing in it moves', async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const rows = await fiveRows(api, page);
    const brand100 = await tokenColour(page, '--color-brand-100');
    const brand600 = await tokenColour(page, '--color-brand-600');
    const surface = await tokenColour(page, '--color-surface');
    const brand600Re = new RegExp(brand600.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const layout = async () => {
      const first = (await rows.nth(0).boundingBox())!;
      const fifth = (await rows.nth(4).boundingBox())!;
      const payee = (await rows.nth(0).getByText('Mock echo', { exact: true }).boundingBox())!;
      const amount = (await rows.nth(0).getByText('-$5', { exact: true }).boundingBox())!;
      return {
        firstTop: first.y,
        firstLeft: first.x,
        fifthTop: fifth.y,
        fifthLeft: fifth.x,
        payeeOffset: payee.x - first.x,
        amountOffset: first.x + first.width - (amount.x + amount.width),
      };
    };
    const same = async (before: Awaited<ReturnType<typeof layout>>) => {
      const now = await layout();
      for (const [k, v] of Object.entries(before) as [keyof typeof before, number][]) {
        expect(now[k], k).toBeCloseTo(v, 0);
      }
    };

    const before = await layout();

    // (1) Focus Select and press Enter: nothing moves, bar covers the toolbar and takes focus
    const selectBtn = page.getByRole('button', { name: 'Select', exact: true });
    await selectBtn.focus();
    await page.keyboard.press('Enter');
    await same(before);
    const barBox = (await bar(page).boundingBox())!;
    const firstBox = (await rows.nth(0).boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(firstBox.y + 0.5);
    await expect(selectBtn).toBeHidden();
    await expect(bar(page).getByRole('button', { name: 'Select all 5' })).toBeVisible();
    await expect(bar(page)).toBeFocused();

    // (2) The rows themselves are the checkboxes, with no nested interactive controls
    await expect(boxes(page)).toHaveCount(5);
    expect(
      await boxes(page).evaluateAll((els) =>
        els.every((el) => el.getAttribute('data-testid') === 'transaction-row'),
      ),
    ).toBe(true);
    await expect(
      rows.nth(0).locator('button, a[href], input, select, textarea, [tabindex]'),
    ).toHaveCount(0);

    // (3) Plain-click selects the first row and changes its colour without opening details
    await rows.nth(0).click();
    await expect(bar(page)).toContainText('1 selected');
    await expect(rows.nth(0)).toBeChecked();
    await expect(page.getByRole('complementary', { name: 'Transaction details' })).toHaveCount(0);
    await same(before);
    await expect(rows.nth(0)).toHaveCSS('background-color', brand100);
    await expect(rows.nth(0)).toHaveCSS('box-shadow', brand600Re);
    await page.mouse.move(0, 0);
    await expect(rows.nth(2)).toHaveCSS('background-color', surface);

    // (4) Space toggles a focused row; Shift+F10 opens the selection menu
    await rows.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(bar(page)).toContainText('2 selected');
    await expect(rows.nth(1)).toBeChecked();
    await same(before);
    await page.keyboard.press('Space');
    await expect(bar(page)).toContainText('1 selected');
    await rows.nth(0).focus();
    await page.keyboard.press('Shift+F10');
    await expect(
      page.getByRole('menu', { name: 'Actions for 1 selected transaction' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // (5) Done restores the toolbar and inline controls without moving the list
    await bar(page).getByRole('button', { name: 'Done' }).click();
    await same(before);
    await expect(selectBtn).toBeVisible();
    await expect(
      rows.nth(0).getByRole('button', { name: /^Category for Mock echo/ }),
    ).toBeVisible();

    // (6) Toolbar Select all 5: bar overlays toolbar, hides its own Select all 5
    await page.getByRole('button', { name: 'Select all 5' }).click();
    await expect(bar(page)).toContainText('All 5 selected');
    await same(before);
    const allBarBox = (await bar(page).boundingBox())!;
    const allFirstBox = (await rows.nth(0).boundingBox())!;
    expect(allBarBox.y + allBarBox.height).toBeLessThanOrEqual(allFirstBox.y + 0.5);
    await expect(bar(page).getByRole('button', { name: 'Select all 5' })).toHaveCount(0);
    await bar(page).getByRole('button', { name: 'Done' }).click();
  });

  test('does not offer Select all while a filtered list is loading', async ({ page, api }) => {
    await fiveRows(api, page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(bar(page).getByRole('button', { name: 'Select all 5' })).toBeVisible();

    let releaseFiltered!: () => void;
    const filteredHeld = new Promise<void>((resolve) => {
      releaseFiltered = resolve;
    });
    let filteredRequested = false;
    await page.route(
      (url) => url.pathname === '/api/transactions' && url.search.includes('alpha'),
      async (route) => {
        filteredRequested = true;
        await filteredHeld;
        await route.continue();
      },
    );

    await page.getByPlaceholder('Search payee or notes…').fill('alpha');
    await expect.poll(() => filteredRequested).toBe(true);
    await expect(bar(page).getByRole('button', { name: /^Select all/ })).toHaveCount(0);

    releaseFiltered();
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    await expect(boxes(page).nth(0)).not.toBeChecked();
    await expect(bar(page)).toContainText('0 selected');
    await expect(bar(page).getByRole('button', { name: 'Select all 1' })).toBeVisible();
  });

  test('row checkbox name uses the account currency and folded round-up total', async ({
    page,
    api,
  }) => {
    await api.call('PUT', '/currency', { currency: 'AUD' });
    const jpy = await api.createAccount('Tokyo cash', 0, 'checking', { currency: 'JPY' });
    await api.createTransaction({
      accountId: jpy.id,
      date: isoDay(),
      amount: -1500,
      payeeName: 'Ramen',
    });

    await open(page, '/transactions');
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Select Ramen -¥1,500', exact: true }),
    ).toBeVisible();
  });
});
