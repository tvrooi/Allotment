import { test, expect, open, isoDay } from './fixtures';

for (const phone of [false, true])
  test(`the review resolves items in place and agrees with the budget${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Review cash', 50000);
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

    const category = attention.getByRole('button', { name: /Category for Mystery shop/ });
    await category.click();
    const search = page.getByRole('textbox', { name: 'Search categories' });
    await expect(search).toBeFocused();
    await search.fill('no matching category');
    await expect(page.getByText('No categories found', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(search).toHaveCount(0);
    await expect(category).toBeFocused();
    // Cancelling search never writes the transaction.
    expect((await api.call('GET', '/review')).uncategorisedCount).toBe(1);
    await category.click();
    const create = page.getByRole('button', { name: 'Create new category', exact: true });
    const bottom = await create.boundingBox();
    expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 7);
    if (phone) {
      await expect(search).toHaveCSS('font-size', '16px');
      const option = page.getByRole('button', { name: 'Groceries', exact: true });
      // The menu scales in; measure its target after the entrance reaches full size.
      await expect
        .poll(async () => (await option.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(44);
    }
    await search.fill('gRoCeR');
    await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rent', exact: true })).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(attention).toBeHidden();
    await expect(page.getByText('Overspent categories')).toBeVisible();
    const month = isoDay().slice(0, 7);
    const summary = await api.call('GET', `/budget/${month}/summary`);
    const review = await api.call('GET', '/review');
    expect(summary.uncategorized).toBe(0);
    expect(review.totals).toMatchObject({ uncategorised: 0, deficits: summary.overspent });
    expect(review.totals.deficits).toBe(2000);
  });

for (const phone of [false, true])
  test(`review keeps a short queue and records a check-in after the details${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Review queue', 10000);
    const groceries = await api.category('Groceries');
    // Assign existing cash first; subsequent spending creates a real overassigned state.
    await api.call('PUT', `/budget/${isoDay().slice(0, 7)}/${groceries.id}`, { budgeted: 9000 });
    for (let i = 0; i < 5; i++)
      await api.createTransaction({
        accountId: account.id,
        date: isoDay(),
        amount: -1000,
        payeeName: `Queue shop ${i}`,
        categoryId: null,
      });
    await open(page, '/review');
    const queue = page.getByRole('region', { name: 'Uncategorised spending (5)' });
    await expect(queue.getByRole('button', { name: /^Category for/ })).toHaveCount(3);
    const expand = queue.getByRole('button', { name: 'Show all 5 transactions' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(queue.getByRole('button', { name: /^Category for/ })).toHaveCount(5);
    await queue.getByRole('button', { name: 'Show fewer transactions' }).click();
    await expect(queue.getByRole('button', { name: /^Category for/ })).toHaveCount(3);
    const filter = page.getByRole('combobox', { name: /^Category details/ });
    await filter.selectOption(groceries.groupId);
    await expect(
      page.getByText('Totals and other review items include all groups.', { exact: false }),
    ).toBeVisible();
    await expect(queue.getByRole('button', { name: /^Category for/ })).toHaveCount(3);
    const step = page.getByRole('button', { name: /Assign the money you already have/ });
    await expect(step).toHaveAttribute('aria-expanded', 'false');
    await step.click();
    await expect(
      page.getByText(/more is assigned than you have. Reduce assignments/),
    ).toBeVisible();
    const record = page.getByRole('button', { name: 'Record today’s review' });
    expect(
      await record.evaluate((el) =>
        Boolean(
          document.querySelector('[data-guide="review.attention"]')!.compareDocumentPosition(el) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    const before = await api.call('GET', '/review');
    await record.click();
    await expect(page.getByLabel('Resume budgeting')).toContainText('Last review');
    expect((await api.call('GET', '/review/resume')).lastReview).not.toBeNull();
    const after = await api.call('GET', '/review');
    expect(after.totals).toEqual(before.totals);
    expect(after.uncategorisedCount).toBe(5);
    if (phone) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      expect(
        await page
          .getByRole('heading', { name: 'Review', exact: true })
          .evaluate((el) => el.getBoundingClientRect().bottom),
      ).toBeLessThan(0);
    }
  });

for (const phone of [false, true])
  test(`review category search recovers from a failed save and keeps keyboard focus${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const account = await api.createAccount('Search queue', 50000);
    const transaction = await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -100,
      payeeName: 'Retry shop',
      categoryId: null,
    });
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: -200,
      payeeName: 'Next shop',
      categoryId: null,
    });
    await open(page, '/review');
    const retry = page.getByRole('button', { name: /Category for Retry shop/ });
    const search = page.getByRole('textbox', { name: 'Search categories' });
    await page.route(`**/api/transactions/${transaction.id}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Could not save this category. Try again.' }),
      }),
    );
    await retry.click();
    await search.fill('Groceries');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('Could not save this category. Try again.');
    await expect(retry).toBeEnabled();
    await expect(retry).toBeFocused();
    expect((await api.transactions()).find((t) => t.id === transaction.id).categoryId).toBeNull();
    await page.unroute(`**/api/transactions/${transaction.id}`);
    await retry.click();
    await search.fill('Groceries');
    await page.getByRole('button', { name: 'Groceries', exact: true }).click();
    await expect(retry).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Category for Next shop/ })).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

test('Wave D: possible transfers open for owner review and dismissal refreshes the step', async ({
  page,
  api,
}) => {
  const a = await api.createAccount('Everyday', 100_000);
  const b = await api.createAccount('Savings', 0, 'savings');
  await api.createTransaction({
    accountId: a.id,
    date: '2026-11-01',
    amount: -12_345,
    payeeName: 'Move out',
  });
  await api.createTransaction({
    accountId: b.id,
    date: '2026-11-01',
    amount: 12_345,
    payeeName: 'Move in',
  });
  await open(page, '/dashboard');
  await page.getByRole('button', { name: 'Hide getting started', exact: true }).click();
  await page.getByRole('link', { name: 'Check transfers', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Possible transfers' })).toBeVisible();
  await page.keyboard.press('Escape');
  await open(page, '/review');
  const step = page.getByRole('link', { name: 'Check 1 possible transfer', exact: true });
  await expect(step).toBeVisible();
  await step.click();
  await expect(page).toHaveURL(/#\/transactions/);
  const dialog = page.getByRole('dialog', { name: 'Possible transfers' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^Not a transfer:/ }).click();
  await page.keyboard.press('Escape');
  await open(page, '/review');
  await expect(step).toHaveCount(0);
});
