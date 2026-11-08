import { test, expect, open, isoDay } from './fixtures';

// Tax time → Car and home, working from home (D4a, docs/TAX-CAR-AND-HOME.md). Mock data only.

/** The current financial year, named by the year it starts, and its first Monday */
const fy = (() => {
  const today = isoDay();
  return Number(today.slice(5, 7)) >= 7 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
})();
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monday = (() => {
  let d = `${fy}-07-01`;
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1);
  return d;
})();
const yearName = `${fy}–${String(fy + 1).slice(2)}`;

async function addDay(page: import('@playwright/test').Page, date: string, hours: string) {
  await page.getByRole('button', { name: 'Add hours' }).click();
  const form = page.getByRole('dialog', { name: 'Add hours' });
  await form.getByLabel('Date').fill(date);
  await form.getByLabel('Hours worked at home').fill(hours);
  await form.getByRole('button', { name: 'Save hours' }).click();
  await expect(form).toBeHidden();
}

test('hours at home go into D5; a lodged year is amended, then marked lodged again', async ({
  page,
}) => {
  await open(page, '/tax?tab=car-home');
  await expect(page.getByRole('heading', { name: 'Working from home' })).toBeVisible();

  // One Monday of 8 hours, then Monday to Friday for two weeks at 7.5 hours: the Monday is kept
  await addDay(page, monday, '8');
  await page.getByRole('button', { name: 'Fill a pattern' }).click();
  const fill = page.getByRole('dialog', { name: 'Fill a pattern' });
  await fill.getByLabel('From').fill(monday);
  await fill.getByLabel('To').fill(addDays(monday, 13));
  await fill.getByLabel('Hours each day').fill('7.5');
  await expect(fill.getByRole('status')).toHaveText('Adds 9 days, skips 1 already recorded.');
  await fill.getByRole('button', { name: 'Add 9 days' }).click();
  await expect(fill).toBeHidden();
  // 8 h + 9 × 7.5 h = 75.5 h over 10 days
  await expect(page.getByText('10 days')).toBeVisible();
  await expect(page.getByText('75 h 30 min').first()).toBeVisible();

  // The year's rate: the ATO has none built in for some years, so type one for any year
  await page.getByRole('button', { name: 'Change' }).click();
  const rate = page.getByRole('dialog', { name: `Rate for ${yearName}` });
  await rate.getByLabel('Your rate (cents per hour)').fill('70');
  await rate.getByRole('button', { name: 'Save rate' }).click();
  await expect(rate).toBeHidden();
  await expect(page.getByText('your rate')).toBeVisible();

  // 75.5 hours at 70c is $52.85, in D5
  await page.getByRole('tab', { name: 'Deductions' }).click();
  const totals = page.getByRole('region', { name: 'Totals by label' });
  await expect(totals).toContainText('D5');
  await expect(totals).toContainText('52.85');

  // Mark the year lodged, then change a day
  await open(page, '/tax?tab=assets');
  const lodgedYear = page
    .getByRole('region', { name: 'Lodged years' })
    .getByRole('button', { name: new RegExp(yearName) });
  await lodgedYear.click();
  await expect(lodgedYear).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Car and home' }).click();
  await page
    .getByRole('button', { name: /^Edit hours on/ })
    .first()
    .click();
  const edit = page.getByRole('dialog', { name: 'Edit hours' });
  await edit.getByLabel('Hours worked at home').fill('9');
  await edit.getByRole('button', { name: 'Save hours' }).click();
  await expect(edit).toBeHidden();

  // Not refused: the year says it was amended
  await page.getByRole('tab', { name: 'Deductions' }).click();
  const banner = page.getByRole('region', { name: 'Amended since lodging' });
  await expect(banner).toContainText('working from home was $52.85, now $53.55');
  await banner.getByRole('button', { name: 'Mark lodged again' }).click();
  await expect(banner).toBeHidden();
  await expect(totals).toContainText('53.55');
});

test('the Car and home tab holds at 390 px with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/tax?tab=car-home');
  await addDay(page, monday, '7:30');
  await expect(page.getByRole('button', { name: /^Edit hours on/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fill a pattern' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
