import { test, expect, open, isoDay } from './fixtures';

// Accessibility fixes from the audit (F-15): every page has a heading, icon-only controls have
// names, and unlabelled fields are labelled. The lint rule allotment/icon-only-control and the
// colour-contrast test in lint/tokens keep the static cases from coming back; these check the
// rendered pages.

test('Budget and Category detail each have one page heading', async ({ page, api }) => {
  const acct = await api.createAccount('Checking', 100_000);
  const groups = await api.categoryGroups();
  const groceries = groups.flatMap((g) => g.categories).find((c) => c.name === 'Groceries')!;
  await api.createTransaction({
    accountId: acct.id,
    date: isoDay(0),
    amount: -4_000,
    payeeName: 'Corner Grocery',
    categoryId: groceries.id,
  });

  await open(page, '/budget');
  const budget = page.getByRole('heading', { level: 1 });
  await expect(budget).toHaveCount(1);
  // The month is what people see; "Budget" is for a screen reader
  await expect(budget).toContainText('Budget,');
  await expect(budget).toContainText(String(new Date().getFullYear()));

  await open(page, `/budget/category/${groceries.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Groceries');
});

test('the dashboard names its selects and orders its headings', async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/dashboard');
  await expect(page.getByRole('combobox', { name: 'Compare spending' })).toBeVisible();
  // h1, then h2 widget titles: no heading skips a level
  const levels = await page
    .locator('h1, h2, h3, h4')
    .evaluateAll((els) => els.map((el) => Number(el.tagName.slice(1))));
  for (let i = 1; i < levels.length; i++) {
    expect(
      levels[i] - levels[i - 1],
      `heading ${i + 1} follows a level ${levels[i - 1]}`,
    ).toBeLessThanOrEqual(1);
  }
});

test('the custom report builder names its icon-only controls', async ({ page, api }) => {
  await api.createAccount('Checking', 0);
  await open(page, '/reports/custom');
  await expect(page.getByRole('link', { name: 'Back to reports' })).toBeVisible();

  // Every group's expand button says which group, and whether it is open
  const first = page.getByRole('button', { name: /categories$/ }).first();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
});

test('no button, link or select on the main pages is nameless', async ({ page, api }) => {
  const acct = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: acct.id,
    date: isoDay(0),
    amount: -2_500,
    payeeName: 'Corner Grocery',
  });
  for (const route of [
    '/dashboard',
    '/budget',
    '/transactions',
    '/accounts',
    '/payees',
    '/rules',
    '/reports',
    '/settings',
    '/reports/custom',
  ]) {
    await open(page, route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    const nameless = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], select, [role=button], [role=switch]')]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          const label =
            el.getAttribute('aria-label') ??
            el.getAttribute('title') ??
            el.getAttribute('aria-labelledby') ??
            el.textContent ??
            '';
          const labelled = (el as HTMLElement).labels?.length;
          return !label.trim() && !labelled;
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(nameless, route).toEqual([]);
  }
});

test('a disabled rule says so in words, and is not faded', async ({ page, api }) => {
  await api.createAccount('Checking');
  await api.call('POST', '/rules', {
    actions: [{ type: 'set_notes', value: 'x' }],
    conditions: [{ field: 'payee_name', op: 'contains', value: 'first' }],
  });
  await open(page, '/rules');
  await page.getByRole('switch', { name: 'Disable rule' }).click();
  const off = page.getByText('Off: turn it on to use it.');
  await expect(off).toBeVisible();
  // Faded text fails colour contrast, so the state is said, not dimmed
  expect(await off.evaluate((el) => getComputedStyle(el.closest('button')!).opacity)).toBe('1');
});
