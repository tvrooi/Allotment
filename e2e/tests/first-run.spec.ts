import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

/** Guide progress isn't reset between tests: a new budget's tour offer may still be there */
async function skipTourIfOffered(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip the tour' });
  await expect(
    skip.or(page.getByRole('progressbar', { name: 'Getting started progress' })),
  ).toBeVisible();
  if (await skip.isVisible()) await skip.click();
}

// What a new user sees: a getting started checklist on the dashboard, and empty cards
// and pages that say what goes there with a button to add the first one.

test('the getting started checklist tracks progress and can be hidden', async ({ page, api }) => {
  await open(page, '/welcome');
  await page.getByRole('button', { name: 'Skip for now and look around' }).click();

  const checklist = page.getByRole('heading', { name: 'Get started with Allotment' });
  await expect(checklist).toBeVisible();
  // A new budget is offered the tour first (I-7); skipping it brings the steps
  await skipTourIfOffered(page);
  await expect(page.getByText('0 of 5 done')).toBeVisible();

  await page.getByRole('main').getByRole('button', { name: 'Add account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Account' });
  await dialog.getByRole('textbox', { name: 'Account name' }).fill('Everyday Checking');
  await dialog.getByRole('button', { name: 'Add Account' }).click();

  await expect(page.getByText('1 of 5 done')).toBeVisible();
  expect((await api.accounts()).map((a) => a.name)).toEqual(['Everyday Checking']);

  await page.getByRole('button', { name: 'Hide getting started' }).click();
  await expect(checklist).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Budget', exact: true })).toBeVisible();
  await expect(checklist).toBeHidden();
});

test('empty dashboard cards link to where their data comes from', async ({ page, api }) => {
  await api.createAccount('Everyday Checking', 100_000);
  await open(page, '/dashboard');

  await expect(page.getByText('No transactions yet')).toBeVisible();
  await skipTourIfOffered(page);
  await expect(page.getByText('Track your bills and pay')).toBeVisible();
  // While the Get started checklist shows, it holds the next steps: the cards don't repeat them
  await expect(page.getByRole('link', { name: 'Add a transaction' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide getting started' }).click();

  // "Add a transaction" in Recent Transactions opens the add dialog on the register
  await page.getByRole('link', { name: 'Add a transaction' }).last().click();
  await expect(page).toHaveURL(/#\/transactions$/);
  await expect(page.getByRole('dialog', { name: 'Add transaction' })).toBeVisible();
});

test('empty pages explain themselves and offer the first step', async ({ page, api }) => {
  const account = await api.createAccount('Everyday Checking', 100_000);

  await open(page, `/accounts/${account.id}`);
  await expect(page.getByText('No transactions yet')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Import a CSV file' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, '/rules');
  await expect(page.getByText('Let rules do the sorting')).toBeVisible();

  await open(page, '/goals');
  await expect(page.getByText('Save for what matters')).toBeVisible();

  await open(page, '/budget');
  await expect(page.getByText(/No money assigned for/)).toBeVisible();
  // Every category is listed (none tucked away), so there's something to plan straight away
  await expect(page.getByRole('button', { name: /^Planned for Groceries:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Show \d+ inactive/ })).toHaveCount(0);
});
