import { test, expect, open, isoDay, fillDate } from './fixtures';

for (const width of [1400, 390]) {
  test(`advanced filters keep the ledger visible at ${width}px`, async ({ page, api }) => {
    const account = await api.createAccount('Everyday');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -4250,
      payeeName: 'Corner shop',
      categoryId: groceries.id,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 10000,
      payeeName: 'Pay day',
    });
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/transactions');
    const trigger = page.getByRole('button', { name: /^Filters/ });
    await trigger.click();
    const filters = page.getByRole('region', { name: 'Advanced filters' });
    await expect(filters.getByRole('tabpanel', { name: 'Categories', exact: true })).toBeVisible();
    await expect(filters.getByRole('tabpanel')).toHaveCount(1);
    expect((await filters.boundingBox())!.height).toBeLessThan(240);
    const rows = page.getByTestId(width < 768 ? 'transaction-card' : 'transaction-row');
    await expect(rows.first()).toBeInViewport({ ratio: 0.5 });

    // Each tab keeps its local search and an invalid amount without silently applying it.
    await page.getByRole('searchbox', { name: 'Find categories' }).fill('Grocer');
    const categories = page.getByRole('tab', { name: 'Categories', exact: true });
    await categories.focus();
    await categories.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Accounts', exact: true })).toBeFocused();
    await categories.click();
    await expect(page.getByRole('searchbox', { name: 'Find categories' })).toHaveValue('Grocer');
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await page.getByLabel('At least').fill('oops');
    await page.getByRole('tab', { name: 'Status', exact: true }).click();
    await page.getByRole('tab', { name: 'Money', exact: true }).click();
    await expect(page.getByLabel('At least')).toHaveValue('oops');
    await expect(page.getByLabel('At least')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('At least').fill('40');
    await page.getByLabel('At least').press('Enter');
    await filters.getByRole('button', { name: 'Money out', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Corner shop');
    await filters.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(filters).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('button', { name: 'Clear Money out', exact: true })).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('tab', { name: 'Money', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByLabel('At least').press('Escape');
    await expect(filters).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'This month', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}

for (const width of [1400, 390]) {
  test(`Wave D: an empty custom date range stays editable at ${width}px`, async ({ page, api }) => {
    await api.createAccount('Everyday');
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/transactions');
    const custom = page.getByRole('button', { name: 'Custom', exact: true });
    await custom.click();
    await expect(custom).toHaveAttribute('aria-pressed', 'true');
    // The shared DatePicker: typed segments in a group on desktop, the native date input on
    // phones, so the field is found by its group or its label and its day read from the URL
    const field = (name: string) =>
      width < 768
        ? page.getByLabel(name, { exact: true })
        : page.getByRole('group', { name, exact: true });
    await expect(field('From')).toBeVisible();
    await expect(field('To')).toBeVisible();
    await fillDate(page, 'From', '2026-11-01');
    await expect(page).toHaveURL(/[?&]from=2026-11-01(&|$)/);
    await expect(custom).toHaveAttribute('aria-pressed', 'true');
    // Desktop's DatePicker has a Clear button (the phone's native input has none): it drops the
    // day from the link and keeps Custom chosen (03-24 review WR-03)
    if (width >= 768) {
      await page.getByRole('button', { name: 'Clear From', exact: true }).click();
      await expect(page).not.toHaveURL(/[?&]from=/);
      await expect(custom).toHaveAttribute('aria-pressed', 'true');
    }
  });
}

// 0 is a bound of its own: "At most 0" lists only the zero-amount rows and keeps max_amount=0 in
// the link, while an emptied field is no bound at all (03-24 review WR-01)
test('At most 0 lists only zero-amount rows, and emptying it lifts the bound', async ({
  page,
  api,
}) => {
  const account = await api.createAccount('Everyday');
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 0,
    payeeName: 'Fee waived',
  });
  await api.createTransaction({
    accountId: account.id,
    date: isoDay(),
    amount: 2500,
    payeeName: 'Refund',
  });
  await page.setViewportSize({ width: 1400, height: 900 });
  await open(page, '/transactions');
  const rows = page.getByTestId('transaction-row');
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('tab', { name: 'Money', exact: true }).click();
  const atMost = page.getByLabel('At most');
  await atMost.fill('0');
  await atMost.press('Enter');
  await expect(page).toHaveURL(/[?&]max_amount=0(&|$)/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Fee waived');
  // Back in the field, the bound is still 0, not emptied
  await atMost.click();
  await expect(atMost).toHaveValue('0');
  await atMost.fill('');
  await atMost.press('Enter');
  await expect(page).not.toHaveURL(/[?&]max_amount=/);
  await expect(rows).toHaveCount(2);
});
