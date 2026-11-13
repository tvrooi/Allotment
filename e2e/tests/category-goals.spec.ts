import { test, expect, open, thisMonth } from './fixtures';
for (const phone of [false, true]) {
  test(`category goal progress and manual compatibility${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Opening cash', 100000);
    const category = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${category.id}`, { budgeted: 20000 });
    await open(page, '/goals');
    await page.getByRole('button', { name: 'Add goal' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Trip');
    await dialog.getByLabel('Target', { exact: true }).fill('500');
    await dialog.getByLabel('Target', { exact: true }).press('Tab');
    await dialog.getByLabel('Progress source').selectOption(category.id);
    await expect(dialog.getByLabel('Saved so far')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Add goal' }).click();
    await expect(dialog).toBeHidden();
    // The tag, then the category name as bare text beside it in the same line (b47ddd5)
    const funded = page.getByText('Category funded', { exact: true });
    await expect(funded).toBeVisible();
    await expect(funded.locator('..')).toHaveText(/^Category funded\s*Groceries$/);
    await expect(
      page.getByText('Assigned this month $200 · Activity $0 · Available $200', { exact: true }),
    ).toBeVisible();
    await api.call('PUT', `/budget/${thisMonth()}/${category.id}`, { budgeted: 15000 });
    await page.reload();
    await expect(
      page.getByText('Assigned this month $150 · Activity $0 · Available $150', { exact: true }),
    ).toBeVisible();
    // It shows and says where it leads: a chevron, and a link named for its category
    const tripRow = page.getByTestId('goal-row').filter({ hasText: 'Trip' });
    await expect(tripRow.getByTestId('goal-opens-category')).toBeVisible();
    await expect(
      tripRow.getByRole('link', { name: 'Trip: open Groceries in Budget' }),
    ).toBeVisible();
    // One tab stop per destination: the row itself is not focusable, its link is
    await expect(tripRow).not.toHaveAttribute('tabindex');
    // A category-funded row opens its category (#235): a click anywhere on it, the chevron
    // included, and Enter on its link
    await tripRow.getByText('Category funded').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    await tripRow.getByTestId('goal-opens-category').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    await tripRow.getByRole('link', { name: 'Trip: open Groceries in Budget' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    // Every row has a visible Edit, which does not open the category
    await page.getByRole('button', { name: 'Edit Trip' }).click();
    await expect(page).toHaveURL(/#\/goals$/);
    await dialog.getByLabel('Progress source').selectOption('');
    await expect(dialog.getByLabel('Saved so far')).toHaveValue('');
    await dialog.getByLabel('Saved so far').fill('75');
    await dialog.getByLabel('Saved so far').press('Tab');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    const rows = await api.call('GET', '/goals');
    expect(rows[0]).toMatchObject({ categoryId: null, currentAmount: 7500 });
    await expect(page.getByText('Tracked by hand', { exact: true })).toBeVisible();
    // A row tracked by hand has neither, and keeps opening the edit dialog
    await expect(tripRow.getByTestId('goal-opens-category')).toHaveCount(0);
    await expect(tripRow.getByRole('link', { name: /open .* in Budget/ })).toHaveCount(0);

    await page.getByText('Trip', { exact: true }).click();
    await expect(dialog.getByLabel('Saved so far')).toBeVisible();
    await expect(page).toHaveURL(/#\/goals$/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    // Its Edit opens the dialog from the keyboard, Space as well as Enter
    await page.getByRole('button', { name: 'Edit Trip' }).focus();
    await page.keyboard.press('Space');
    await expect(dialog.getByLabel('Saved so far')).toBeVisible();
  });
}

// UX audit AU-009: the confirmation used to say "This cannot be undone" although Undo works
test('deleting a goal says it can be undone, and Undo brings it back', async ({ page, api }) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  await open(page, '/goals');
  await page.getByRole('button', { name: 'Actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Delete goal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete goal' });
  await expect(dialog).toContainText('You can undo this');
  await expect(dialog).not.toContainText('cannot be undone');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Holiday', { exact: true })).toHaveCount(0);

  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Deleted goal "Holiday".');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Holiday', { exact: true })).toBeVisible();
  expect((await api.call('GET', '/goals')).map((g: { name: string }) => g.name)).toEqual([
    'Holiday',
  ]);
});

test('a long goal name wraps on a phone instead of being cut off (#235)', async ({ page, api }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const category = await api.category('Groceries');
  await api.call('POST', '/goals', {
    name: 'Anniversary trip to Tasmania with the family',
    targetAmount: 450_000,
    categoryId: category.id,
  });
  await open(page, '/goals');
  const name = page.getByRole('link', { name: /^Anniversary trip to Tasmania with the family:/ });
  await expect(name).toBeVisible();
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await name.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(24);
});

test('a goal grows from a sprout to a flower as it fills (#241)', async ({ page, api }) => {
  await api.createAccount('Opening cash', 100000);
  for (const [name, current] of [
    ['Bike', 2_500],
    ['Holiday', 7_500],
    ['Laptop', 10_000],
  ] as const)
    await api.call('POST', '/goals', { name, targetAmount: 10_000, currentAmount: current });
  await open(page, '/goals');
  const bar = (name: string) => page.getByRole('progressbar', { name: `${name} progress` });
  await expect(bar('Bike')).toHaveAttribute('aria-valuenow', '25');
  await expect(bar('Bike')).toHaveAttribute('data-stage', 'sprout');
  await expect(bar('Holiday')).toHaveAttribute('data-stage', 'bud');
  await expect(bar('Laptop')).toHaveAttribute('data-stage', 'flower');
  // A reached goal blooms the first time it is seen on this device, then stays still
  await expect(bar('Laptop').getByTestId('goal-plant')).toHaveAttribute('data-bloom', 'true');
  await page.reload();
  await expect(bar('Laptop').getByTestId('goal-plant')).toHaveAttribute('data-bloom', 'false');
});
