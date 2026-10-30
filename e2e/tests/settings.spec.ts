import type { Page } from '@playwright/test';
import fs from 'fs';
import { test, expect, open, isoDay } from './fixtures';

// Settings: managing categories and groups, and preferences.

async function pickEmoji(page: Page, name: string) {
  const picker = page.locator('aside.EmojiPickerReact');
  await picker.getByRole('textbox', { name: 'Type to search for an emoji' }).fill(name);
  await picker.getByRole('button', { name, exact: true }).click();
  await expect(picker).toBeHidden();
}

test.describe('categories', () => {
  test.beforeEach(async ({ api, page }) => {
    await api.createAccount('Checking', 0);
    await open(page, '/settings');
  });

  test('creates a group and a category in it', async ({ page, api }) => {
    // The second "Create group" is in the Expenses section
    await page.getByRole('button', { name: 'Create group' }).nth(1).click();
    await page.getByPlaceholder('Group name...').fill('Pets');
    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByText('Pets', { exact: true })).toBeVisible();

    // New groups go last, so its "Create Category" is the last one
    await page.getByRole('button', { name: 'Create Category' }).last().click();
    await page.getByPlaceholder('Category name...').fill('Vet Bills');
    await page.getByPlaceholder('Category name...').press('Enter');
    await expect(page.getByRole('button', { name: 'Edit Vet Bills' })).toBeVisible();

    const pets = (await api.categoryGroups()).find((g) => g.name === 'Pets')!;
    expect(pets).toMatchObject({ isIncome: 0 });
    expect(pets.categories.map((c) => c.name)).toEqual(['Vet Bills']);
  });

  test('the emoji picker shows its emojis and fits on screen', async ({ page }) => {
    // The last group's form is at the bottom of its card, which hides what overflows it
    await page.getByRole('button', { name: 'Create Category' }).last().click();
    await page.getByRole('button', { name: 'Pick icon' }).click();

    const picker = page.locator('aside.EmojiPickerReact');
    await expect(picker.getByRole('button', { name: 'grinning face', exact: true })).toBeVisible();
    await expect(picker.locator('img')).toHaveCount(0); // the CSP blocks the default CDN images
    await expect(picker).toBeInViewport({ ratio: 1 });
  });

  test('picks an icon for a new category', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Create Category' }).last().click();
    await page.getByPlaceholder('Category name...').fill('Dog Walker');
    await page.getByRole('button', { name: 'Pick icon' }).click();
    await pickEmoji(page, 'dog face');
    await expect(page.getByRole('button', { name: 'Pick icon' })).toHaveText('🐶');

    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByRole('button', { name: 'Edit Dog Walker' })).toBeVisible();
    await expect.poll(async () => (await api.category('Dog Walker'))?.icon).toBe('🐶');
  });

  test('changes a category icon in the edit dialog', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Edit Parking' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Category' });
    await dialog.getByRole('button', { name: 'Change icon' }).click();
    await pickEmoji(page, 'dog face');
    await expect(dialog.getByRole('button', { name: 'Change icon' })).toHaveText('🐶');

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await api.category('Parking'))?.icon).toBe('🐶');
  });

  test('renames a category from the keyboard', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Edit Parking' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Edit Category' });
    await dialog.getByRole('textbox', { name: 'Category name' }).fill('Parking & Tolls');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Edit Parking & Tolls' })).toBeVisible();
    await expect.poll(() => api.category('Parking & Tolls')).toBeTruthy();
  });

  test('deleting a used category moves its transactions first', async ({ page, api }) => {
    const [checking] = await api.accounts();
    const parking = await api.category('Parking');
    const transit = await api.category('Public Transit');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_200,
      payeeName: 'City Garage',
      categoryId: parking.id,
    });

    await page.getByRole('button', { name: 'Edit Parking' }).click();
    await page
      .getByRole('dialog', { name: 'Edit Category' })
      .getByRole('button', { name: 'Delete' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Merge into another category' });
    await expect(dialog).toContainText('Parking has 1 transaction');
    await expect(dialog.getByRole('button', { name: 'Merge & remove' })).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Merge into' }).selectOption(transit.id);
    await dialog.getByRole('button', { name: 'Merge & remove' }).click();

    await expect(page.getByRole('button', { name: 'Edit Parking' })).toBeHidden();
    const [tx] = await api.transactions();
    expect(tx.categoryId).toBe(transit.id);
  });

  test('a group with history is not deleted until its categories are moved', async ({
    page,
    api,
  }) => {
    const [checking] = await api.accounts();
    const group = await api.call('POST', '/categories/groups', { name: 'Pets', isIncome: 0 });
    const vet = await api.call('POST', '/categories', { name: 'Vet', groupId: group.id });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -4_500,
      payeeName: 'Vet Clinic',
      categoryId: vet.id,
    });
    await page.reload();

    await page.getByRole('button', { name: 'Delete group Pets' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete Group' });
    await expect(dialog).toContainText(
      'still has categories with transactions or assigned money: Vet',
    );
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('button', { name: 'Edit Vet' })).toBeVisible();
    expect((await api.transactions())[0].categoryId).toBe(vet.id);
  });
});

test.describe('preferences', () => {
  test('persist across reloads', async ({ page, api }) => {
    await api.createAccount('Checking', 123_456);
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();
    // The dark theme is applied to the page and remembered
    await page.getByRole('main').getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('amounts and dates the European way, typed with a decimal comma', async ({ page, api }) => {
    const girokonto = await api.createAccount('Girokonto', 0);
    await api.createTransaction({
      accountId: girokonto.id,
      date: isoDay(),
      amount: -123_456,
      payeeName: 'Miete',
    });
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();
    const main = page.getByRole('main');
    // Automatic follows the browser's language (en-US in the tests)
    await expect(main).toContainText('Example: -$1,234.56');

    await main
      .getByRole('group', { name: 'Number format' })
      .getByRole('button', { name: '1.234,56' })
      .click();
    await main.getByRole('textbox', { name: 'Currency symbol' }).fill('€');
    await main
      .getByRole('group', { name: 'Currency symbol position' })
      .getByRole('button', { name: 'After' })
      .click();
    await main.getByRole('button', { name: /^dd\.MM\.yyyy/ }).click();
    await expect(main).toContainText('Example: -1.234,56 €');

    await open(page, `/accounts/${girokonto.id}`);
    const register = page.getByRole('main');
    await expect(register).toContainText('-1.234,56 €');
    const [y, m, d] = isoDay().split('-');
    await expect(register).toContainText(`${d}.${m}.${y}`);

    // A decimal comma and a decimal point both work
    for (const [typed, cents] of [
      ['12,50', -1_250],
      ['7.25', -725],
    ] as const) {
      await page.getByRole('button', { name: 'Add Transaction' }).click();
      const form = page.getByRole('form', { name: 'New transaction' });
      await form.getByRole('textbox', { name: 'Payee' }).fill(`Bäckerei ${typed}`);
      await form.getByRole('textbox', { name: 'Outflow' }).fill(typed);
      await form.getByRole('button', { name: 'Save' }).click();
      await expect(register).toContainText(`Bäckerei ${typed}`);
      const txs = await api.transactions(`?account_id=${girokonto.id}`);
      expect(txs.find((t) => t.payeeName === `Bäckerei ${typed}`)?.amount).toBe(cents);
    }
    // Outflows have their own column, without a minus sign
    await expect(register).toContainText('12,50 €');
    await expect(register).toContainText('7,25 €');

    // The setting stays after a reload
    await page.reload();
    await expect(register).toContainText('-1.254,31 €'); // the balance, with both new ones
  });

  test('exports transactions with a decimal comma for spreadsheets that expect one', async ({
    page,
    api,
  }) => {
    const girokonto = await api.createAccount('Girokonto', 0);
    await api.createTransaction({
      accountId: girokonto.id,
      date: isoDay(),
      amount: -1_250,
      payeeName: 'Bäckerei',
    });
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page
      .getByRole('main')
      .getByRole('group', { name: 'Number format' })
      .getByRole('button', { name: '1.234,56' })
      .click();
    await page.getByRole('button', { name: 'Data' }).click();
    // The Data tab says how the file will be written
    await expect(page.getByRole('main')).toContainText(
      'Amounts are written like -12,50, with semicolons between columns',
    );
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = fs.readFileSync(await (await download).path(), 'utf8');
    expect(csv.split('\n')[0]).toBe(
      'Date;Account;Payee;Category;Notes;Amount;Reconciled;Tags;Reviewed;Hidden from reports',
    );
    expect(csv).toContain(';Girokonto;Bäckerei;');
    expect(csv).toContain(';-12,50;');
  });
});

test.describe('goals', () => {
  test('adds a savings goal and shows its progress', async ({ page, api }) => {
    const savings = await api.createAccount('Savings', 0, 'savings');
    await open(page, '/goals');
    await page.getByRole('main').getByRole('button', { name: 'Add Goal' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Add Goal' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Emergency Fund');
    await dialog.getByRole('textbox', { name: 'Target', exact: true }).fill('10000');
    await dialog.getByRole('textbox', { name: 'Saved so far' }).fill('2500');
    await dialog
      .getByRole('combobox', { name: 'Linked account' })
      .selectOption({ label: 'Savings' });
    await dialog.getByRole('button', { name: '🛡️' }).click();
    await expect(dialog.getByRole('button', { name: '🛡️' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Color #059669' }).click();
    await dialog.getByRole('button', { name: 'Add Goal' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('main')).toContainText('Emergency Fund');
    await expect(page.getByRole('main')).toContainText('25%');
    const [goal] = await api.call<any[]>('GET', '/goals');
    expect(goal).toMatchObject({
      name: 'Emergency Fund',
      targetAmount: 1_000_000,
      currentAmount: 250_000,
      accountId: savings.id,
      icon: '🛡️',
      color: '#059669',
    });
  });
});

test('settings link to the license and the source code', async ({ page, api }) => {
  await api.createAccount('Checking');
  await open(page, '/settings');
  await expect(page.getByRole('link', { name: 'GNU AGPL v3' })).toHaveAttribute(
    'href',
    'https://www.gnu.org/licenses/agpl-3.0.html',
  );
  const source = page.getByRole('link', { name: 'Source code' });
  await expect(source).toHaveAttribute('href', 'https://github.com/tvrooi/Allotment');
  // Opens outside the app (the desktop app hands https links to the system browser)
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', /noopener/);
});

test.describe('amounts on a German device', () => {
  test.use({ locale: 'de-DE' });

  test('a new install follows the device language', async ({ page, api }) => {
    const girokonto = await api.createAccount('Girokonto', 123_456);
    await open(page, `/accounts/${girokonto.id}`);
    await expect(page.getByRole('main')).toContainText('1.234,56 $');
  });

  test('an install from before the setting keeps the amounts it had', async ({ page, api }) => {
    const girokonto = await api.createAccount('Girokonto', 123_456);
    // Preferences saved by a version without the amount format (no version number)
    await page.addInitScript(() => {
      if (!localStorage.getItem('budget-preferences')) {
        localStorage.setItem(
          'budget-preferences',
          JSON.stringify({ state: { currencySymbol: '$', setupSkipped: true }, version: 0 }),
        );
      }
    });
    await open(page, `/accounts/${girokonto.id}`);
    await expect(page.getByRole('main')).toContainText('$1,234.56');
  });
});

test('the budget start keeps older history out of the envelopes', async ({ page, api }) => {
  const account = await api.createAccount('Checking', 500_000);
  const thisMonth = isoDay().slice(0, 7);
  const [y, m] = thisMonth.split('-').map(Number);
  const earlier = new Date(Date.UTC(y, m - 3, 5)).toISOString().slice(0, 10);
  await api.createTransaction({
    accountId: account.id,
    date: earlier,
    amount: -478_000,
    payeeName: 'Old rent',
    categoryId: null,
  });
  // Overspending resets each month; uncategorised spending waits until it's categorised
  const summary = () => api.call('GET', `/budget/${thisMonth}/summary`);
  expect((await summary()).uncategorized).toBe(478_000);

  await open(page, '/settings?tab=budget');
  await expect(page.getByText('Envelopes count all history.')).toBeVisible();
  await page.getByLabel('Start month').fill(thisMonth);
  await page.getByRole('button', { name: 'Start budget here' }).click();
  await expect(page.getByText(/^Envelopes start in /)).toBeVisible();
  expect(await summary()).toMatchObject({ uncategorized: 0, budgetStartMonth: thisMonth });
  // The transaction itself is untouched
  expect(await api.balance(account.id)).toBe(500_000 - 478_000);

  await page.getByRole('button', { name: 'Count all history' }).click();
  await expect(page.getByText('Envelopes count all history.')).toBeVisible();
  expect((await summary()).uncategorized).toBe(478_000);
});
