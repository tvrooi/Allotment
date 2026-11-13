import { test, expect, open, isoDay, type Api } from './fixtures';

async function seed(api: Api) {
  const checking = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -500,
    payeeName: 'AMZN Mktp',
  });
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -700,
    payeeName: 'Amazon',
  });
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -900,
    payeeName: 'Amazon',
  });
  return checking;
}

const row = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('checkbox', { name: `Select ${name}` }) });

test.describe('payees', () => {
  test('lists payees with their transaction counts; a split counts once', async ({ page, api }) => {
    const checking = await seed(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_000,
      payeeName: 'Costco',
      splits: [
        { categoryId: null, amount: -600 },
        { categoryId: null, amount: -400 },
      ],
    });
    await open(page, '/payees');
    await expect(row(page, 'Amazon').getByRole('cell').nth(3)).toHaveText('2');
    await expect(row(page, 'Costco').getByRole('cell').nth(3)).toHaveText('1');
    await page.getByPlaceholder('Search payees…').fill('amz');
    await expect(row(page, 'AMZN Mktp')).toBeVisible();
    await expect(row(page, 'Amazon')).toBeHidden();
  });

  test('merges payees and moves their transactions', async ({ page, api }) => {
    await seed(api);
    await open(page, '/payees');
    await page.getByRole('checkbox', { name: 'Select AMZN Mktp' }).check();
    await page.getByRole('checkbox', { name: 'Select Amazon' }).check();
    await page.getByRole('button', { name: 'Merge 2 payees' }).click();

    const dialog = page.getByRole('dialog', { name: 'Merge payees' });
    await dialog.getByRole('radio', { name: /Amazon/ }).check();
    await dialog.getByRole('button', { name: 'Merge' }).click();

    await expect(row(page, 'AMZN Mktp')).toBeHidden();
    await expect(row(page, 'Amazon').getByRole('cell').nth(3)).toHaveText('3');
    const names = new Set((await api.transactions()).map((t) => t.payeeName));
    expect([...names]).toEqual(['Amazon']);
  });

  test('a default category applies to new transactions from that payee', async ({ page, api }) => {
    const checking = await seed(api);
    const shopping = await api.category('Groceries');
    await open(page, '/payees');
    // The searchable category picker, as everywhere a category is chosen (#240)
    await page.getByRole('button', { name: 'Default category for Amazon: none' }).click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Default category for Amazon: Groceries' }),
    ).toBeVisible();
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/payees')).find((p) => p.name === 'Amazon'))
      .toMatchObject({ defaultCategoryId: shopping.id });

    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_234,
      payeeName: 'Amazon',
    });
    expect(tx.categoryId).toBe(shopping.id);
  });

  test('renames a payee in place with its Rename button', async ({ page, api }) => {
    await seed(api);
    await open(page, '/payees');
    await page.getByRole('button', { name: 'Rename AMZN Mktp' }).click();
    const input = page.getByRole('textbox', { name: 'Rename AMZN Mktp' });
    await input.fill('Amazon Marketplace');
    await input.press('Enter');
    await expect(row(page, 'Amazon Marketplace')).toBeVisible();
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/payees')).map((p) => p.name).sort())
      .toEqual(['Amazon', 'Amazon Marketplace']);
  });

  test('deletes a payee, keeping its transactions', async ({ page, api }) => {
    await seed(api);
    await open(page, '/payees');
    await page.getByRole('button', { name: 'Delete AMZN Mktp' }).click();
    await page
      .getByRole('dialog', { name: 'Delete payee' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(row(page, 'AMZN Mktp')).toBeHidden();
    expect(await api.transactions()).toHaveLength(3);
  });

  test("a payee's page: spending, default category, rules and transactions (#235)", async ({
    page,
    api,
  }) => {
    await seed(api);
    const groceries = await api.category('Groceries');
    const amazon = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
      (p) => p.name === 'Amazon',
    )!;
    await api.call('POST', '/rules', {
      conditions: [{ field: 'payee', op: 'is', value: amazon.id }],
      actions: [{ type: 'set_category', value: groceries.id }],
    });
    await api.call('POST', '/rules', {
      conditions: [{ field: 'notes', op: 'contains', value: 'unrelated' }],
      actions: [{ type: 'set_category', value: groceries.id }],
    });
    await open(page, '/payees');
    await row(page, 'Amazon').getByRole('link', { name: 'Amazon', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#/payees/${amazon.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Amazon' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Total spent$16');
    // Only the rule that names this payee
    const rules = page.getByRole('region', { name: 'Rules' });
    await expect(rules.getByRole('link')).toHaveCount(1);
    await expect(rules.getByRole('link')).toContainText('Set category to Groceries');
    // Its transactions, through the shared register
    const list = page.getByRole('region', { name: 'Amazon transactions' });
    await expect(list.getByTestId('transaction-row')).toHaveCount(2);

    await page.getByRole('button', { name: 'Default category for Amazon: none' }).click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/payees')).find((p) => p.name === 'Amazon'))
      .toMatchObject({ defaultCategoryId: groceries.id });
    // And back to no default
    await page.getByRole('button', { name: 'Default category for Amazon: Groceries' }).click();
    await page.getByRole('button', { name: 'No default category' }).click();
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/payees')).find((p) => p.name === 'Amazon'))
      .toMatchObject({ defaultCategoryId: null });

    await rules.getByRole('link').click();
    await expect(page).toHaveURL(/#\/rules$/);
    await page.goBack();
    await page.getByRole('link', { name: 'Payees', exact: true }).first().click();
    await expect(page).toHaveURL(/#\/payees$/);
  });

  test('an unknown payee shows a plain not-found page with a way back', async ({ page }) => {
    await open(page, '/payees/no-such-payee');
    await expect(
      page.getByRole('main').getByText('Payee not found', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Go to payees' }).click();
    await expect(page).toHaveURL(/#\/payees$/);
  });

  test('the search stays in the link, so Back returns to it (#245)', async ({ page, api }) => {
    await seed(api);
    await open(page, '/payees');
    await page.getByPlaceholder('Search payees…').fill('amz');
    await expect(page).toHaveURL(/search=amz/);
    await row(page, 'AMZN Mktp').getByRole('link', { name: 'AMZN Mktp' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'AMZN Mktp' })).toBeVisible();
    await page.goBack();
    await expect(page.getByPlaceholder('Search payees…')).toHaveValue('amz');
    await expect(row(page, 'Amazon')).toBeHidden();
  });

  test("a payee page's failed requests say so, never zeros or 'no rules' (#235)", async ({
    page,
    api,
  }) => {
    await seed(api);
    const amazon = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
      (p) => p.name === 'Amazon',
    )!;
    let refusing = true;
    const refuse = (path: string) =>
      page.route(
        (url) => url.pathname === path,
        (route) =>
          refusing && route.request().method() === 'GET'
            ? route.fulfill({
                status: 422,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'The server refused this for the test.' }),
              })
            : route.continue(),
      );
    await refuse('/api/transactions/summary');
    await refuse('/api/rules');
    await refuse('/api/transactions');
    await open(page, `/payees/${amazon.id}`);
    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary.getByRole('alert')).toContainText('Couldn’t load your totals');
    await expect(summary).not.toContainText('$0');
    const rules = page.getByRole('region', { name: 'Rules' });
    await expect(rules.getByRole('alert')).toContainText('Couldn’t load your rules');
    await expect(rules).not.toContainText('No rules');
    const chart = page.getByRole('region', { name: 'Spending by month' });
    await expect(chart.getByRole('alert')).toContainText('Couldn’t load your spending');
    await expect(chart).not.toContainText('No spending');

    refusing = false;
    await summary.getByRole('button', { name: 'Retry' }).click();
    await expect(summary).toContainText('Total spent$16');
    await rules.getByRole('button', { name: 'Retry' }).click();
    await expect(rules).toContainText('No rules mention Amazon.');
  });
});
