import { test, expect, open } from './fixtures';

test('an Essentials account has its own Ready to assign for the bills paid from it', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 100_000);
  const essentials = await api.createAccount('Essentials', 30_000);
  const rent = await api.category('Rent / Mortgage');

  await open(page, `/accounts/${essentials.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit account' });
  await dialog.getByRole('checkbox', { name: /Own Ready to assign/ }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await api.call('PUT', `/categories/${rent.id}`, { poolAccountId: essentials.id });

  await open(page, '/budget');
  await expect(page.getByRole('status', { name: 'Ready to assign', exact: true })).toContainText(
    '$1,000',
  );
  await expect(page.getByRole('status', { name: 'Essentials: ready to assign' })).toContainText(
    '$300',
  );
  // Rent can't take more than Essentials holds, whatever the main figure has
  const month = new Date().toISOString().slice(0, 7);
  const tooMuch = await api.request.fetch(`/api/budget/${month}/${rent.id}`, {
    method: 'PUT',
    data: { budgeted: 30_001 },
  });
  expect(tooMuch.status()).toBe(409);
  expect(await tooMuch.text()).toContain("Essentials's own Ready to assign");
});
