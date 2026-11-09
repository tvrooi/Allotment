import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, typeAmount, type Api } from './fixtures';

// Recurring bills and income: create one, see it in the month, mark it paid, pause it,
// and let "Find recurring" discover one from history.

/** The row for a schedule in the "All recurring" table */
const scheduleRow = (page: Page, name: string) =>
  page
    .getByRole('main')
    .locator('div')
    .filter({ hasText: name })
    .filter({
      has: page.getByRole('button', { name: 'Actions' }),
    });

async function openAll(page: Page) {
  await open(page, '/recurring');
  await page.getByRole('tab', { name: 'All recurring' }).click();
}

async function createRent(api: Api, accountId: string, extra: object = {}) {
  return api.call('POST', '/schedules', {
    name: 'Rent',
    amount: -150_000,
    recurrenceType: 'monthly',
    startDate: isoDay(2),
    accountId,
    ...extra,
  });
}

test.describe('recurring', () => {
  test('adds a monthly bill through the form', async ({ page, api }) => {
    await api.createAccount('Checking', 500_000);
    await open(page, '/recurring');
    await page.getByRole('main').getByRole('button', { name: 'Add recurring' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Add recurring' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Streaming Plus');
    await typeAmount(dialog.getByRole('textbox', { name: 'Amount' }), '15.99');
    await expect(dialog.getByRole('button', { name: 'Expense' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('combobox', { name: 'Frequency' }).selectOption('monthly');
    await dialog.getByRole('combobox', { name: 'Account' }).selectOption({ label: 'Checking' });
    await dialog.getByRole('textbox', { name: 'Start date' }).fill(isoDay(1));
    await dialog.getByRole('button', { name: 'Add recurring' }).click();
    await expect(dialog).toBeHidden();

    const [schedule] = await api.call<any[]>('GET', '/schedules');
    expect(schedule).toMatchObject({
      name: 'Streaming Plus',
      amount: -1_599,
      recurrenceType: 'monthly',
      status: 'active',
      startDate: isoDay(1),
    });

    await page.getByRole('tab', { name: 'All recurring' }).click();
    await expect(scheduleRow(page, 'Streaming Plus').first()).toContainText('$15.99');
  });

  test('picking or creating a payee or category keeps what was already filled in', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 500_000);
    await api.createAccount('Savings', 100_000, 'savings');
    await open(page, '/recurring');
    await page.getByRole('main').getByRole('button', { name: 'Add recurring' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add recurring' });
    const name = dialog.getByRole('textbox', { name: 'Name' });
    const account = dialog.getByRole('combobox', { name: 'Account' });

    await name.fill('Gym membership');
    await typeAmount(dialog.getByRole('textbox', { name: 'Amount' }), '45');
    await account.selectOption({ label: 'Savings' });

    // A brand-new payee (creating it refreshes the payee list)
    await dialog.getByRole('textbox', { name: 'Payee' }).fill('Iron Temple Gym');
    await dialog.getByRole('button', { name: /Create new payee/ }).click();
    await expect(dialog.getByRole('textbox', { name: 'Payee' })).toHaveValue('Iron Temple Gym');
    await expect(name).toHaveValue('Gym membership');
    await expect(account).toHaveValue(/.+/);
    await expect(account.locator('option:checked')).toHaveText('Savings');

    // A brand-new category: none of its buttons may submit the form
    await dialog.getByRole('button', { name: /^Category:/ }).click();
    await dialog.getByRole('button', { name: 'Create new category' }).click();
    await dialog.getByRole('textbox', { name: 'New category name' }).fill('Fitness');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Category: Fitness' })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(name).toHaveValue('Gym membership');
    await expect(account.locator('option:checked')).toHaveText('Savings');
    await expect(dialog.getByRole('textbox', { name: 'Payee' })).toHaveValue('Iron Temple Gym');

    await dialog.getByRole('button', { name: 'Add recurring' }).click();
    await expect(dialog).toBeHidden();
    const [schedule] = await api.call<any[]>('GET', '/schedules');
    expect(schedule).toMatchObject({ name: 'Gym membership', amount: -4_500 });
  });

  test('marking a bill paid records the transaction', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 500_000);
    await createRent(api, checking.id);
    await openAll(page);
    await scheduleRow(page, 'Rent').first().getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Mark next as paid' }).click();

    await expect.poll(() => api.balance(checking.id)).toBe(350_000);
    const [paid] = await api.transactions(`?account_id=${checking.id}&from=2000-01-01`);
    expect(paid).toMatchObject({ amount: -150_000, payeeName: 'Rent', date: isoDay(2) });
  });

  test('pausing keeps the schedule settings', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await createRent(api, checking.id, {
      amountType: 'approximate',
      weekendAdjust: 'before',
      dateFlexibility: 6,
      autoCreate: 1,
    });
    await openAll(page);
    await scheduleRow(page, 'Rent').first().getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Pause' }).click();

    await expect
      .poll(async () => (await api.call<any[]>('GET', '/schedules'))[0])
      .toMatchObject({
        status: 'paused',
        amountType: 'approximate',
        weekendAdjust: 'before',
        dateFlexibility: 6,
        autoCreate: 1,
      });
    await scheduleRow(page, 'Rent').first().getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Resume' })).toBeVisible();
  });

  test('cancelling hides a schedule behind "Show cancelled"', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await createRent(api, checking.id);
    await openAll(page);
    await scheduleRow(page, 'Rent').first().getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Cancel recurring' }).click();
    await page
      .getByRole('dialog', { name: 'Stop this recurring item?' })
      .getByRole('button', { name: 'Stop this bill' })
      .click();
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/schedules'))[0].status)
      .toBe('canceled');
    await expect(page.getByText(/Show \d+ cancelled|Show cancelled/)).toBeVisible();
  });

  test('"Find recurring" discovers a subscription from past transactions', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 500_000);
    // Four monthly charges on the 5th
    const now = new Date();
    for (let i = 4; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 5);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`;
      await api.createTransaction({
        accountId: checking.id,
        date,
        amount: -1_299,
        payeeName: 'MusicBox',
      });
    }
    await open(page, '/recurring');
    await page.getByRole('main').getByRole('button', { name: 'Find recurring' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search for recurring transactions' });
    await expect(dialog).toContainText('Every month on the 5th');
    await dialog.getByRole('checkbox', { name: 'Track MusicBox' }).press('Space');
    await expect(dialog.getByRole('checkbox', { name: 'Track MusicBox' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Create 1 recurring' }).click();

    await expect
      .poll(async () => (await api.call<any[]>('GET', '/schedules')).map((s) => s.name))
      .toEqual(['MusicBox']);
    const [schedule] = await api.call<any[]>('GET', '/schedules');
    expect(schedule).toMatchObject({
      recurrenceType: 'monthly',
      amount: -1_299,
      source: 'detected',
    });
  });
  test('shows which bills need a category and lets the owner choose one inline', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 500_000);
    const group = await api.call('POST', '/categories/groups', { name: 'Home', isIncome: 0 });
    const power = await api.call('POST', '/categories', { name: 'Power', groupId: group.id });
    await createRent(api, checking.id);
    const gym = await createRent(api, checking.id, { name: 'Gym', amount: -4_500 });
    await api.call('PUT', `/schedules/${gym.id}`, { categoryId: null });
    await api.call('POST', '/schedules', {
      name: 'Electricity',
      amount: -12_000,
      recurrenceType: 'monthly',
      startDate: isoDay(3),
      accountId: checking.id,
      categoryId: power.id,
    });

    await openAll(page);
    // Rent and Gym have no category; Electricity shows its category name instead
    await expect(page.getByText('Needs category', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Power', { exact: true })).toBeVisible();

    // The filtered view lists only bills with no category
    await open(page, '/recurring?filter=needs-category');
    const list = page.getByRole('list', { name: 'Recurring bills that need a category' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list).not.toContainText('Electricity');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const before = await api.call<any>('GET', `/schedules/${gym.id}`);
    await list
      .getByRole('listitem')
      .filter({ hasText: 'Gym' })
      .getByRole('button', { name: /^Category:/ })
      .click();
    await page.getByRole('button', { name: 'Power', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    const after = await api.call<any>('GET', `/schedules/${gym.id}`);
    expect(after).toMatchObject({ categoryId: power.id, amount: before.amount });
    expect(after.amountConfirmedAt).toBe(before.amountConfirmedAt);
  });
});
