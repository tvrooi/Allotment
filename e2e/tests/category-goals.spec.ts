import type { Page } from '@playwright/test';
import { typeAmount, type Api } from './fixtures';
import { test, expect, open, thisMonth } from './fixtures';
for (const phone of [false, true]) {
  test(`category goal progress and manual compatibility${phone ? ' on phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Opening cash', 100000);
    const category = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${category.id}`, { budgeted: 20000 });
    await open(page, '/goals');
    await page.getByRole('button', { name: 'Add goal' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Trip');
    await dialog.getByLabel('Target', { exact: true }).fill('500');
    await dialog.getByLabel('Target', { exact: true }).press('Tab');
    await dialog.getByLabel('Progress source').selectOption(category.id);
    await expect(dialog.getByLabel('Saved so far')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Add goal' }).click();
    await expect(dialog).toBeHidden();
    // The tag, then the category name as bare text beside it in the same line (b47ddd5)
    const funded = page.getByText('Category funded', { exact: true });
    await expect(funded).toBeVisible();
    await expect(funded.locator('..')).toHaveText(/^Category funded\s*Groceries$/);
    await expect(
      page.getByText('Assigned this month $200 · Activity $0 · Available $200', { exact: true }),
    ).toBeVisible();
    await api.call('PUT', `/budget/${thisMonth()}/${category.id}`, { budgeted: 15000 });
    await page.reload();
    await expect(
      page.getByText('Assigned this month $150 · Activity $0 · Available $150', { exact: true }),
    ).toBeVisible();
    // It shows and says where it leads: a chevron, and a link named for its category
    const tripRow = page.getByTestId('goal-row').filter({ hasText: 'Trip' });
    await expect(tripRow.getByTestId('goal-opens-category')).toBeVisible();
    await expect(
      tripRow.getByRole('link', { name: 'Trip: open Groceries in Budget' }),
    ).toBeVisible();
    // One tab stop per destination: the row itself is not focusable, its link is
    await expect(tripRow).not.toHaveAttribute('tabindex');
    // A category-funded row opens its category (#235): a click anywhere on it, the chevron
    // included, and Enter on its link
    await tripRow.getByText('Category funded').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    await tripRow.getByTestId('goal-opens-category').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    await tripRow.getByRole('link', { name: 'Trip: open Groceries in Budget' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${category.id}$`));
    await page.goBack();
    // Every row has a visible Edit, which does not open the category
    await page.getByRole('button', { name: 'Edit Trip' }).click();
    await expect(page).toHaveURL(/#\/goals$/);
    await dialog.getByLabel('Progress source').selectOption('');
    await expect(dialog.getByLabel('Saved so far')).toHaveValue('');
    await dialog.getByLabel('Saved so far').fill('75');
    await dialog.getByLabel('Saved so far').press('Tab');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    const rows = await api.call('GET', '/goals');
    expect(rows[0]).toMatchObject({ categoryId: null, currentAmount: 7500 });
    await expect(page.getByText('Tracked by hand', { exact: true })).toBeVisible();
    // A row tracked by hand has neither, and keeps opening the edit dialog
    await expect(tripRow.getByTestId('goal-opens-category')).toHaveCount(0);
    await expect(tripRow.getByRole('link', { name: /open .* in Budget/ })).toHaveCount(0);

    await page.getByText('Trip', { exact: true }).click();
    await expect(dialog.getByLabel('Saved so far')).toBeVisible();
    await expect(page).toHaveURL(/#\/goals$/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    // Its Edit opens the dialog from the keyboard, Space as well as Enter
    await page.getByRole('button', { name: 'Edit Trip' }).focus();
    await page.keyboard.press('Space');
    await expect(dialog.getByLabel('Saved so far')).toBeVisible();
  });
}

// UX audit AU-009: the confirmation used to say "This cannot be undone" although Undo works
test('deleting a goal says it can be undone, and Undo brings it back', async ({ page, api }) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  await open(page, '/goals');
  await page.getByRole('button', { name: 'Actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Delete goal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete goal' });
  await expect(dialog).toContainText('You can undo this');
  await expect(dialog).not.toContainText('cannot be undone');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Holiday', { exact: true })).toHaveCount(0);

  const toast = page.getByTestId('undo-toast');
  await expect(toast).toContainText('Deleted goal "Holiday".');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Holiday', { exact: true })).toBeVisible();
  expect((await api.call('GET', '/goals')).map((g: { name: string }) => g.name)).toEqual([
    'Holiday',
  ]);
});

test('a long goal name wraps on a phone instead of being cut off (#235)', async ({ page, api }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const category = await api.category('Groceries');
  await api.call('POST', '/goals', {
    name: 'Anniversary trip to Tasmania with the family',
    targetAmount: 450_000,
    categoryId: category.id,
  });
  await open(page, '/goals');
  const name = page.getByRole('link', { name: /^Anniversary trip to Tasmania with the family:/ });
  await expect(name).toBeVisible();
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await name.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(24);
});

test("a goal's plant grows from a seed to a flower as it fills (#241)", async ({ page, api }) => {
  await api.createAccount('Opening cash', 100000);
  for (const [name, current] of [
    ['Bike', 2_000],
    ['Camera', 4_000],
    ['Holiday', 7_500],
    ['Laptop', 10_000],
  ] as const)
    await api.call('POST', '/goals', { name, targetAmount: 10_000, currentAmount: current });
  await open(page, '/goals');
  const row = (name: string) => page.getByTestId('goal-row').filter({ hasText: name });
  for (const [name, stage] of [
    ['Bike', 'seed'],
    ['Camera', 'seedling'],
    ['Holiday', 'bud'],
    ['Laptop', 'flower'],
  ] as const)
    await expect(row(name).getByTestId('goal-plant')).toHaveAttribute('data-stage', stage);
  // The status is in words, never only in the picture
  await expect(row('Laptop')).toContainText('Goal reached');
  await expect(row('Holiday')).not.toContainText('Goal reached');
});

test('a reached goal blooms once on this device (#241)', async ({ page, api }) => {
  await api.call('POST', '/goals', { name: 'Laptop', targetAmount: 10_000, currentAmount: 10_000 });
  await open(page, '/goals');
  const plant = page
    .getByTestId('goal-row')
    .filter({ hasText: 'Laptop' })
    .getByTestId('goal-plant');
  await expect(plant).toHaveAttribute('data-bloom', 'true');
  // Seen once, it stays a still flower
  await page.reload();
  await expect(plant).toHaveAttribute('data-bloom', 'false');
  await expect(plant).toHaveAttribute('data-stage', 'flower');
});

// A paused goal stays in the Paused group whatever its amount, so its row stays on the page
// while the goal changes: the path where the bloom must follow the goal without a reload
async function pausedGoal(api: Api, name: string, currentAmount: number) {
  const goal = await api.call('POST', '/goals', { name, targetAmount: 10_000, currentAmount });
  await api.call('POST', `/goals/${goal.id}/status`, {
    status: 'paused',
    expectedUpdatedAt: goal.updatedAt,
  });
  const rows = await api.call<{ name: string; status: string }[]>('GET', '/goals');
  expect(rows.find((g) => g.name === name)?.status).toBe('paused');
}

async function saveSaved(page: Page, name: string, from: string, to: string) {
  await page.getByRole('button', { name: `Edit ${name}` }).click();
  const dialog = page.getByRole('dialog');
  const saved = dialog.getByLabel('Saved so far');
  // The dialog fills in the goal after it opens: typing before that would be overwritten
  await expect(saved).toHaveValue(`$${from}`);
  await typeAmount(saved, to);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('a goal reached while the page is open grows and blooms in place (#241)', async ({
  page,
  api,
}) => {
  await pausedGoal(api, 'Tent', 2_000);
  await open(page, '/goals');
  const row = page.getByTestId('goal-row').filter({ hasText: 'Tent' });
  const plant = row.getByTestId('goal-plant');
  await expect(plant).toHaveAttribute('data-stage', 'seed');
  await expect(plant).toHaveAttribute('data-bloom', 'false');
  await expect(plant).not.toHaveAttribute('data-motion');
  await saveSaved(page, 'Tent', '20', '40');
  await expect(plant).toHaveAttribute('data-stage', 'seedling');
  await expect(plant).toHaveAttribute('data-motion', 'true');
  await saveSaved(page, 'Tent', '40', '100');
  await expect(plant).toHaveAttribute('data-stage', 'flower');
  await expect(plant).toHaveAttribute('data-bloom', 'true');
  await expect(row).toContainText('Goal reached');
  await page.reload();
  await expect(plant).toHaveAttribute('data-stage', 'flower');
  await expect(plant).toHaveAttribute('data-bloom', 'false');
});

test('a reached goal that dips and returns does not bloom again (#241)', async ({ page, api }) => {
  await pausedGoal(api, 'Kayak', 10_000);
  await open(page, '/goals');
  const plant = page.getByTestId('goal-row').filter({ hasText: 'Kayak' }).getByTestId('goal-plant');
  await expect(plant).toHaveAttribute('data-stage', 'flower');
  await expect(plant).toHaveAttribute('data-bloom', 'true');
  await saveSaved(page, 'Kayak', '100', '75');
  await expect(plant).toHaveAttribute('data-stage', 'bud');
  await expect(plant).toHaveAttribute('data-bloom', 'false');
  await saveSaved(page, 'Kayak', '75', '100');
  await expect(plant).toHaveAttribute('data-stage', 'flower');
  await expect(plant).toHaveAttribute('data-bloom', 'false');
});

test("with reduced motion a goal's plant is shown still (#241)", async ({ page, api }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await api.call('POST', '/goals', { name: 'Laptop', targetAmount: 10_000, currentAmount: 10_000 });
  await open(page, '/goals');
  const plant = page
    .getByTestId('goal-row')
    .filter({ hasText: 'Laptop' })
    .getByTestId('goal-plant');
  await expect(plant).toBeVisible();
  await expect(plant).toHaveAttribute('data-stage', 'flower');
  // Its first sight would bloom: five petals and a ring, none of them moving
  await expect(plant).toHaveAttribute('data-bloom', 'true');
  const parts = plant.locator('[data-motion]');
  await expect(parts).toHaveCount(6);
  for (const part of await parts.all()) await expect(part).toHaveCSS('animation-name', 'none');
});

test('on a phone the plant sits at the end of the bar and keeps its size (#241)', async ({
  page,
  api,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await api.call('POST', '/goals', { name: 'Bike', targetAmount: 10_000, currentAmount: 4_000 });
  await open(page, '/goals');
  const plant = page.getByTestId('goal-row').filter({ hasText: 'Bike' }).getByTestId('goal-plant');
  await expect(plant).toHaveAttribute('data-stage', 'seedling');
  const bar = plant.locator('xpath=preceding-sibling::div[1]');
  const plantBox = (await plant.boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(plantBox.width).toBe(20);
  expect(plantBox.height).toBe(20);
  expect(plantBox.x).toBeGreaterThanOrEqual(barBox.x + barBox.width);
  expect(barBox.width).toBeGreaterThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
