import { test, expect, open, isoDay } from './fixtures';

for (const width of [1400, 390]) {
  test(`quick transaction filters combine and keep their scope at ${width}px`, async ({
    page,
    api,
  }) => {
    const account = await api.createAccount('Everyday');
    const other = await api.createAccount('Other account');
    const groceries = await api.category('Groceries');
    const create = (payeeName: string, accountId = account.id, categoryId: string | null = null) =>
      api.call<{ id: string }>('POST', '/transactions', {
        accountId,
        date: isoDay(),
        amount: -1250,
        payeeName,
        categoryId,
      });
    await create('Mock missing category');
    const filed = await create('Mock filed purchase');
    await api.call('PATCH', `/transactions/${filed.id}/flags`, { reviewed: true });
    const upload = await api.request.post(
      `/api/files?fileName=mock.csv&linkKind=transaction&linkId=${filed.id}`,
      {
        headers: { 'content-type': 'text/csv' },
        data: Buffer.from('Item,Amount\nFood,12.50\n'),
      },
    );
    expect(upload.ok()).toBe(true);
    await create('Mock categorised purchase', account.id, groceries.id);
    await create('Mock other account', other.id);
    await page.setViewportSize({ width, height: 900 });
    const query = new URLSearchParams({
      range: 'this-month',
      search: 'Mock',
      account_ids: account.id,
      category_ids: groceries.id,
      category_group_id: groceries.groupId,
    });
    await open(page, `/transactions?${query}`);
    const rows = page.getByTestId(width < 768 ? 'transaction-card' : 'transaction-row');
    await expect(rows).toHaveCount(1);
    const quick = page.getByRole('group', { name: 'Quick filters', exact: true });
    const uncategorised = quick.getByRole('button', { name: 'Uncategorised', exact: true });
    const unreviewed = quick.getByRole('button', { name: 'Not reviewed', exact: true });
    const noFiles = quick.getByRole('button', { name: 'No receipts or files', exact: true });
    await uncategorised.focus();
    await uncategorised.press('Enter');
    await expect(uncategorised).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(2);
    await expect(page).not.toHaveURL(/category_ids=|category_group_id=/);
    await unreviewed.click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Mock missing category');
    await unreviewed.click();
    await expect(rows).toHaveCount(2);
    await noFiles.click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Mock missing category');
    await expect(page).toHaveURL(/has_files=0/);
    await expect(page).toHaveURL(new RegExp(`account_ids=${account.id}`));
    await expect(page).toHaveURL(/range=this-month/);
    await expect(
      page.getByRole('textbox', { name: 'Search payee or notes', exact: true }),
    ).toHaveValue('Mock');
    await page.reload();
    await expect(uncategorised).toHaveAttribute('aria-pressed', 'true');
    await expect(noFiles).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Advanced filters' })).toHaveCount(0);
    await noFiles.click();
    await expect(rows).toHaveCount(2);
    await uncategorised.click();
    await expect(rows).toHaveCount(3);
    await expect(uncategorised).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
