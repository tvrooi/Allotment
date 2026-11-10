import { test, expect, open, isoDay } from './fixtures';

for (const phone of [false, true]) {
  test(`review groups repeated payees within personal accounts and undoes the whole group${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const personal = await api.createAccount('Personal', 100000, 'checking', { currency: 'AUD' });
    const second = await api.createAccount('Second personal', 100000);
    const off = await api.createAccount('Outside budget', 100000, 'checking', {
      isOffBudget: 1,
    });
    const pool = await api.createAccount('Household pool', 100000, 'checking', { currency: 'AUD' });
    await api.call('POST', '/households', {
      name: 'Home',
      currency: 'AUD',
      accountId: pool.id,
      people: ['Me', 'Alex'],
      selfIndex: 0,
    });
    const groceries = await api.category('Groceries');
    const restaurants = await api.category('Restaurants');
    const payeeName = 'Repeated grocery merchant';
    const add = (accountId: string, categoryId: string | null = null, merchant = payeeName) =>
      api.createTransaction({
        accountId,
        date: isoDay(),
        amount: -1000,
        payeeName: merchant,
        categoryId,
      });
    const first = await add(personal.id);
    const other = await add(second.id);
    const untouched = [
      await add(off.id),
      await add(pool.id),
      await add(personal.id, restaurants.id),
    ];
    await add(personal.id, null, 'One-off merchant');
    await open(page, '/review');
    const toggle = page.getByRole('button', { name: 'Sort repeated payees together', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    const group = page.getByRole('region', { name: 'Sort repeated payees', exact: true });
    await expect(group.getByLabel('Also apply to future transactions')).not.toBeChecked();
    const picker = group.getByRole('button', { name: `Category for ${payeeName}`, exact: true });
    await expect(picker).toBeVisible();
    await expect(group).toContainText('2 transactions');
    await expect(
      group.getByRole('button', { name: 'Category for One-off merchant', exact: true }),
    ).toHaveCount(0);
    const inspect = group.getByRole('link', {
      name: `View transactions for ${payeeName}`,
      exact: true,
    });
    await inspect.click();
    await expect(page).toHaveURL(/transactions\?/);
    const selection = new URLSearchParams(page.url().split('?')[1]);
    expect(selection.get('range')).toBe('all');
    expect(selection.get('uncategorized')).toBe('1');
    expect(selection.get('account_ids')?.split(',').sort()).toEqual(
      [personal.id, second.id].sort(),
    );
    const register = page.getByTestId(phone ? 'transaction-card' : 'transaction-row');
    await expect(register).toHaveCount(2);
    await expect(register.filter({ hasText: payeeName })).toHaveCount(2);
    await page.reload();
    await expect(register).toHaveCount(2);
    await page.goBack();
    await page.getByRole('button', { name: 'Sort repeated payees together', exact: true }).click();
    await expect(picker).toBeVisible();
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('review-payees.png') });
    await picker.click();
    const search = page.getByRole('textbox', { name: 'Search categories' });
    await search.fill('Groceries');
    await page.keyboard.press('Escape');
    await expect(picker).toBeFocused();
    await picker.click();
    await search.fill('Groceries');
    await page.keyboard.press('Enter');
    const toast = page.getByTestId('undo-toast');
    await expect(toast).toContainText('2 transactions');
    const rows = await api.transactions();
    expect(
      rows
        .filter((t) => [first.id, other.id].includes(t.id))
        .every((t) => t.categoryId === groceries.id),
    ).toBe(true);
    for (const original of untouched)
      expect(rows.find((t) => t.id === original.id)?.categoryId).toBe(original.categoryId);
    const payee = (await api.call('GET', '/payees')).find(
      (p: { name: string }) => p.name === payeeName,
    );
    expect(payee.defaultCategoryId).toBeNull();
    await toast.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(picker).toBeVisible();
    expect(
      (await api.transactions())
        .filter((t) => [first.id, other.id].includes(t.id))
        .every((t) => t.categoryId === null),
    ).toBe(true);
    await toast.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(picker).toHaveCount(0);
    expect(
      (await api.transactions())
        .filter((t) => [first.id, other.id].includes(t.id))
        .every((t) => t.categoryId === groceries.id),
    ).toBe(true);
    if (phone) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test(`review future categorisation is opt-in and its default is undoable${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Personal', 100000);
    const old = await api.category('Restaurants');
    const next = await api.category('Groceries');
    const payee = await api.call('POST', '/payees', {
      name: 'Regular shop',
    });
    for (let i = 0; i < 2; i++)
      await api.createTransaction({
        accountId: account.id,
        date: isoDay(),
        amount: -1000,
        payeeName: 'Regular shop',
        categoryId: null,
      });
    await api.call('PUT', `/payees/${payee.id}`, { defaultCategoryId: old.id });
    await open(page, '/review');
    await page.getByRole('button', { name: 'Sort repeated payees together', exact: true }).click();
    const group = page.getByRole('region', { name: 'Sort repeated payees', exact: true });
    await group.getByLabel('Also apply to future transactions').check();
    await group.getByRole('button', { name: 'Category for Regular shop', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    const toast = page.getByTestId('undo-toast');
    await expect(toast).toContainText('Future transactions will use this category too.');
    const currentDefault = async () =>
      (await api.call('GET', '/payees')).find((p: { id: string }) => p.id === payee.id)
        .defaultCategoryId;
    expect(await currentDefault()).toBe(next.id);
    await toast.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Uncategorised spending (2)' })).toBeVisible();
    expect(await currentDefault()).toBe(old.id);
    await toast.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Uncategorised spending (2)' })).toHaveCount(0);
    expect(await currentDefault()).toBe(next.id);
  });
  test(`a failed grouped sort restores the previous future default${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Personal', 100000);
    const old = await api.category('Restaurants');
    const payee = await api.call('POST', '/payees', {
      name: 'Retry merchant',
    });
    for (let i = 0; i < 2; i++)
      await api.createTransaction({
        accountId: account.id,
        date: isoDay(),
        amount: -1000,
        payeeName: 'Retry merchant',
        categoryId: null,
      });
    await api.call('PUT', `/payees/${payee.id}`, { defaultCategoryId: old.id });
    await open(page, '/review');
    await page.getByRole('button', { name: 'Sort repeated payees together', exact: true }).click();
    const group = page.getByRole('region', { name: 'Sort repeated payees', exact: true });
    await group.getByLabel('Also apply to future transactions').check();
    await page.route('**/api/transactions/bulk', (route) =>
      route.request().postDataJSON().preview
        ? route.continue()
        : route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Could not sort these transactions. Try again.' }),
          }),
    );
    await group.getByRole('button', { name: 'Category for Retry merchant', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search categories' }).fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(group.getByRole('alert')).toContainText(
      'Could not sort these transactions. Try again.',
    );
    expect(
      (await api.call('GET', '/payees')).find((p: { id: string }) => p.id === payee.id)
        .defaultCategoryId,
    ).toBe(old.id);
    expect((await api.transactions()).every((t) => t.categoryId === null)).toBe(true);
    await expect(page.getByTestId('undo-toast')).toHaveCount(0);
    await page.unroute('**/api/transactions/bulk');
    await expect(
      group.getByRole('button', { name: 'Category for Retry merchant', exact: true }),
    ).toBeEnabled();
  });
}
