import { test, expect, open, isoDay } from '../fixtures';

// #240: at 390 px every page's title starts 16 px from the screen's edge (PAGE_GUTTER in
// client/src/components/ui/pageGutter.ts). Measured where the title row's content starts: the
// left padding of the nearest padded box around the page's h1, so a leading icon or
// breadcrumb counts as the start of the row.

test('every page title starts 16 px from the edge on a phone', async ({ page, api }) => {
  test.setTimeout(120_000);
  const checking = await api.createAccount('Everyday Checking', 250_000);
  const groceries = await api.category('Groceries');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -4_250,
    payeeName: 'Corner Grocery',
    categoryId: groceries.id,
  });
  const payee = (await api.call<{ id: string; name: string }[]>('GET', '/payees')).find(
    (p) => p.name === 'Corner Grocery',
  )!;
  await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });

  const routes = [
    '/dashboard',
    '/accounts',
    `/accounts/${checking.id}`,
    `/accounts/${checking.id}/reconcile`,
    '/transactions',
    '/budget',
    `/budget/category/${groceries.id}`,
    '/budget/year',
    '/household',
    '/payment-plans',
    '/recurring',
    '/cash-flow',
    '/reports',
    '/reports/custom',
    '/payees',
    `/payees/${payee.id}`,
    '/rules',
    '/settings',
    '/goals',
    '/forecast',
    '/investments',
    '/tax',
    '/files',
    '/review',
    '/guide',
  ];

  const starts: Record<string, number> = {};
  const measure = async (name: string) => {
    const title = page.getByRole('main').getByRole('heading', { level: 1 }).first();
    await expect(title).toBeVisible();
    starts[name] = await title.evaluate((h1) => {
      for (let el: Element | null = h1; el; el = el.parentElement) {
        const pad = parseFloat(getComputedStyle(el).paddingLeft);
        if (pad > 0) return Math.round(el.getBoundingClientRect().left + pad);
      }
      return Math.round(h1.getBoundingClientRect().left);
    });
  };
  for (const route of routes) {
    await open(page, route);
    await measure(route);
  }
  // Budget's payday view draws its own title row
  await open(page, '/budget');
  // On a phone it is in the More menu
  await page.getByRole('button', { name: 'More budget actions' }).click();
  await page.getByRole('menuitem', { name: 'Until next payday' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Until next payday' })).toBeVisible();
  await measure('/budget (payday)');
  expect(starts).toEqual(Object.fromEntries([...routes, '/budget (payday)'].map((r) => [r, 16])));
});
