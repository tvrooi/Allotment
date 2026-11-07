import { test, expect, open } from './fixtures';

// UX audit AU-007: one Escape threw away a half-written goal, and Back threw away a report's
// unsaved settings. Now leaving with changes asks "Keep editing / Discard"; leaving without
// changes is still a single step.

for (const phone of [false, true]) {
  const where = phone ? ' on a phone' : '';

  test(`a goal with changes asks before Escape throws them away${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await open(page, '/goals');
    const add = page.getByRole('button', { name: 'Add goal' }).first();

    // Untouched: one Escape closes it
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Add goal' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await add.click();
    const name = dialog.getByLabel('Name', { exact: true });
    await name.fill('Unsaved trip');
    await page.keyboard.press('Escape');
    const prompt = dialog.getByRole('alert').filter({ hasText: 'Discard your changes?' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Keep editing' })).toBeFocused();

    await prompt.getByRole('button', { name: 'Keep editing' }).click();
    await expect(prompt).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(name).toHaveValue('Unsaved trip');

    // Clicking outside asks too; Escape on the question keeps editing
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(prompt).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0);
    await expect(name).toHaveValue('Unsaved trip');

    await page.keyboard.press('Escape');
    await prompt.getByRole('button', { name: 'Discard' }).click();
    await expect(dialog).toBeHidden();
    await add.click();
    await expect(name).toHaveValue('');
    expect(await api.call('GET', '/goals')).toEqual([]);
  });

  test(`a report with unsaved settings asks before Back leaves it${where}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Checking', 100_000);

    // Untouched: Back leaves straight away
    await open(page, '/reports/custom');
    const back = page.getByRole('link', { name: 'Back to reports' });
    await back.click();
    await expect(page).toHaveURL(/#\/reports$|\/reports$/);

    await open(page, '/reports/custom');
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('payee');
    await back.click();
    const prompt = page.getByRole('alert').filter({ hasText: 'Leave without saving this report?' });
    await expect(prompt).toBeVisible();
    await expect(page).toHaveURL(/reports\/custom/);

    await prompt.getByRole('button', { name: 'Keep editing' }).click();
    await expect(prompt).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveValue('payee');

    await back.click();
    await prompt.getByRole('button', { name: 'Discard' }).click();
    await expect(page).toHaveURL(/#\/reports$|\/reports$/);

    // Saved, or reopened as saved: nothing unsaved, so Back leaves straight away
    await open(page, '/reports/custom');
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('payee');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const save = page.getByRole('dialog', { name: 'Save report' });
    await save.getByRole('textbox', { name: 'Report name' }).fill('By payee');
    await save.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'By payee' })).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/#\/reports$|\/reports$/);
    const [saved] = await api.call<{ id: string }[]>('GET', '/custom-reports');
    await open(page, `/reports/custom/${saved.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'By payee' })).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/#\/reports$|\/reports$/);
  });
}
