import { test, expect, open, isoDay } from './fixtures';

// P3 investments (docs/INVESTMENTS.md): manual holdings, prices and purchases, kept apart from
// the ledger until the user records a value. Mock data only.

test('records a priced holding without touching the balance until asked', async ({ page, api }) => {
  const account = await api.createAccount('Mock brokerage', 100000, 'investment');
  await open(page, '/investments');
  await expect(page.getByRole('heading', { name: 'Investments' })).toBeVisible();

  // A security, then a holding of it in the account
  await page.getByRole('button', { name: 'Add holding' }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Add holding' });
  await dialog.getByRole('button', { name: "Add a security that isn't listed" }).click();
  dialog = page.getByRole('dialog', { name: 'Add security' });
  await dialog.getByLabel('Code').fill('mock');
  await dialog.getByLabel('Name').fill('Mock index fund');
  await dialog.getByRole('button', { name: 'Save' }).click();
  dialog = page.getByRole('dialog', { name: 'Add holding' });
  await expect(dialog.getByLabel('Security')).toContainText('MOCK · Mock index fund');
  await dialog.getByLabel('Units held').fill('10.5');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // No price yet: unvalued, never zero
  await expect(page.getByRole('cell', { name: 'No price' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a price' }).click();
  dialog = page.getByRole('dialog', { name: 'Price of MOCK' });
  await dialog.getByLabel('Date').fill(isoDay(-1));
  await dialog.getByLabel('Price per unit').fill('20');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('row', { name: /MOCK/ });
  await expect(row).toContainText(/\$210(\.00)?/);
  // No purchases: the cost is unknown and there's no gain
  await expect(page.getByRole('button', { name: 'Unknown' })).toBeVisible();

  await page.getByRole('button', { name: 'Unknown' }).click();
  dialog = page.getByRole('dialog', { name: 'Purchases of MOCK' });
  await expect(dialog.getByLabel('Units', { exact: true })).toHaveValue('10.5');
  await dialog.getByLabel('Bought on').fill(isoDay(-30));
  await dialog.getByLabel('Total cost').fill('150');
  await dialog.getByRole('button', { name: 'Add purchase' }).click();
  await expect(dialog).toContainText('Every unit has a known cost.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toContainText(/\$150(\.00)?/);
  await expect(row).toContainText(/\+A?\$60(\.00)?/);
  await expect(row).toContainText('+40.00%');

  // Nothing written to the ledger so far
  expect(await api.balance(account.id)).toBe(100000);

  await expect(page.getByText(/worth A?\$790(\.00)? less than the recorded balance/)).toBeVisible();
  await page.getByRole('button', { name: 'Record as value' }).click();
  dialog = page.getByRole('dialog', { name: 'Update Value' });
  await expect(dialog).toContainText('adjustment dated today');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => api.balance(account.id)).toBe(21000);
  await expect(page.getByText(/than the recorded balance/)).toBeHidden();
});
