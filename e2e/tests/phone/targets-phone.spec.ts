import type { Locator } from '@playwright/test';
import { test, expect, open, isoDay } from '../fixtures';

// Touch targets on a phone (audit F-15): the buttons and links in rows are at least 44 px tall
// and wide, as the register's and the menus' already are.

const MIN = 44;

async function undersized(locators: Locator[]) {
  const small: string[] = [];
  for (const locator of locators) {
    const count = await locator.count();
    expect(count, `${locator} matches nothing`).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await locator.nth(i).boundingBox();
      if (box && (box.width < MIN - 0.5 || box.height < MIN - 0.5))
        small.push(`${locator} #${i}: ${Math.round(box.width)}×${Math.round(box.height)}`);
    }
  }
  return small;
}

test('the category list in Settings has full-size buttons', async ({ page, api }) => {
  await api.createAccount('Checking', 0);
  await open(page, '/settings');
  await expect(page.getByRole('button', { name: 'Create category' }).first()).toBeVisible();
  expect(
    await undersized([
      page.getByRole('button', { name: 'Create category' }),
      page.getByRole('button', { name: /^Delete group / }),
      page.getByRole('button', { name: 'Edit', exact: true }),
      page.getByRole('button', { name: 'Drag to reorder group' }),
      page.getByRole('button', { name: /^Drag to reorder (?!group)/ }),
      page.getByRole('button', { name: 'Edit Groceries' }),
    ]),
  ).toEqual([]);
});

test('the dashboard lists recent transactions as cards, with full-size links', async ({
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
  await open(page, '/dashboard');
  const recent = page
    .getByRole('heading', { name: 'Recent transactions' })
    .locator('..')
    .locator('..');
  await expect(recent.getByText('Corner Grocery')).toBeVisible();
  expect(
    await undersized([
      recent.getByRole('link', { name: 'View all transactions' }),
      recent.getByRole('button', { name: /Corner Grocery/ }),
    ]),
  ).toEqual([]);
  expect(
    await undersized([
      page.getByRole('group', { name: 'Compare spending with' }).getByRole('button'),
    ]),
  ).toEqual([]);
});

test('the Payees list and the cash flow presets have full-size controls', async ({ page, api }) => {
  const acct = await api.createAccount('Checking', 100_000);
  await api.createTransaction({
    accountId: acct.id,
    date: isoDay(0),
    amount: -4_000,
    payeeName: 'Corner Grocery',
  });
  await open(page, '/payees');
  await expect(page.getByTestId('payee-card').first()).toBeVisible();
  expect(
    await undersized([
      page.getByRole('button', { name: /^(Change|Upload an) image for / }),
      page.getByRole('button', { name: /^Actions for / }),
    ]),
  ).toEqual([]);

  await open(page, '/cash-flow');
  await expect(page.getByRole('heading', { level: 1, name: 'Cash flow' })).toBeVisible();
  expect(
    await undersized([
      page.getByRole('button', { name: '1M' }),
      page.getByRole('button', { name: 'This year' }),
    ]),
  ).toEqual([]);
});
