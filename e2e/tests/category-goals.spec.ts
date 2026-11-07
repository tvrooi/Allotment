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
    await expect(dialog.getByLabel('Saved so far')).toHaveValue('');
    await dialog.getByLabel('Saved so far').fill('75');
    await dialog.getByLabel('Saved so far').press('Tab');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    const rows = await api.call('GET', '/goals');
    expect(rows[0]).toMatchObject({ categoryId: null, currentAmount: 7500 });
    await expect(page.getByText('Manual tracking', { exact: true })).toBeVisible();
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
