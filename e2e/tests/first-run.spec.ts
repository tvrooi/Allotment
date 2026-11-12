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
  const dialog = page.getByRole('dialog', { name: 'Add account' });
  await dialog.getByRole('textbox', { name: 'Account name' }).fill('Everyday Checking');
  await dialog.getByRole('button', { name: 'Add account' }).click();

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
  await expect(page.getByRole('button', { name: /^Assigned to Groceries:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Show \d+ inactive/ })).toHaveCount(0);
});

for (const width of [1280, 390])
  test('Wave D: welcome pins only the chosen feature at ' + width, async ({ page, api }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/welcome');
    await expect(
      page.getByRole('heading', { name: 'What else do you share or claim?' }),
    ).toBeVisible();
    const household = page.getByRole('switch', {
      name: 'Sharing costs with a partner or housemates (Household)',
    });
    await household.click();
    await expect(household).toBeChecked();
    await expect
      .poll(async () => (await api.call('GET', '/guides')).navFeatures.household)
      .toBe('shown');
    await page.getByRole('button', { name: 'Skip for now and look around' }).click();
    if (width === 390) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    const nav = page.getByRole('complementary').first();
    await expect(nav.getByRole('link', { name: 'Household', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Tax time, set up', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Files, set up', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('Wave D: switching a welcome feature off restores its default setup row', async ({
  page,
  api,
}) => {
  await open(page, '/welcome');
  const files = page.getByRole('switch', {
    name: 'Keeping receipts, warranties and documents (Files)',
  });
  await files.click();
  await expect(files).toBeChecked();
  await expect.poll(async () => (await api.call('GET', '/guides')).navFeatures.files).toBe('shown');
  await files.click();
  await expect(files).not.toBeChecked();
  await expect
    .poll(async () => (await api.call('GET', '/guides')).navFeatures.files)
    .toBeUndefined();
  await page.getByRole('button', { name: 'Skip for now and look around' }).click();
  await expect(
    page.getByRole('complementary').getByRole('link', { name: 'Files, set up', exact: true }),
  ).toBeVisible();
});

test('Fix round 1: welcome switches have full touch targets', async ({ page }) => {
  await open(page, '/welcome');
  const controls = page.getByRole('switch');
  await expect(controls).toHaveCount(3);
  for (const control of await controls.all()) {
    await expect(control).toBeEnabled();
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('Fix round 1: two welcome choices save while the first request is pending', async ({
  page,
  api,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let held = false;
  await page.route('**/api/guides', async (route) => {
    if (route.request().method() === 'PUT' && !held) {
      held = true;
      started();
      await gate;
    }
    await route.continue();
  });
  try {
    await open(page, '/welcome');
    const household = page.getByRole('switch', {
      name: 'Sharing costs with a partner or housemates (Household)',
    });
    const files = page.getByRole('switch', {
      name: 'Keeping receipts, warranties and documents (Files)',
    });
    await household.click();
    await firstStarted;
    await expect(files).toBeEnabled();
    await files.click();
    await expect(files).toBeChecked();
    release();
    await expect
      .poll(async () => (await api.call('GET', '/guides')).navFeatures)
      .toMatchObject({ household: 'shown', files: 'shown' });
    await expect(household).toBeChecked();
    await expect(files).toBeChecked();
  } finally {
    release();
  }
});
