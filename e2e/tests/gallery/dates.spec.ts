import { test, expect, type Locator, type Page } from '@playwright/test';
import { fillDate, fillMonth } from '../fixtures';
import { openGallery, specimen } from './gallery';

// The shared DatePicker in the controls gallery: typed segments in the Date format preference's
// order on desktop, the native date input under 768 px (D-04), and fillDate, the one way specs
// enter a date (D-07) (#267).

/** The text of each visible <label> in `scope` that points at no field (accessibility.spec.ts) */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !(el as HTMLLabelElement).control)
      .map((el) => el.textContent?.trim()),
  );

const dateCard = (page: Page) => page.getByRole('region', { name: 'DatePicker', exact: true });
const shown = (page: Page, state: string) => specimen(page, 'DatePicker', state).locator('output');

for (const width of [1280, 390] as const)
  test(`fillDate sets the Default date at ${width} px`, async ({ page }) => {
    await openGallery(page, { width });
    const row = specimen(page, 'DatePicker', 'Default');
    await fillDate(row, 'Date', '2026-03-09');
    await expect(shown(page, 'Default')).toHaveText('9 Mar 2026');
    if (width === 390)
      await expect(row.getByLabel('Date', { exact: true })).toHaveValue('2026-03-09');
  });

test('the segments are day, month, year under the default preference', async ({ page }) => {
  await openGallery(page);
  const group = specimen(page, 'DatePicker', 'Default').getByRole('group', { name: 'Date' });
  const types = await group
    .getByRole('spinbutton')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-type')));
  expect(types).toEqual(['day', 'month', 'year']);
  await expect(group).toContainText('16/11/2026');
});

test('nothing in the DatePicker card is a stray label, at either width', async ({ page }) => {
  await openGallery(page);
  expect(await strayLabels(dateCard(page))).toEqual([]);
  await openGallery(page, { width: 390 });
  expect(await strayLabels(dateCard(page))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// The browser's clock is pinned, so "today" is a known day: 20 November 2026, inside the
// Ranged specimen's November and after the Before today specimen's last day (31 October)
const TODAY = new Date(2026, 10, 20, 10, 0, 0);

/** A DatePicker specimen's date group, named by the field's label */
const dateGroup = (page: Page, state: string) =>
  specimen(page, 'DatePicker', state).getByRole('group').first();
const calendarButton = (page: Page, state: string) =>
  specimen(page, 'DatePicker', state).getByRole('button', { name: 'Choose from a calendar' });
/** Moves focus out of every field, the way a person clicks on the page */
const leaveField = (page: Page) => page.getByRole('heading', { level: 1 }).click();

test('Select today sets today, closes the calendar and returns focus to the field', async ({
  page,
}) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  await calendarButton(page, 'Optional').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const today = dialog.getByRole('button', { name: 'Select today' });
  await expect(today).toHaveText('Today');
  await today.click();
  await expect(dialog).toHaveCount(0);
  await expect(shown(page, 'Optional')).toHaveText('20 Nov 2026');
  expect(
    await dateGroup(page, 'Optional').evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
});

test('Select today is disabled when today is outside the range', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  await calendarButton(page, 'Before today').click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Select today' }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  // The first calendar closes before the next opens, so only one dialog is on the page
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await calendarButton(page, 'Ranged').click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Select today' }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
});

test('both bounds are allowed; a day outside shows the range line', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'DatePicker', 'Ranged');
  for (const day of ['2026-11-01', '2026-11-30']) {
    await fillDate(row, 'Start date', day);
    await leaveField(page);
    await expect(row.getByText(/^Enter a date/)).toHaveCount(0);
    await expect(dateGroup(page, 'Ranged')).not.toHaveAttribute('data-invalid');
  }
  await fillDate(row, 'Start date', '2026-12-01');
  await expect(row.getByText('Enter a date between 1 Nov 2026 and 30 Nov 2026')).toBeVisible();
  await expect(dateGroup(page, 'Ranged')).toHaveAttribute('data-invalid', 'true');

  const floor = specimen(page, 'DatePicker', 'From a day');
  await fillDate(floor, 'Paid from', '2026-10-31');
  await expect(floor.getByText('Enter a date on or after 1 Nov 2026')).toBeVisible();
  await fillDate(floor, 'Paid from', '2026-11-01');
  await expect(floor.getByText(/^Enter a date/)).toHaveCount(0);
});

test('a half-typed required date is no value and asks for the full date', async ({ page }) => {
  await openGallery(page);
  const group = dateGroup(page, 'Required');
  await group.locator('[data-type="day"]').click();
  await page.keyboard.type('16');
  await group.locator('[data-type="month"]').click();
  await page.keyboard.type('11');
  await leaveField(page);
  const row = specimen(page, 'DatePicker', 'Required');
  await expect(row.getByText('Enter the full date, like 16/11/2026')).toBeVisible();
  await expect(shown(page, 'Required')).toHaveText('none');
  await group.locator('[data-type="year"]').click();
  await page.keyboard.type('2026');
  await expect(shown(page, 'Required')).toHaveText('16 Nov 2026');
  await expect(row.getByText(/^Enter the full date/)).toHaveCount(0);
});

test('the calendar moves by arrow keys with a ring, and Escape keeps focus in the field', async ({
  page,
}) => {
  await openGallery(page);
  await calendarButton(page, 'Focus').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const focused = dialog.locator('[role="gridcell"] [data-focused]');
  await expect(focused).toHaveText('16');
  await page.keyboard.press('ArrowRight');
  await expect(focused).toHaveText('17');
  await page.keyboard.press('ArrowDown');
  await expect(focused).toHaveText('24');
  await expect(focused).not.toHaveCSS('box-shadow', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await dateGroup(page, 'Focus').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await expect(dateGroup(page, 'Focus')).toContainText('16/11/2026');
});

test('Tab skips the disabled date; the read-only one takes focus but never changes', async ({
  page,
}) => {
  await openGallery(page);
  await calendarButton(page, 'Focus').focus();
  await page.keyboard.press('Tab');
  await expect(dateGroup(page, 'Invalid').locator('[data-type="day"]')).toBeFocused();
  await expect(calendarButton(page, 'Disabled')).toBeDisabled();

  const readOnly = dateGroup(page, 'Read-only');
  await expect(readOnly).toHaveAttribute('data-readonly', 'true');
  const day = readOnly.locator('[data-type="day"]');
  await day.focus();
  await expect(day).toBeFocused();
  await page.keyboard.type('3');
  await page.keyboard.press('ArrowUp');
  await expect(readOnly).toContainText('16/11/2026');
  await expect(calendarButton(page, 'Read-only')).toBeDisabled();
  await calendarButton(page, 'Read-only').click({ force: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the date group looks like an Input in each state', async ({ page }) => {
  await openGallery(page);
  const looks = (field: Locator) =>
    field.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.height, style.backgroundColor, style.borderTopColor, style.borderRadius];
    });
  for (const state of ['Default', 'Disabled', 'Invalid', 'Read-only'])
    expect(await looks(dateGroup(page, state)), state).toEqual(
      await looks(specimen(page, 'Input', state).getByRole('textbox')),
    );
});

test('on a phone the native date keeps its range and shows the required line', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const ranged = specimen(page, 'DatePicker', 'Ranged').locator('input');
  await expect(ranged).toHaveAttribute('type', 'date');
  await expect(ranged).toHaveAttribute('min', '2026-11-01');
  await expect(ranged).toHaveAttribute('max', '2026-11-30');
  expect((await ranged.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(ranged).toHaveCSS('font-size', '16px');
  const missing = specimen(page, 'DatePicker', 'Missing').locator('input');
  await expect(missing).toHaveAttribute('aria-invalid', 'true');
  await expect(missing).toHaveAccessibleDescription('Select Due on to continue');
  await expect(specimen(page, 'DatePicker', 'Disabled').locator('input')).toBeDisabled();
  await expect(specimen(page, 'DatePicker', 'Read-only').locator('input')).toHaveAttribute(
    'readonly',
    '',
  );
});

// The shared MonthPicker: the owner's grid form on desktop (D-11), the native month input on
// phones (D-04), and fillMonth

/** A MonthPicker specimen's trigger: the button named by the label, then the shown month */
const monthTrigger = (page: Page, state: string) =>
  specimen(page, 'MonthPicker', state).getByRole('button').first();
const monthShown = (page: Page, state: string) =>
  specimen(page, 'MonthPicker', state).locator('output');
const monthDialog = (page: Page) => page.getByRole('dialog', { name: 'Choose a month' });

test('the month grid opens from the keyboard, steps the year and chooses a month', async ({
  page,
}) => {
  await openGallery(page);
  const trigger = monthTrigger(page, 'Default');
  await expect(trigger).toHaveAccessibleName('Budget month Nov 2026');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = monthDialog(page);
  await expect(dialog).toBeVisible();
  // It opens on the chosen month, which is marked pressed
  const november = dialog.getByRole('button', { name: 'November 2026', exact: true });
  await expect(november).toBeFocused();
  await expect(november).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Previous year' }).click();
  await expect(dialog.getByRole('button', { name: 'November 2025', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next year' }).click();
  await dialog.getByRole('button', { name: 'Next year' }).click();
  await dialog.getByRole('button', { name: 'March 2027', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(monthShown(page, 'Default')).toHaveText('2027-03');
  await expect(trigger).toHaveText('Mar 2027');
  await expect(trigger).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button', { name: 'March 2027', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('Select this month sets the current month, and is disabled out of range', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  const trigger = monthTrigger(page, 'Optional');
  await expect(trigger).toHaveText('Select month');
  await trigger.click();
  const thisMonth = monthDialog(page).getByRole('button', { name: 'Select this month' });
  await expect(thisMonth).toHaveText('This month');
  await thisMonth.click();
  await expect(monthDialog(page)).toHaveCount(0);
  await expect(monthShown(page, 'Optional')).toHaveText('2026-11');

  await monthTrigger(page, 'Before this month').click();
  await expect(monthDialog(page).getByRole('button', { name: 'Select this month' })).toBeDisabled();
  await page.keyboard.press('Escape');
});

test('the range bounds can be chosen, months outside are disabled', async ({ page }) => {
  await openGallery(page);
  await monthTrigger(page, 'Ranged').click();
  const dialog = monthDialog(page);
  for (const name of ['March 2026', 'November 2026'])
    await expect(dialog.getByRole('button', { name, exact: true })).toBeEnabled();
  for (const name of ['February 2026', 'December 2026'])
    await expect(dialog.getByRole('button', { name, exact: true })).toBeDisabled();
  // 2026 holds the last month in range, so the grid stops there, as it does at its floor (IN-03)
  await expect(dialog.getByRole('button', { name: 'Next year' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Previous year' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'March 2026', exact: true }).click();
  await expect(monthShown(page, 'Ranged')).toHaveText('2026-03');
  await expect(specimen(page, 'MonthPicker', 'Ranged').getByText(/^Choose a month/)).toHaveCount(0);

  // A month past the range shows the contract's line, its bound written by formatMonth
  const late = specimen(page, 'MonthPicker', 'Before this month');
  await expect(late.getByText('Choose a month on or before Oct 2026')).toBeVisible();
  await expect(late.getByRole('group')).toHaveAttribute('data-invalid', 'true');
});

test('Clear empties an optional month and shows only when it applies', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'MonthPicker', 'Optional');
  const clear = row.getByRole('button', { name: 'Clear end month' });
  await expect(clear).toHaveCount(0);
  await fillMonth(row, 'Ends in (optional)', '2027-01');
  await expect(monthShown(page, 'Optional')).toHaveText('2027-01');
  await clear.click();
  await expect(monthShown(page, 'Optional')).toHaveText('none');
  await expect(clear).toHaveCount(0);
  for (const state of ['Disabled', 'Read-only'])
    await expect(
      specimen(page, 'MonthPicker', state).getByRole('button', { name: /^Clear/ }),
    ).toHaveCount(0);
});

test('Tab skips the disabled month; the read-only one takes focus but never opens', async ({
  page,
}) => {
  await openGallery(page);
  await monthTrigger(page, 'Focus').focus();
  await page.keyboard.press('Tab');
  await expect(monthTrigger(page, 'Invalid')).toBeFocused();
  await expect(monthTrigger(page, 'Disabled')).toBeDisabled();
  await page.keyboard.press('Tab');
  const readOnly = monthTrigger(page, 'Read-only');
  await expect(readOnly).toBeFocused();
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    await page.keyboard.press(key);
    await expect(monthDialog(page)).toHaveCount(0);
  }
  await readOnly.click();
  await expect(monthDialog(page)).toHaveCount(0);
  await expect(readOnly).toHaveText('Nov 2026');
});

test('the month group looks like an Input in each state, with no stray label', async ({ page }) => {
  await openGallery(page);
  const looks = (field: Locator) =>
    field.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.height, style.backgroundColor, style.borderTopColor, style.borderRadius];
    });
  for (const state of ['Default', 'Disabled', 'Invalid', 'Read-only'])
    expect(await looks(specimen(page, 'MonthPicker', state).getByRole('group')), state).toEqual(
      await looks(specimen(page, 'Input', state).getByRole('textbox')),
    );
  const card = page.getByRole('region', { name: 'MonthPicker', exact: true });
  expect(await strayLabels(card)).toEqual([]);
  await expect(
    specimen(page, 'MonthPicker', 'Missing').getByText('Select Pay month to continue'),
  ).toBeVisible();
});

test('on a phone the MonthPicker is a native month input, 44 px tall with 16 px text', async ({
  page,
}) => {
  await openGallery(page, { width: 390 });
  const row = specimen(page, 'MonthPicker', 'Ranged');
  const input = row.locator('input');
  await expect(input).toHaveAttribute('type', 'month');
  await expect(row.getByRole('button')).toHaveCount(0);
  await expect(input).toHaveAttribute('min', '2026-03');
  await expect(input).toHaveAttribute('max', '2026-11');
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(input).toHaveCSS('font-size', '16px');
  await expect(specimen(page, 'MonthPicker', 'Disabled').locator('input')).toBeDisabled();
  await expect(specimen(page, 'MonthPicker', 'Read-only').locator('input')).toHaveAttribute(
    'readonly',
    '',
  );
  const card = page.getByRole('region', { name: 'MonthPicker', exact: true });
  expect(await strayLabels(card)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const width of [1280, 390] as const)
  test(`fillMonth sets the Default month at ${width} px`, async ({ page }) => {
    await openGallery(page, { width });
    await fillMonth(specimen(page, 'MonthPicker', 'Default'), 'Budget month', '2025-07');
    await expect(monthShown(page, 'Default')).toHaveText('2025-07');
  });

// A half-typed date holds no day: the caller keeps its last whole one, so the field tells an
// enclosing form (AmountFields) as each segment is edited, and again once it is whole
test('a half-typed date keeps its form unavailable until it is whole again', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'DatePicker', 'Half-typed in a form');
  const save = row.getByTestId('save-state');
  const day = row
    .getByRole('group', { name: 'Pay date', exact: true })
    .locator('[data-type="day"]');
  await expect(save).toHaveText('available');
  await day.click();
  await expect(day).toBeFocused();
  for (let i = 0; i < 4 && (await day.getAttribute('data-placeholder')) === null; i++)
    await day.press('Backspace');
  await expect(day).toHaveAttribute('data-placeholder', 'true');
  await expect(save).toHaveText('unavailable');
  // The form re-rendered to say so; the half-typed segments stay as typed, not the last whole day
  await expect(day).toHaveAttribute('data-placeholder', 'true');
  await expect(row.getByRole('group', { name: 'Pay date', exact: true })).not.toContainText(
    '01/11/2026',
  );
  // The caller still holds the last whole day (16, then 1 after the first Backspace); the form
  // is what knows the field no longer shows one
  await expect(row.locator('output').first()).toHaveText('1 Nov 2026');
  await page.keyboard.type('20');
  await expect(save).toHaveText('available');
  await expect(row.locator('output').first()).toHaveText('20 Nov 2026');
});

// Picking the day the field already holds fills its half-typed segments again: the caller's
// value does not change, so the picker itself has to put the whole date back
test('picking the held day refills a half-typed date', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'DatePicker', 'Half-typed in a form');
  const save = row.getByTestId('save-state');
  const group = row.getByRole('group', { name: 'Pay date', exact: true });
  const day = group.locator('[data-type="day"]');
  await day.click();
  for (let i = 0; i < 4 && (await day.getAttribute('data-placeholder')) === null; i++)
    await day.press('Backspace');
  await expect(save).toHaveText('unavailable');
  const held = await row.locator('output').first().textContent();
  await group.getByRole('button', { name: 'Choose from a calendar' }).click();
  await page.getByRole('dialog').locator('[role="gridcell"] [data-selected]').click();
  await expect(day).not.toHaveAttribute('data-placeholder');
  await expect(save).toHaveText('available');
  await leaveField(page);
  await expect(day).not.toHaveAttribute('data-placeholder');
  await expect(row.getByText(/^Enter the full date/)).toHaveCount(0);
  await expect(save).toHaveText('available');
  await expect(row.locator('output').first()).toHaveText(held!);
});

// Clearing an optional date drops a line named for its half-typed state: the field is empty, not
// half-typed, and focus has already left with the Clear button, so no blur re-checks it (review-3 WR-01)
test('Clear drops the full-date line of a half-typed optional date', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  const row = specimen(page, 'DatePicker', 'Optional');
  const group = dateGroup(page, 'Optional');
  await calendarButton(page, 'Optional').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Select today' }).click();
  await expect(shown(page, 'Optional')).toHaveText('20 Nov 2026');
  const day = group.locator('[data-type="day"]');
  await day.click();
  for (let i = 0; i < 4 && (await day.getAttribute('data-placeholder')) === null; i++)
    await day.press('Backspace');
  await leaveField(page);
  await expect(row.getByText(/^Enter the full date/)).toBeVisible();
  await expect(group).toHaveAttribute('data-invalid', 'true');
  await row.getByRole('button', { name: /^Clear / }).click();
  await expect(shown(page, 'Optional')).toHaveText('none');
  await leaveField(page);
  await expect(row.getByText(/^Enter the full date/)).toHaveCount(0);
  await expect(group).not.toHaveAttribute('data-invalid');
});
