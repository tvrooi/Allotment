import { test, expect, open, isoDay } from './fixtures';

for (const phone of [false, true]) {
  test(`review categorisation can be undone and redone after the queue empties${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Undo review', 50000);
    const groceries = await api.category('Groceries');
    const payee = 'A very long merchant name for the weekly grocery delivery';
    const transaction = await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -1000,
      payeeName: payee,
      categoryId: null,
      notes: 'Original note',
    });
    await open(page, '/review');
    const category = page.getByRole('button', { name: `Category for ${payee} on`, exact: false });
    await category.click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(category).toHaveCount(0);
    const toast = page.getByTestId('undo-toast');
    await expect(toast).toContainText(payee);
    await expect(toast).toContainText('Groceries');
    if (phone) {
      const undo = toast.getByRole('button', { name: 'Undo', exact: true });
      const box = await undo.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      const notice = await toast.boundingBox();
      expect(notice!.x).toBeGreaterThanOrEqual(0);
      expect(notice!.x + notice!.width).toBeLessThanOrEqual(390);
    }
    await page.screenshot({ path: test.info().outputPath('review-category-undo.png') });
    // A subsequent owner edit must survive category-only undo and redo.
    await api.call('PUT', `/transactions/${transaction.id}`, {
      notes: 'Later note',
      amount: -1200,
    });
    await toast.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(category).toBeVisible();
    expect((await api.transactions()).find((t) => t.id === transaction.id)).toMatchObject({
      categoryId: null,
      notes: 'Later note',
      amount: -1200,
    });
    const undone = await api.call('GET', '/review');
    expect(undone.uncategorisedCount).toBe(1);
    expect(undone.totals.uncategorised).toBe(1200);
    await toast.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(category).toHaveCount(0);
    expect((await api.transactions()).find((t) => t.id === transaction.id)).toMatchObject({
      categoryId: groceries.id,
      notes: 'Later note',
      amount: -1200,
    });
    // Dismissing the notice leaves the same command in the keyboard undo history.
    await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await page.keyboard.press('Control+z');
    await expect(category).toBeVisible();
    await page.keyboard.press('Control+Shift+z');
    await expect(category).toHaveCount(0);
    expect((await api.call('GET', '/review')).uncategorisedCount).toBe(0);
  });

  test(`a failed review undo reports the failure and keeps the category${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Undo failure', 50000);
    const groceries = await api.category('Groceries');
    const transaction = await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -1000,
      payeeName: 'Undo shop',
      categoryId: null,
    });
    await open(page, '/review');
    const category = page.getByRole('button', { name: /Category for Undo shop/ });
    await category.click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(category).toHaveCount(0);
    await page.route(`**/api/transactions/${transaction.id}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Could not restore this category. Try again.' }),
      }),
    );
    const toast = page.getByTestId('undo-toast');
    await toast.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(toast).toHaveAttribute('role', 'alert');
    await expect(toast).toContainText('Could not restore this category. Try again.');
    expect((await api.transactions()).find((t) => t.id === transaction.id).categoryId).toBe(
      groceries.id,
    );
    await expect(category).toHaveCount(0);
    await page.unroute(`**/api/transactions/${transaction.id}`);
    await page.keyboard.press('Control+z');
    await expect(category).toBeVisible();
    expect((await api.transactions()).find((t) => t.id === transaction.id).categoryId).toBeNull();
  });
}

// #245: every undoable change announces itself; Review housekeeping used to be silent
test('categorising a saver in Review housekeeping offers Undo', async ({ page, api }) => {
  const account = await api.createAccount('Mock spending', 50_000);
  const groceries = await api.category('Groceries');
  const moved = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -2_000,
    payeeName: 'Transfer to Mock Splurge',
  });
  await open(page, '/review');
  await page.getByText('Check budget setup').click();
  await page
    .getByRole('combobox', { name: 'Category for Mock Splurge' })
    .selectOption(groceries.id);
  await page.getByRole('button', { name: 'Categorise', exact: true }).click();
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Categorised 1 saver transfer.');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(async () => (await api.transactions()).find((t) => t.id === moved.id)?.categoryId)
    .toBeNull();
});

test('a saver categorise that changes nothing offers no Undo', async ({ page, api }) => {
  const account = await api.createAccount('Mock spending', 50_000);
  const groceries = await api.category('Groceries');
  const moved = await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: -2_000,
    payeeName: 'Transfer to Mock Splurge',
  });
  await open(page, '/review');
  await page.getByText('Check budget setup').click();
  // Meanwhile it gets that category elsewhere, so the categorise changes nothing
  await api.call('PUT', `/transactions/${moved.id}`, { categoryId: groceries.id });
  await page
    .getByRole('combobox', { name: 'Category for Mock Splurge' })
    .selectOption(groceries.id);
  await page.getByRole('button', { name: 'Categorise', exact: true }).click();
  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Categorised 0 saver transfers.');
  await expect(toast.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});
