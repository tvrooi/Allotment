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
    await page.getByRole('button', { name: 'Add Goal' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Trip');
    await dialog.getByLabel('Target', { exact: true }).fill('500');
    await dialog.getByLabel('Progress source').selectOption(category.id);
    await expect(dialog.getByLabel('Saved so far')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Add Goal' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Category funded: Groceries', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Assigned this month $200 · Activity $0 · Available $200', { exact: true }),
    ).toBeVisible();
    await api.call('PUT', `/budget/${thisMonth()}/${category.id}`, { budgeted: 15000 });
    await page.reload();
    await expect(
      page.getByText('Assigned this month $150 · Activity $0 · Available $150', { exact: true }),
    ).toBeVisible();
    await page.getByText('Trip', { exact: true }).click();
    await dialog.getByLabel('Progress source').selectOption('');
    await expect(dialog.getByLabel('Saved so far')).toHaveValue('0');
    await dialog.getByLabel('Saved so far').fill('75');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    const rows = await api.call('GET', '/goals');
    expect(rows[0]).toMatchObject({ categoryId: null, currentAmount: 7500 });
    await expect(page.getByText('Manual tracking', { exact: true })).toBeVisible();
  });
}
