import { test, expect, open, isoDay } from './fixtures';

// Depreciating assets on Tax time (docs/DEPRECIATING-ASSETS-PLAN.md, phase 2). Mock data only.

test('a claim over $300 is depreciated instead, then locked once its year is lodged', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Card', 0, 'credit');
  await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -199_900,
    payeeName: 'Laptop Store',
  });

  // Claimed outright first, as people do
  await open(page, `/accounts/${card.id}`);
  await page.getByTestId('transaction-row').filter({ hasText: 'Laptop Store' }).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Transaction details' });
  await panel.getByLabel('Claim as a tax deduction').check();
  await expect(panel.getByLabel('Tax return label')).toHaveValue('D5');

  // Over $300: Deductions offers to depreciate it instead
  await open(page, '/tax');
  const claims = page.getByRole('region', { name: 'Claims' });
  await expect(claims).toContainText('Laptop Store');
  await claims.getByRole('link', { name: 'Depreciate instead' }).click();

  const form = page.getByRole('dialog', { name: 'Add an asset' });
  await expect(form.getByRole('note')).toContainText('claimed outright now');
  await expect(form.getByLabel('Name')).toHaveValue('Laptop Store');
  await form.getByLabel('Name').fill('Work laptop');
  await form.getByRole('button', { name: 'laptop 2 years' }).click();
  await expect(form.getByLabel('Effective life (years)')).toHaveValue('2');
  // Both methods previewed side by side before choosing
  await expect(form.getByRole('table', { name: 'Diminishing value' })).toBeVisible();
  await expect(form.getByRole('table', { name: 'Prime cost' })).toBeVisible();
  await form.getByLabel('Prime cost').check();
  await form.getByRole('button', { name: 'Depreciate instead' }).click();

  const detail = page.getByRole('dialog', { name: 'Work laptop' });
  await expect(detail.getByText('Prime cost')).toBeVisible();
  await expect(detail.getByRole('region', { name: 'Schedule' })).toBeVisible();
  await expect(detail.getByRole('region', { name: 'Records' })).toBeVisible();
  await detail.getByRole('button', { name: 'Close' }).click();

  // The claim is replaced: Deductions shows the decline in value, not the outright claim
  await page.getByRole('tab', { name: 'Deductions' }).click();
  await expect(page.getByRole('region', { name: 'Decline in value' })).toContainText('Work laptop');
  await expect(page.getByRole('region', { name: 'Claims' })).toHaveCount(0);

  // The transaction says where it went
  await open(page, `/accounts/${card.id}`);
  await page.getByTestId('transaction-row').filter({ hasText: 'Laptop Store' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel.getByText('Depreciated as')).toBeVisible();
  await expect(panel.getByLabel('Claim as a tax deduction')).toHaveCount(0);

  // Lodging the year locks the method
  await open(page, '/tax?tab=assets');
  const lodged = page.getByRole('region', { name: 'Lodged years' });
  const year = lodged.getByRole('button').first();
  await year.click();
  await expect(year).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Work laptop' }).click();
  await page
    .getByRole('dialog', { name: 'Work laptop' })
    .getByRole('button', { name: 'Edit' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Edit Work laptop' }).getByLabel('Prime cost'),
  ).toBeDisabled();
});

test('a low-cost asset goes into the low-value pool: D6 in Deductions', async ({ page }) => {
  await open(page, '/tax?tab=assets');
  await page.getByRole('button', { name: 'Add an asset' }).click();
  const form = page.getByRole('dialog', { name: 'Add an asset' });
  await form.getByLabel('Name').fill('Headset');
  await form.getByLabel('Cost', { exact: true }).fill('800');
  await form.getByLabel('Start date (first used or installed ready for use)').fill(isoDay());
  await form.getByLabel('Effective life (years)').fill('3');
  await form.getByRole('button', { name: 'Add asset' }).click();

  const detail = page.getByRole('dialog', { name: 'Headset' });
  const pool = detail.getByRole('region', { name: 'Low-value pool' });
  await expect(pool).toContainText('under $1,000');
  await pool.getByRole('button', { name: /Move to the pool from/ }).click();
  await expect(pool).toContainText('In the low-value pool from');
  // Taken out (a correction) and put back, without reopening it
  await pool.getByRole('button', { name: 'Take it out of the pool' }).click();
  await pool.getByRole('button', { name: /Move to the pool from/ }).click();
  await expect(pool).toContainText('In the low-value pool from');
  await detail.getByRole('button', { name: 'Close' }).click();

  // 18.75% of $800 in its first year
  const section = page.getByRole('region', { name: 'Low-value pool (D6)' });
  await expect(section).toContainText('$150');
  // Only pooled assets, and still a year to lock
  await expect(
    page.getByRole('region', { name: 'Lodged years' }).getByRole('button').first(),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Deductions' }).click();
  await expect(page.getByRole('region', { name: 'Decline in value' })).toContainText(
    'Low-value pool',
  );
  await expect(page.getByRole('region', { name: 'Totals by label' })).toContainText(
    'Low-value pool deduction',
  );
});
