import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth, categoryOption, typeAmount } from './fixtures';

/** Move money's From or To: a category button (named "Move from: <shown>") over the picker */
const moveField = (page: Page, side: 'from' | 'to') =>
  page.getByRole('button', { name: new RegExp(`^Move ${side}: `) });
/** Opens that button and picks the row whose name starts with `name` */
async function pickMove(page: Page, side: 'from' | 'to', name: string) {
  await moveField(page, side).click();
  await categoryOption(
    page,
    new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`),
  ).click();
  await expect(moveField(page, side)).toHaveAccessibleName(`Move ${side}: ${name}`);
}
for (const phone of [false, true]) {
  test(`rollover, refunds, cover and undo${phone ? ' on phone' : ''}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Cash', 0);
    const food = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    const month = thisMonth();
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    const prior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // Last month's assignment needs money that had arrived by then
    await api.createTransaction({
      accountId: account.id,
      date: `${prior}-15`,
      amount: 100000,
      categoryId: (await api.category('Paychecks')).id,
    });
    await api.call('PUT', `/budget/${prior}/${food.id}`, { budgeted: 60000 });
    await api.call('PUT', `/budget/${month}/${food.id}`, { budgeted: 10000 });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -50000,
      categoryId: food.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 5000,
      categoryId: food.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -5000,
      categoryId: rent.id,
    });
    // Rent's $50 deficit is red this month and leaves next month's Ready to Assign
    expect(await api.call('GET', `/budget/${month}/summary`)).toMatchObject({
      toBeBudgeted: 30000,
      overspent: 5000,
      resolved: false,
    });
    const n = new Date(`${month}-01T12:00:00`);
    n.setMonth(n.getMonth() + 1);
    const next = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    expect((await api.call('GET', `/budget/${next}/summary`)).toBeBudgeted).toBe(25000);
    await open(page, '/budget');
    const row = phone
      ? page.getByTestId('budget-card').filter({ hasText: 'Groceries' })
      : page.locator('tr').filter({ hasText: 'Groceries' });
    await expect(row).toContainText('$250');
    await expect(row).toContainText('-$450');
    await page
      .getByRole('button', { name: /^(Cover overspending|Move between envelopes)$/ })
      .click();
    await pickMove(page, 'from', 'Groceries');
    await pickMove(page, 'to', 'Rent / Mortgage');
    await page.getByLabel('Move amount').fill('50');
    await page.getByRole('button', { name: 'Preview move' }).click();
    await expect(page.getByRole('region', { name: 'Money move preview' })).toContainText(
      'From available after move: $200',
    );
    await page.getByRole('button', { name: 'Apply move' }).click();
    await expect(page.getByText('Money moved.', { exact: true })).toBeVisible();
    await expect(row).toContainText('$200');
    expect((await api.call('GET', `/budget/${month}/summary`)).overspent).toBe(0);
    await page.getByText('Money move history', { exact: true }).click();
    await page.getByRole('button', { name: 'Undo move', exact: true }).click();
    await expect(row).toContainText('$250');
    await row.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${food.id}$`));
    // The budget page has its own "Available" labels; wait for it to give way to the category page
    const available = page.getByText('Available', { exact: true });
    await expect(available).toHaveCount(1);
    await expect(available).toBeVisible();
    await expect(page.getByText('$250', { exact: true }).first()).toBeVisible();
  });
}

// BUD-06: the Available figure on a row opens Move money with that envelope filled in
for (const phone of [false, true]) {
  test(`cover from a row, and give money back to Ready to assign${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Cash', 0);
    const food = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    const month = thisMonth();
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 100000,
      categoryId: (await api.category('Paychecks')).id,
    });
    await api.call('PUT', `/budget/${month}/${food.id}`, { budgeted: 40000 });
    await api.call('PUT', `/budget/${month}/${rent.id}`, { budgeted: 10000 });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -15000,
      categoryId: rent.id,
    });
    await open(page, '/budget');
    const cardOf = (name: string) =>
      phone
        ? page.getByTestId('budget-card').filter({ hasText: name })
        : page.locator('tr').filter({ hasText: name });
    const preview = page.getByRole('region', { name: 'Money move preview' });
    const ready = async () => (await api.call('GET', `/budget/${month}/summary`)).toBeBudgeted;

    // Cover Rent: the panel opens with Rent as the destination and its deficit as the amount
    await page.getByRole('button', { name: 'Cover Rent / Mortgage: $50 overspent' }).click();
    await expect(moveField(page, 'to')).toHaveAccessibleName('Move to: Rent / Mortgage');
    await expect(page.getByLabel('Move amount')).toHaveValue('$50');
    await pickMove(page, 'from', 'Groceries');
    await page.getByRole('button', { name: 'Preview move' }).click();
    await expect(preview).toContainText('From available after move: $350');
    await expect(preview).toContainText('To available after move: $0');
    await page.getByRole('button', { name: 'Apply move' }).click();
    await expect(page.getByText('Money moved.', { exact: true })).toBeVisible();
    await expect(cardOf('Groceries')).toContainText('$350');
    expect((await api.call('GET', `/budget/${month}/summary`)).overspent).toBe(0);

    // A request is used once: changing month and coming back doesn't reopen it
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(cardOf('Groceries')).toContainText('$350');
    await expect(page.getByLabel('Move amount')).toBeHidden();

    // On a phone, a filtered list still shows the panel when a row asks for it
    if (phone) {
      await page.getByLabel('Find a category').fill('Grocer');
      await page.getByRole('button', { name: 'Move money from Groceries: $350 available' }).click();
      await expect(moveField(page, 'from')).toHaveAccessibleName('Move from: Groceries');
      await page.getByLabel('Find a category').fill('');
    }

    // Give $10 back from Groceries: the preview, a cancel that writes nothing, then the move
    const before = await ready();
    await page.getByRole('button', { name: 'Move money from Groceries: $350 available' }).click();
    await expect(moveField(page, 'from')).toHaveAccessibleName('Move from: Groceries');
    await pickMove(page, 'to', 'Ready to assign');
    await page.getByLabel('Move amount').fill('10');
    await page.getByRole('button', { name: 'Preview move' }).click();
    await expect(preview).toContainText('From available after move: $340');
    await expect(preview).toContainText(`Ready to assign after move: $${(before + 1000) / 100}`);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(preview).toHaveCount(0);
    expect(await ready()).toBe(before);
    await page.getByRole('button', { name: 'Preview move' }).click();
    await page.getByRole('button', { name: 'Apply move' }).click();
    await expect(page.getByText('Money moved.', { exact: true })).toBeVisible();
    await expect(cardOf('Groceries')).toContainText('$340');
    expect(await ready()).toBe(before + 1000);
    // The history names Ready to assign, and undo restores Groceries
    await page.getByText('Money move history', { exact: true }).click();
    await expect(page.getByText('Groceries → Ready to assign')).toBeVisible();
    await page.getByRole('button', { name: 'Undo move', exact: true }).first().click();
    await expect(cardOf('Groceries')).toContainText('$350');
    expect(await ready()).toBe(before);
  });
}

test('Move money has its own guide page, linked from the panel', async ({ page }) => {
  await open(page, '/budget');
  await page.getByRole('button', { name: /^(Cover overspending|Move between envelopes)$/ }).click();
  await page.getByRole('link', { name: 'How moving money works' }).click();
  await expect(page).toHaveURL(/#\/guide\/move-money$/);
  await expect(
    page.getByRole('heading', { name: 'Giving money back to Ready to assign' }),
  ).toBeVisible();
});

for (const phone of [false, true]) {
  test(`an envelope linked to an account holds what the account holds${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const spending = await api.createAccount('Spending', 0);
    const saver = await api.createAccount('Rent saver', 0, 'savings');
    const rent = await api.category('Rent / Mortgage');
    await api.createTransaction({
      accountId: spending.id,
      date: isoDay(),
      amount: 300000,
      categoryId: (await api.category('Paychecks')).id,
    });
    await api.call('PUT', `/categories/${rent.id}`, { linkedAccountId: saver.id });
    await api.call('POST', '/transactions/transfer', {
      fromAccountId: spending.id,
      toAccountId: saver.id,
      date: isoDay(),
      amount: 82550,
    });
    // An assignment would change nothing, so the server refuses it
    await expect(
      api.call('PUT', `/budget/${thisMonth()}/${rent.id}`, { budgeted: 1000 }),
    ).rejects.toThrow(/409.*follows the Rent saver account/);

    await open(page, '/budget');
    const row = phone
      ? page.getByTestId('budget-card').filter({ hasText: 'Rent / Mortgage' })
      : page.locator('tr').filter({ hasText: 'Rent / Mortgage' });
    await expect(row.getByTestId('transferred-note')).toContainText('Follows Rent saver');
    await expect(row.getByTestId('transferred-note')).toContainText('holds $825.50');
    await expect(row).toContainText('$825.50');
    // Funded by a transfer, never an assignment
    await expect(row.getByRole('button', { name: /^Assigned to Rent/ })).toHaveCount(0);
  });
}

// A typed negative amount is refused before any preview, as the old field did
test('a negative move amount is refused', async ({ page, api }) => {
  await api.category('Groceries');
  await api.category('Rent / Mortgage');
  await open(page, '/budget');
  await page.getByRole('button', { name: /^(Cover overspending|Move between envelopes)$/ }).click();
  await pickMove(page, 'from', 'Groceries');
  await pickMove(page, 'to', 'Rent / Mortgage');
  await typeAmount(page.getByLabel('Move amount'), '-50');
  await page.getByRole('button', { name: 'Preview move' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Enter a positive amount.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Money move preview' })).toHaveCount(0);
});

// Passing through the amount without editing it keeps the preview; an edit retires it
test('tabbing through an unchanged move amount keeps the preview', async ({ page, api }) => {
  const account = await api.createAccount('Cash', 0);
  const food = await api.category('Groceries');
  await api.category('Rent / Mortgage');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 100000,
    categoryId: (await api.category('Paychecks')).id,
  });
  await api.call('PUT', `/budget/${thisMonth()}/${food.id}`, { budgeted: 40000 });
  await open(page, '/budget');
  await page.getByRole('button', { name: /^(Cover overspending|Move between envelopes)$/ }).click();
  await pickMove(page, 'from', 'Groceries');
  await pickMove(page, 'to', 'Rent / Mortgage');
  const amount = page.getByLabel('Move amount');
  await typeAmount(amount, '50');
  await page.getByRole('button', { name: 'Preview move' }).click();
  const apply = page.getByRole('button', { name: 'Apply move' });
  await expect(apply).toBeVisible();
  await amount.focus();
  await expect(amount).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(apply).toBeVisible();
  await typeAmount(amount, '60');
  await expect(apply).toHaveCount(0);
});
