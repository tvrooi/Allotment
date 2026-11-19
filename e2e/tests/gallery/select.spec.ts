import { test, expect, type Locator, type Page } from '@playwright/test';
import { chooseOption } from '../fixtures';
import { openGallery, specimen } from './gallery';

// The shared Select in the controls gallery: the WAI-ARIA listbox keyboard pattern on desktop,
// zero, one and many options, the read-only and disabled states, and the phone's own picker
// under 768 px (D-04) (#267).

/** The text of each visible <label> in `scope` that points at no field (accessibility.spec.ts) */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !(el as HTMLLabelElement).control)
      .map((el) => el.textContent?.trim()),
  );

/** A specimen's desktop trigger: the button that opens its listbox */
const trigger = (page: Page, state: string) => specimen(page, 'Select', state).getByRole('button');

test('the keyboard opens, moves, chooses, closes and jumps by letter', async ({ page }) => {
  await openGallery(page);
  await trigger(page, 'Default').focus();
  await page.keyboard.press('Tab');
  const focus = trigger(page, 'Focus');
  await expect(focus).toBeFocused();
  await expect(focus).toHaveAttribute('aria-haspopup', 'listbox');

  // Enter opens the list with nothing chosen; ArrowDown moves; Enter chooses and closes
  await page.keyboard.press('Enter');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  await expect(list.getByRole('option', { selected: true })).toHaveCount(0);
  await expect(list.getByRole('option', { name: 'Weekly' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const fortnightly = list.getByRole('option', { name: 'Fortnightly' });
  await expect(fortnightly).toBeFocused();
  // The keyboard's option shows a ring, not only the hover fill
  await expect(fortnightly).not.toHaveCSS('box-shadow', 'none');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(focus).toContainText('Fortnightly');
  await expect(focus).toBeFocused();

  // Escape closes without changing the value, and focus returns to the trigger
  await page.keyboard.press('Enter');
  await expect(list).toBeVisible();
  await expect(list.getByRole('option', { name: 'Fortnightly' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(focus).toContainText('Fortnightly');
  await expect(focus).toBeFocused();

  // Typing a letter in the open list jumps to the first option that starts with it
  await page.keyboard.press('ArrowDown');
  await expect(list).toBeVisible();
  await page.keyboard.type('y');
  await expect(list.getByRole('option', { name: 'Yearly' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(focus).toContainText('Yearly');
});

test('options stay in the order given, grouped under their headings', async ({ page }) => {
  await openGallery(page);
  await trigger(page, 'Grouped').click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveText([
    'Everyday',
    'Savings',
    'Credit card',
    'Loan',
    'Buy now, pay later',
  ]);
  await expect(list.getByRole('option', { name: 'Savings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(list.getByRole('group')).toHaveCount(2);
  await expect(list.getByRole('option', { name: 'Buy now, pay later' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.keyboard.press('Escape');
});

test('one option is listed but never chosen; no options says so; many scroll', async ({ page }) => {
  await openGallery(page);
  const one = trigger(page, 'One option');
  await expect(one).toContainText('Choose a household');
  await one.click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(list.getByRole('option', { selected: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(one).toContainText('Choose a household');

  await trigger(page, 'No options').click();
  await expect(list).toContainText('No matching options');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);

  await trigger(page, 'Many options').click();
  await expect(list.getByRole('option')).toHaveCount(30);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  // The list is capped at 288 px (max-h-72) and the popover fits the screen less 16 px
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(288);
  await page.keyboard.press('Escape');
});

test('Tab skips the disabled Select; the read-only one takes focus but never opens', async ({
  page,
}) => {
  await openGallery(page);
  await trigger(page, 'Focus').focus();
  await page.keyboard.press('Tab');
  await expect(trigger(page, 'Invalid')).toBeFocused();
  await expect(trigger(page, 'Disabled')).toBeDisabled();

  await page.keyboard.press('Tab');
  const readOnly = trigger(page, 'Read-only');
  await expect(readOnly).toBeFocused();
  await expect(readOnly).toHaveAttribute('data-readonly', 'true');
  for (const key of ['Enter', ' ', 'ArrowDown', 'y']) {
    await page.keyboard.press(key);
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }
  await readOnly.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(readOnly).toContainText('Fortnightly');
});

test('the required, invalid Select names its subject in the default line', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'Select', 'Required');
  await expect(row.getByText('Select Account type to continue', { exact: true })).toBeVisible();
  await expect(row.getByRole('button')).toHaveAccessibleDescription(
    'Select Account type to continue',
  );
});

test('the trigger looks like an Input in each state', async ({ page }) => {
  await openGallery(page);
  const looks = (field: Locator) =>
    field.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        style.height,
        style.backgroundColor,
        style.borderTopColor,
        style.borderRadius,
        style.color,
      ];
    });
  for (const state of ['Disabled', 'Invalid', 'Read-only'])
    expect(await looks(trigger(page, state)), state).toEqual(
      await looks(specimen(page, 'Input', state).getByRole('textbox')),
    );
  // Unset, the trigger's text is its tertiary placeholder; set, the field's own colour
  const set = await looks(trigger(page, 'Grouped'));
  expect(set).toEqual(await looks(specimen(page, 'Input', 'Default').getByRole('textbox')));
  // A button's cursor, not a text caret; disabled and read-only take the fields' cursors
  await expect(trigger(page, 'Disabled')).toHaveCSS('cursor', 'not-allowed');
  await expect(trigger(page, 'Read-only')).toHaveCSS('cursor', 'default');
  expect((await trigger(page, 'Small').boundingBox())!.height).toBe(32);
});

test('a long chosen label truncates and nothing in the card is a stray label', async ({ page }) => {
  await openGallery(page);
  const card = page.getByRole('region', { name: 'Select', exact: true });
  expect(await strayLabels(card)).toEqual([]);
  const value = trigger(page, 'Long text').locator('.truncate').first();
  expect(await value.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

/** A specimen's control at any width: the native select on phones, the trigger on desktop */
const control = (page: Page, state: string) => {
  const row = specimen(page, 'Select', state);
  return row.getByRole('combobox').or(row.getByRole('button'));
};

test('on a phone the Select is a native select, 44 px tall with 16 px text', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const row = specimen(page, 'Select', 'Default');
  const field = row.getByRole('combobox', { name: 'Frequency' });
  expect(await field.evaluate((el) => el.tagName)).toBe('SELECT');
  await expect(row.getByRole('button')).toHaveCount(0);
  expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(field).toHaveCSS('font-size', '16px');
  // Read-only keeps its value; disabled is disabled
  const readOnly = specimen(page, 'Select', 'Read-only').getByRole('combobox');
  await expect(readOnly).toBeEnabled();
  await expect(readOnly).toHaveAttribute('aria-readonly', 'true');
  await expect(specimen(page, 'Select', 'Disabled').getByRole('combobox')).toBeDisabled();
  const card = page.getByRole('region', { name: 'Select', exact: true });
  expect(await strayLabels(card)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the Select is native at 767 px and the custom trigger at 768 px', async ({ page }) => {
  await openGallery(page);
  await page.setViewportSize({ width: 767, height: 800 });
  const row = specimen(page, 'Select', 'Default');
  await expect(row.locator('select:not([aria-hidden] select)')).toHaveCount(1);
  await expect(row.getByRole('combobox', { name: 'Frequency' })).toBeVisible();
  await expect(row.getByRole('button')).toHaveCount(0);

  await page.setViewportSize({ width: 768, height: 800 });
  await expect(row.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  await expect(row.getByRole('combobox')).toHaveCount(0);
});

for (const width of [1280, 390] as const)
  test(`chooseOption picks Monthly at ${width} px`, async ({ page }) => {
    await openGallery(page, { width });
    const field = control(page, 'Default');
    await chooseOption(field, 'Monthly');
    if (width === 390) await expect(field).toHaveValue('monthly');
    else await expect(field).toContainText('Monthly');
  });
