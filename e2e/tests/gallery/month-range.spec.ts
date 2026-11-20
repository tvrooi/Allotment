import { test, expect, type Page } from '@playwright/test';
import { openGallery, specimen, tabTo } from './gallery';

// The shared MonthRangePicker in the controls gallery: two of MonthPicker's month grids, From
// and To, in a "Choose months" dialog on desktop, and two native month inputs under 768 px
// (D-04, D-11) (#267). Every specimen starts on June to November 2026, with December 2026 the
// latest month.

/** The browser's clock is pinned, so "This month" is November 2026 */
const TODAY = new Date('2026-11-16T12:00:00');

const trigger = (page: Page, state: string) =>
  specimen(page, 'MonthRangePicker', state).getByRole('button').first();
const shown = (page: Page, state: string) =>
  specimen(page, 'MonthRangePicker', state).locator('output');
const rangeDialog = (page: Page) => page.getByRole('dialog', { name: 'Choose months' });

test('the keyboard reaches, opens, picks and applies a range', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  // The last MonthPicker specimen comes just before the range card
  await specimen(page, 'MonthPicker', 'Before this month').getByRole('button').first().focus();
  await page.keyboard.press('Tab');
  const button = trigger(page, 'Default');
  await expect(button).toBeFocused();
  await expect(button).toHaveAccessibleName('Jun 2026 – Nov 2026');
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');

  await page.keyboard.press('Enter');
  const dialog = rangeDialog(page);
  await expect(dialog).toBeVisible();
  const from = dialog.getByRole('group', { name: 'From' });
  const to = dialog.getByRole('group', { name: 'To' });
  // Focus starts on the chosen From month
  await expect(from.getByRole('button', { name: 'June 2026', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(from.getByRole('button', { name: 'July 2026', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(from.getByRole('button', { name: 'July 2026', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const done = dialog.getByRole('button', { name: 'Done' });
  for (let i = 0; i < 40 && !(await done.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(done).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(shown(page, 'Default')).toHaveText('2026-07 to 2026-11');
  await expect(button).toHaveText('Jul 2026 – Nov 2026');
  await expect(button).toBeFocused();

  // This month in the To grid sets To to the current month
  await page.keyboard.press('Enter');
  await to.getByRole('button', { name: 'December 2026', exact: true }).click();
  await expect(dialog).toContainText('Jul 2026 – Dec 2026');
  await to.getByRole('button', { name: 'Select this month' }).click();
  await expect(to.getByRole('button', { name: 'November 2026', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(shown(page, 'Default')).toHaveText('2026-07 to 2026-11');

  // Escape discards a draft and returns focus to the trigger
  await button.focus();
  await page.keyboard.press('Enter');
  await from.getByRole('button', { name: 'September 2026', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(shown(page, 'Default')).toHaveText('2026-07 to 2026-11');
});

test('a From after To moves To up, and To cannot start before From', async ({ page }) => {
  await openGallery(page);
  await trigger(page, 'Default').click();
  const dialog = rangeDialog(page);
  const to = dialog.getByRole('group', { name: 'To' });
  await dialog
    .getByRole('group', { name: 'From' })
    .getByRole('button', { name: 'December 2026', exact: true })
    .click();
  await expect(to.getByRole('button', { name: 'December 2026', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const name of ['June 2026', 'November 2026'])
    await expect(to.getByRole('button', { name, exact: true })).toBeDisabled();
  // After max, nothing can be chosen
  await to.getByRole('button', { name: 'Next year' }).click();
  await expect(to.getByRole('button', { name: 'January 2027', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(shown(page, 'Default')).toHaveText('2026-12 to 2026-12');
  await expect(trigger(page, 'Default')).toHaveText('Dec 2026');
});

test('read-only takes focus but never opens; disabled is skipped; invalid shows its line', async ({
  page,
}) => {
  await openGallery(page);
  await trigger(page, 'Focus').focus();
  await page.keyboard.press('Tab');
  await expect(trigger(page, 'Invalid')).toBeFocused();
  await expect(trigger(page, 'Disabled')).toBeDisabled();
  await expect(
    specimen(page, 'MonthRangePicker', 'Invalid').getByText('Choose months the bank has sent.'),
  ).toBeVisible();
  await expect(specimen(page, 'MonthRangePicker', 'Invalid').getByRole('group')).toHaveAttribute(
    'data-invalid',
    'true',
  );
  await page.keyboard.press('Tab');
  const readOnly = trigger(page, 'Read-only');
  await expect(readOnly).toBeFocused();
  for (const key of ['Enter', ' ']) {
    await page.keyboard.press(key);
    await expect(rangeDialog(page)).toHaveCount(0);
  }
  await readOnly.click();
  await expect(rangeDialog(page)).toHaveCount(0);
  await expect(readOnly).toHaveText('Jun 2026 – Nov 2026');
});

test('a label names the trigger with the range', async ({ page }) => {
  await openGallery(page);
  await expect(trigger(page, 'Labelled')).toHaveAccessibleName('Report months Jun 2026 – Nov 2026');
});

test('on a phone it is two native month inputs that keep the range in order', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const row = specimen(page, 'MonthRangePicker', 'Default');
  await expect(row.getByRole('button')).toHaveCount(0);
  const from = row.getByLabel('From', { exact: true });
  const to = row.getByLabel('To', { exact: true });
  for (const input of [from, to]) {
    await expect(input).toHaveJSProperty('tagName', 'INPUT');
    await expect(input).toHaveAttribute('type', 'month');
    expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(input).toHaveCSS('font-size', '16px');
  }
  await expect(from).toHaveAttribute('max', '2026-12');
  await expect(to).toHaveAttribute('min', '2026-06');
  await expect(to).toHaveAttribute('max', '2026-12');

  // Short month text shows whole at 390 px without clipping (MonthRangePicker phone: short)
  const fromDisplay = row.locator('[data-month-display="from"]');
  const toDisplay = row.locator('[data-month-display="to"]');
  await expect(fromDisplay).toHaveText('Jun 2026');
  await expect(toDisplay).toHaveText('Nov 2026');

  await from.fill('2026-11');
  await expect(fromDisplay).toHaveText('Nov 2026');
  expect(await fromDisplay.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(shown(page, 'Default')).toHaveText('2026-11 to 2026-11');

  // A From after To moves To up to it
  await from.fill('2026-12');
  await expect(shown(page, 'Default')).toHaveText('2026-12 to 2026-12');
  await expect(to).toHaveValue('2026-12');
  await expect(fromDisplay).toHaveText('Dec 2026');
  await expect(toDisplay).toHaveText('Dec 2026');
  // A From after max changes nothing
  await from.fill('2027-01');
  await expect(from).toHaveValue('2026-12');
  await expect(shown(page, 'Default')).toHaveText('2026-12 to 2026-12');
  // A cleared To changes nothing (E-02 empty)
  await to.fill('');
  await expect(to).toHaveValue('2026-12');
  await expect(shown(page, 'Default')).toHaveText('2026-12 to 2026-12');

  await expect(
    specimen(page, 'MonthRangePicker', 'Disabled').locator('input').first(),
  ).toBeDisabled();
  await expect(
    specimen(page, 'MonthRangePicker', 'Read-only').locator('input').first(),
  ).toHaveAttribute('readonly', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('at 767 px tabbing into From reveals the native month input for keyboard editing (WR-03)', async ({
  page,
}) => {
  await openGallery(page, { width: 767 });
  const prev = specimen(page, 'MonthPicker', 'Before this month').locator('input[type="month"]');
  const row = specimen(page, 'MonthRangePicker', 'Default');
  const from = row.getByLabel('From', { exact: true });
  const fromDisplay = row.locator('[data-month-display="from"]');

  await expect(from).toHaveCSS('opacity', '0');
  await expect(fromDisplay).toHaveCSS('visibility', 'visible');
  await expect(fromDisplay).toHaveText('Jun 2026');

  await prev.focus();
  await tabTo(page, from, 10);
  await expect(from).toBeFocused();
  await expect(from).toHaveCSS('opacity', '1');
  await expect(fromDisplay).toHaveCSS('visibility', 'hidden');

  // Typing 'n' on the month segment picks November and keeps the native input visible while editing
  await page.keyboard.press('n');
  await expect(from).toHaveValue('2026-11');
  await expect(from).toHaveCSS('opacity', '1');
  await expect(fromDisplay).toHaveCSS('visibility', 'hidden');
  await expect(shown(page, 'Default')).toHaveText('2026-11 to 2026-11');

  // Leaving the field restores the short month display showing the edited month
  await from.blur();
  await expect(from).toHaveCSS('opacity', '0');
  await expect(fromDisplay).toHaveCSS('visibility', 'visible');
  await expect(fromDisplay).toHaveText('Nov 2026');
});
