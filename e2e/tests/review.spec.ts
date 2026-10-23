import { test, expect, open, isoDay } from './fixtures';

for (const phone of [false, true])
  test(`the review resolves items in place and agrees with the budget${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Review cash', 50000);
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -2000,
      payeeName: 'Mystery shop',
      categoryId: null,
    });

    await open(page, '/review');
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
    const attention = page.getByRole('region', { name: 'Uncategorised spending (1)' });
    await expect(attention).toContainText('Mystery shop');
    await expect(page.getByText('Assign the money you already have')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Next month and buffer' })).toBeVisible();
    // A brand-new budget has no spending history to measure a runway against.
    await expect(page.getByText('Runway incomplete')).toBeVisible();
    if (phone)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );

    await attention.getByLabel(/Category for Mystery shop/).selectOption(groceries.id);
    await expect(attention).toBeHidden();
    await expect(page.getByText('Overspent categories')).toBeVisible();
    const month = isoDay().slice(0, 7);
    const summary = await api.call('GET', `/budget/${month}/summary`);
    const review = await api.call('GET', '/review');
    expect(summary.uncategorized).toBe(0);
    expect(review.totals).toMatchObject({ uncategorised: 0, deficits: summary.overspent });
    expect(review.totals.deficits).toBe(2000);
  });
