import { test, expect, type Locator, type Page } from '@playwright/test';
import { openGallery, specimen } from './gallery';

// The shared Combobox in the controls gallery: the WAI-ARIA combobox keyboard pattern (type to
// filter, arrows, Enter, Escape, focus kept in the field), the field's looks, and the disabled
// and read-only states (#267).

/** A specimen's text field: the input with the combobox role */
const field = (page: Page, state: string) =>
  specimen(page, 'Combobox', state).getByRole('combobox');

/**
 * Brings a specimen on screen and lets that scroll's event fire before the test opens a list.
 * React Aria closes an open Combobox list on any page scroll, and the scroll a focus() or a
 * click causes reaches the page a frame later, after the list has opened.
 */
async function onScreen(page: Page, state: string) {
  const row = specimen(page, 'Combobox', state);
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  return row;
}

test('typing filters, ArrowDown and Enter choose, and focus stays in the field', async ({
  page,
}) => {
  await openGallery(page);
  await onScreen(page, 'Focus');
  await field(page, 'Default').focus();
  await page.keyboard.press('Tab');
  const focus = field(page, 'Focus');
  await expect(focus).toBeFocused();

  // Mixed case still matches: the filter ignores letter case
  await page.keyboard.type('sAV');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  await expect(list.getByRole('option')).toHaveText(['Savings', 'Holiday savings']);
  await expect(focus).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(list.getByRole('option', { name: 'Savings', exact: true })).toHaveAttribute(
    'data-focused',
    'true',
  );
  await expect(focus).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(list).toHaveCount(0);
  await expect(focus).toHaveValue('Savings');
  await expect(focus).toBeFocused();

  // Escape with the list open closes it and keeps focus in the field
  await page.keyboard.press('ArrowDown');
  await expect(list).toBeVisible();
  await expect(list.getByRole('option', { name: 'Savings', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(focus).toBeFocused();
  await expect(focus).toHaveValue('Savings');
});

test('Tab skips the disabled Combobox; the read-only one takes focus but never changes', async ({
  page,
}) => {
  await openGallery(page);
  await field(page, 'Focus').focus();
  await page.keyboard.press('Tab');
  await expect(field(page, 'Invalid')).toBeFocused();
  await expect(field(page, 'Disabled')).toBeDisabled();

  await page.keyboard.press('Tab');
  const readOnly = field(page, 'Read-only');
  await expect(readOnly).toBeFocused();
  await expect(readOnly).toHaveAttribute('readonly', '');
  for (const key of ['ArrowDown', 'Enter', 'x']) {
    await page.keyboard.press(key);
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }
  await expect(readOnly).toHaveValue('Joint bills');
  await specimen(page, 'Combobox', 'Read-only').getByRole('button').click({ force: true });
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('the Combobox looks like an Input in each state', async ({ page }) => {
  await openGallery(page);
  const looks = (box: Locator) =>
    box.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        style.height,
        style.backgroundColor,
        style.borderTopWidth,
        style.borderTopColor,
        style.borderRadius,
      ];
    });
  /** The visible box: the group around the text field and its buttons */
  const box = (state: string) => specimen(page, 'Combobox', state).getByRole('group').last();
  for (const state of ['Default', 'Disabled', 'Invalid', 'Read-only'])
    expect(await looks(box(state)), state).toEqual(
      await looks(specimen(page, 'Input', state).getByRole('textbox')),
    );
  // The text keeps the field's colour, and disabled text the disabled one
  await expect(field(page, 'Disabled')).toHaveCSS(
    'color',
    await specimen(page, 'Input', 'Disabled')
      .getByRole('textbox')
      .evaluate((el) => getComputedStyle(el).color),
  );
  await expect(field(page, 'Disabled')).toHaveCSS('cursor', 'not-allowed');
  await expect(field(page, 'Read-only')).toHaveCSS('cursor', 'default');

  // Focused, the group draws the brand ring as an Input does
  await field(page, 'Default').focus();
  const ring = await specimen(page, 'Input', 'Default')
    .getByRole('textbox')
    .evaluate((el) => {
      (el as HTMLElement).focus();
      return getComputedStyle(el).boxShadow;
    });
  await field(page, 'Default').focus();
  await expect(box('Default')).toHaveCSS('box-shadow', ring);
});

/** A specimen's readout line, which shows what the Combobox reported to its caller */
const readout = (page: Page, state: string) =>
  specimen(page, 'Combobox', state).getByTestId('combobox-readout');

test('without custom values the field returns to the chosen label; with them it keeps the text', async ({
  page,
}) => {
  await openGallery(page);
  await onScreen(page, 'Default');
  const def = field(page, 'Default');
  await def.fill('sav');
  await page.getByRole('listbox').getByRole('option', { name: 'Savings', exact: true }).click();
  await expect(def).toHaveValue('Savings');
  await def.fill('Something else');
  await page.keyboard.press('Tab');
  await expect(def).toHaveValue('Savings');

  await onScreen(page, 'Custom value');
  const custom = field(page, 'Custom value');
  await custom.fill('Cash jar');
  // Tab lands on the next specimen, which opens on focus: close its list, which hides the rest
  // of the page from assistive technology (and so from getByRole) while it is open
  await page.keyboard.press('Tab');
  await expect(field(page, 'Opens on focus')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(custom).toHaveValue('Cash jar');
  await expect(readout(page, 'Custom value')).toHaveText('Text: Cash jar; value: none');
});

test('menuTrigger focus opens the list when the field takes focus', async ({ page }) => {
  await openGallery(page);
  await onScreen(page, 'Opens on focus');
  await field(page, 'Opens on focus').focus();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(6);
  await page.keyboard.press('Escape');
});

test('filter false shows exactly the caller’s items', async ({ page }) => {
  await openGallery(page);
  await onScreen(page, 'Caller filters');
  await field(page, 'Caller filters').fill('zz');
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveText(['Everyday', 'Savings', 'Joint bills']);
  await page.keyboard.press('Escape');
});

test('no match shows the empty line and its help; a custom empty state replaces it', async ({
  page,
}) => {
  await openGallery(page);
  await onScreen(page, 'Default');
  await field(page, 'Default').fill('qqq');
  const list = page.getByRole('listbox');
  await expect(list).toContainText('No matching options');
  await expect(list).toContainText(
    'Type a different search term or clear the filter to see all choices.',
  );
  await page.keyboard.press('Escape');

  await onScreen(page, 'Custom empty state');
  await field(page, 'Custom empty state').fill('qqq');
  await expect(page.getByText('No account has that name yet', { exact: true })).toBeVisible();
  await expect(page.getByText('No matching options')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('a footer shows below the list, even when the list is empty', async ({ page }) => {
  await openGallery(page);
  const footer = page.getByText('Add accounts in Settings', { exact: true });
  await (await onScreen(page, 'Footer')).getByRole('button').click();
  await expect(page.getByRole('listbox')).toContainText('No matching options');
  await expect(footer).toBeVisible();
  const listBox = (await page.getByRole('listbox').boundingBox())!;
  expect((await footer.boundingBox())!.y).toBeGreaterThanOrEqual(listBox.y + listBox.height - 1);
  await page.keyboard.press('Escape');
});

test('zero options say so; one is never chosen for you; forty scroll inside', async ({ page }) => {
  await openGallery(page);
  const list = page.getByRole('listbox');
  await (await onScreen(page, 'No options')).getByRole('button').click();
  await expect(list).toContainText('No matching options');
  // React Aria wraps the empty lines in a placeholder row; no real option has a key
  await expect(list.locator('[data-key]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  const one = field(page, 'One option');
  await (await onScreen(page, 'One option')).getByRole('button').click();
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(list.getByRole('option', { selected: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(one).toHaveValue('');

  await (await onScreen(page, 'Many options')).getByRole('button').click();
  await expect(list.getByRole('option')).toHaveCount(40);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect((await list.boundingBox())!.height).toBeLessThanOrEqual(288);
  await page.keyboard.press('Escape');
});

test('Clear empties an optional Combobox, and is named by its subject in both forms', async ({
  page,
}) => {
  await openGallery(page);
  const row = specimen(page, 'Combobox', 'Optional');
  await expect(field(page, 'Optional')).toHaveValue('Savings');
  await row.getByRole('button', { name: 'Clear Account', exact: true }).click();
  await expect(field(page, 'Optional')).toHaveValue('');
  await expect(readout(page, 'Optional')).toHaveText('Text: ; value: none');
  await expect(row.getByRole('button', { name: /^Clear/ })).toHaveCount(0);

  const named = specimen(page, 'Combobox', 'Named by aria-label');
  await expect(named.getByRole('button', { name: 'Clear Payee', exact: true })).toBeVisible();
  const required = specimen(page, 'Combobox', 'Required');
  await expect(required.getByText('Select Payee to continue', { exact: true })).toBeVisible();
  await expect(required.getByRole('combobox')).toHaveAccessibleDescription(
    'Select Payee to continue',
  );
  const card = page.getByRole('region', { name: 'Combobox', exact: true });
  await expect(card).not.toContainText('undefined');
  for (const button of await card.getByRole('button').all())
    expect(await button.getAttribute('aria-label')).not.toContain('undefined');
});

test('options keep the caller’s order, and two with one label are chosen by value', async ({
  page,
}) => {
  await openGallery(page);
  await (await onScreen(page, 'Same label')).getByRole('button').click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveText(['Savings', 'Savings', 'Everyday']);
  await list.getByRole('option').nth(1).click();
  await expect(readout(page, 'Same label')).toHaveText('Text: Savings; value: savings-bank');
});

test('a long chosen label truncates on one line', async ({ page }) => {
  await openGallery(page);
  const longField = field(page, 'Long text');
  expect(await longField.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

test('on a phone, rows and buttons are 44 px and nothing is wider than the screen', async ({
  page,
}) => {
  await openGallery(page, { width: 390 });
  const row = specimen(page, 'Combobox', 'Optional');
  for (const button of [
    row.getByRole('button', { name: 'Clear Account' }),
    row.getByRole('button').last(),
  ]) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await (await onScreen(page, 'Long text')).getByRole('button').click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(2);
  // Layout sizes, not the box mid-way through the popover's scale-in entrance
  const size = (el: Locator) =>
    el.evaluate((node) => [(node as HTMLElement).offsetWidth, (node as HTMLElement).offsetHeight]);
  for (const option of await list.getByRole('option').all())
    expect((await size(option))[1]).toBeGreaterThanOrEqual(44);
  expect((await size(list.locator('xpath=..')))[0]).toBeLessThanOrEqual(390 - 16);
  // At its widest the popover cuts a long option short on one line
  const label = list.getByRole('option').first().locator('.truncate');
  expect(await label.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the payee field names a new payee, and ArrowDown then Enter picks the first suggestion', async ({
  page,
}) => {
  await openGallery(page);
  await onScreen(page, 'Payee field');
  const payee = field(page, 'Payee field');
  await expect(payee).toHaveAccessibleName('Payee');
  await payee.click();
  const list = page.getByRole('listbox');
  // The typed name matches no payee: no suggestions, and the new-payee line under the list
  await expect(list.getByRole('option')).toHaveCount(0);
  await expect(page.getByText('New payee: "Night Market"')).toBeVisible();

  await payee.fill('corner');
  await expect(list.getByRole('option')).toHaveText([
    'Corner Grocery',
    'Corner Bakery',
    'Corner Café',
  ]);
  await expect(page.getByText('New payee: "corner"')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(payee).toHaveValue('Corner Grocery');
  await expect(readout(page, 'Payee field')).toHaveText('Payee: Corner Grocery; id: payee-1');

  // Emptied, it lists the first eight of the twelve, in the order given
  await payee.fill('');
  await expect(list.getByRole('option')).toHaveCount(8);
  await expect(list.getByRole('option').first()).toHaveText('Corner Grocery');
  await expect(readout(page, 'Payee field')).toHaveText('Payee: none; id: new');
});
