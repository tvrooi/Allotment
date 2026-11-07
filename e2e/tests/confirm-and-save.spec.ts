import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// UX audit AU-006 and AU-005: a refused delete closed its confirmation as if it had worked,
// and a refused report save left its dialog looking untouched. Both now show that they're
// working, can't be sent twice, stay open with the reason when refused, and work on retry.

/**
 * Refuses the next `method` request to `pattern` with a 422 (or, with `delayMs`, lets it
 * through slowly), and counts what is sent
 */
async function intercept(
  page: Page,
  pattern: string,
  method: string,
  { refuse = false, delayMs = 0 } = {},
) {
  const sent = { count: 0 };
  let refused = false;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== method) return route.continue();
    sent.count++;
    if (refuse && !refused) {
      refused = true;
      return route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'The server refused this for the test.' }),
      });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.continue();
  });
  return sent;
}

test('a refused goal deletion keeps the confirmation open, and retrying works', async ({
  page,
  api,
}) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  const sent = await intercept(page, '**/api/goals/*', 'DELETE', { refuse: true });
  await open(page, '/goals');
  await page.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete goal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete goal' });
  const remove = dialog.getByRole('button', { name: 'Delete', exact: true });
  await remove.click();

  await expect(dialog.getByRole('alert')).toHaveText('The server refused this for the test.');
  await expect(dialog).toBeVisible();
  expect(await api.call('GET', '/goals')).toHaveLength(1);

  await remove.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Holiday', { exact: true })).toHaveCount(0);
  expect(sent.count).toBe(2);
  expect(await api.call('GET', '/goals')).toHaveLength(0);
});

test('a slow deletion says it is working and is only sent once', async ({ page, api }) => {
  // On a phone, where each payee has an Actions menu and the dialog is a bottom sheet
  await page.setViewportSize({ width: 390, height: 844 });
  await api.call('POST', '/payees', { name: 'Corner Cafe' });
  const sent = await intercept(page, '**/api/payees/*', 'DELETE', { delayMs: 800 });
  await open(page, '/payees');
  await page.getByRole('button', { name: 'Actions for Corner Cafe' }).first().click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete payee' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  const busy = dialog.getByRole('button', { name: 'Deleting…' });
  await expect(busy).toBeDisabled();
  // Pressing again, or Escape, while it runs changes nothing
  await busy.dispatchEvent('click');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await expect(dialog).toBeHidden();
  expect(sent.count).toBe(1);
  expect(
    (await api.call<{ name: string }[]>('GET', '/payees')).some((p) => p.name === 'Corner Cafe'),
  ).toBe(false);
});

test('a refused report save keeps the dialog and its name, and retrying saves once', async ({
  page,
  api,
}) => {
  await api.createAccount('Checking', 100_000);
  const sent = await intercept(page, '**/api/custom-reports', 'POST', { refuse: true });
  await open(page, '/reports/custom');
  await page.getByRole('button', { name: 'Save' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save report' });
  const name = dialog.getByRole('textbox', { name: 'Report name' });
  await name.fill('Monthly spending');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('The server refused this for the test.');
  await expect(name).toHaveValue('Monthly spending');
  expect(await api.call('GET', '/custom-reports')).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Monthly spending' })).toBeVisible();
  expect(sent.count).toBe(2);
  expect(await api.call('GET', '/custom-reports')).toHaveLength(1);
});
