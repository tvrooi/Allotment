import type { Locator } from '@playwright/test';
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

test('the dashboard names its range controls and orders its headings', async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/dashboard');
  await expect(page.getByRole('group', { name: 'Compare spending with' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Net worth period' })).toBeVisible();
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
          const labelled = (el as HTMLSelectElement).labels?.length;
          return !label.trim() && !labelled;
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );
    expect(nameless, route).toEqual([]);
  }
});

/** The text of each visible <label> in `scope` that points at no field */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !el.control)
      .map((el) => el.textContent?.trim()),
  );

test('every label in the transaction forms points at its field', async ({ page, api }) => {
  const acct = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: acct.id,
    date: isoDay(0),
    amount: -2_500,
    payeeName: 'Corner Grocery',
  });

  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await expect(dialog.getByText('Payee *')).toBeVisible();
  expect(await strayLabels(dialog)).toEqual([]);
  // Clicking a label's text goes to its field
  await dialog.getByText('Notes', { exact: true }).click();
  await expect(dialog.getByPlaceholder('Add a note...')).toBeFocused();
  await page.keyboard.press('Escape');

  await open(page, `/accounts/${acct.id}`);
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  const form = page.getByRole('form', { name: 'New transaction' });
  expect(await strayLabels(form)).toEqual([]);
  await form.getByText('Outflow', { exact: true }).click();
  await expect(form.getByRole('textbox', { name: 'Outflow' })).toBeFocused();
  await form.getByRole('button', { name: 'Cancel' }).click();

  await page.getByTestId('transaction-row').filter({ hasText: 'Corner Grocery' }).click();
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await expect(panel.getByText('Notes', { exact: true })).toBeVisible();
  expect(await strayLabels(panel)).toEqual([]);

  await open(page, `/accounts/${acct.id}/reconcile`);
  await page.getByText('Statement balance', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Statement balance' })).toBeFocused();
});

test('every label in the account, goal, recurring and category forms points at its field', async ({
  page,
  api,
}) => {
  const acct = await api.createAccount('Checking', 100_000);

  await open(page, '/accounts');
  await page.getByRole('main').getByRole('button', { name: 'Add account' }).click();
  const add = page.getByRole('dialog', { name: 'Add account' });
  expect(await strayLabels(add)).toEqual([]);
  await add.getByText('Account type', { exact: true }).click();
  await expect(add.getByRole('combobox', { name: 'Account type' })).toBeFocused();
  await page.keyboard.press('Escape');

  await open(page, `/accounts/${acct.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit account' });
  expect(await strayLabels(edit)).toEqual([]);
  // A caption over buttons names their group instead
  await expect(edit.getByRole('group', { name: 'Logo' })).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, '/goals');
  await page.getByRole('button', { name: 'Add goal' }).first().click();
  const goal = page.getByRole('dialog', { name: 'Add goal' });
  expect(await strayLabels(goal)).toEqual([]);
  await expect(goal.getByRole('group', { name: 'Colour' })).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, '/recurring');
  await page.getByRole('main').getByRole('button', { name: 'Add recurring' }).first().click();
  const recurring = page.getByRole('dialog', { name: 'Add recurring' });
  expect(await strayLabels(recurring)).toEqual([]);
  await recurring.getByText('Start date', { exact: true }).click();
  await expect(recurring.getByLabel('Start date')).toBeFocused();
  await expect(recurring.getByRole('group', { name: 'Type' })).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, '/settings');
  await page.getByRole('button', { name: 'Edit Parking' }).click();
  const category = page.getByRole('dialog', { name: 'Edit category' });
  expect(await strayLabels(category)).toEqual([]);
  await expect(category.getByRole('group', { name: 'Budget type' })).toBeVisible();
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

// UX audit AU-003: charts used to hide every focus outline, so the keyboard vanished into them
test('a chart shows the keyboard focus ring, but not after a click', async ({ page, api }) => {
  const acct = await api.createAccount('Checking', 100_000);
  for (const [days, amount] of [
    [-40, -12_000],
    [-10, -8_000],
    [-2, -3_000],
  ] as const) {
    await api.createTransaction({
      accountId: acct.id,
      date: isoDay(days),
      amount,
      payeeName: 'Corner Grocery',
    });
  }
  await open(page, '/dashboard');
  const chart = page.locator('svg.ts-chart[tabindex="0"]').first();
  await expect(chart).toBeVisible();
  const outline = () => chart.evaluate((el) => getComputedStyle(el).outlineStyle);

  await chart.click({ position: { x: 5, y: 5 } });
  expect(await outline()).toBe('none');

  // Keyboard: move on and come back with Shift+Tab, so focus arrives the keyboard's way
  await chart.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(chart).toBeFocused();
  expect(await outline()).not.toBe('none');
});

test('the row-end arrow and the hide-balances button have names and room to press', async ({
  page,
  api,
}) => {
  const acct = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: acct.id,
    date: isoDay(0),
    amount: -4_000,
    payeeName: 'Corner Grocery',
  });
  await open(page, '/transactions');
  const arrow = page.getByRole('button', { name: 'Edit details for Corner Grocery' });
  const box = (await arrow.boundingBox())!;
  // WCAG 2.5.8: at least 24 px; the row itself is the keyboard's way in
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
  await expect(arrow).toHaveAttribute('tabindex', '-1');
  await arrow.click();
  await expect(page.getByRole('complementary', { name: 'Transaction details' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The name says what the eye does, as its tooltip does
  const hide = page.getByRole('complementary').getByRole('button', { name: /Hide balances/ });
  await expect(hide).toHaveAttribute('aria-pressed', 'false');
  const eye = (await hide.boundingBox())!;
  expect(Math.min(eye.width, eye.height)).toBeGreaterThanOrEqual(24);
});

test('the search palette is a named combobox over a grouped listbox', async ({ page, api }) => {
  await api.createAccount('Checking', 100_000);
  await open(page, '/dashboard');
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const box = dialog.getByRole('combobox', { name: /^Search pages/ });
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  const list = dialog.getByRole('listbox', { name: 'Results' });
  await expect(box).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!);
  // The highlighted option exists, and every option sits in a named group
  const active = await box.getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('role', 'option');
  const problems = await list.evaluate((el) =>
    [...el.querySelectorAll('[role=option]')]
      .filter((o) => {
        const group = o.closest('[role=group]');
        const heading = group && document.getElementById(group.getAttribute('aria-labelledby')!);
        return !heading?.textContent?.trim() || !o.textContent?.trim();
      })
      .map((o) => o.outerHTML.slice(0, 120)),
  );
  expect(problems).toEqual([]);
  // Nothing nameless in the dialog either
  const nameless = await dialog.evaluate((el) =>
    [...el.querySelectorAll('button, a[href], input')]
      .filter((c) => !(c.getAttribute('aria-label') ?? c.textContent ?? '').trim())
      .map((c) => c.outerHTML.slice(0, 120)),
  );
  expect(nameless).toEqual([]);
});
