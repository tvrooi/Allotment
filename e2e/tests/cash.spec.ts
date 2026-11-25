import { test, expect, open } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';
import { typeAmount } from './fixtures';

async function addCoffee(dialog: import('@playwright/test').Locator) {
  await typeAmount(dialog.getByLabel('Amount', { exact: true }), '14.50');
  await dialog.getByPlaceholder('Search payees...').fill('Corner cafe');
  await dialog.getByRole('button', { name: /Create new payee/ }).click();
}

test('a cash purchase goes to a new Cash account, not the linked bank account', async ({
  page,
  api,
}) => {
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
  await freshUpWindow(page, api, 6);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  const before = await api.accounts();
  const bank = before.find((a: any) => a.bankLinked)!;
  expect(bank).toBeTruthy();
  expect(before.some((a) => a.name === 'Cash')).toBe(false);

  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await addCoffee(dialog);
  await dialog.getByRole('combobox', { name: 'Account' }).click();
  // No Cash account yet: the picker offers to make one
  await expect(dialog.getByRole('button', { name: 'Cash (create)' })).toBeVisible();
  await dialog.getByRole('option', { name: new RegExp(bank.name) }).click();
  await expect(dialog.getByRole('status')).toContainText(
    `${bank.name} is linked to your bank. A transaction added by hand will make it disagree`,
  );

  // One tap switches to Cash, creating it
  await dialog.getByRole('button', { name: 'Use a new Cash account instead' }).click();
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue('Cash');
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();

  const after = await api.accounts();
  const cash = after.find((a) => a.name === 'Cash')!;
  expect(cash).toBeTruthy();
  expect(cash.balance).toBe(-1_450);
  expect(after.find((a) => a.id === bank.id)!.balance).toBe(bank.balance);
  await api.call('DELETE', '/up/connection');
});

test('Cash (create) in the account picker makes the Cash account, and later purchases reuse it', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 50_000);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await addCoffee(dialog);
  await dialog.getByRole('combobox', { name: 'Account' }).click();
  await dialog.getByRole('button', { name: 'Cash (create)' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Account' })).toHaveValue('Cash');
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();
  const cash = (await api.accounts()).find((a) => a.name === 'Cash')!;
  expect(cash.balance).toBe(-1_450);

  // With a Cash account there is nothing to create, and a manual account shows no warning.
  // The dialog now starts on the account used last (Cash), so the picker shows that.
  await open(page, '/transactions?add=1');
  const again = page.getByRole('dialog', { name: 'Add transaction' });
  const account = again.getByRole('combobox', { name: 'Account' });
  await expect(account).toHaveValue('Cash');
  await account.click();
  await expect(again.getByRole('option', { name: /Cash/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cash (create)' })).toHaveCount(0);
  await again.getByRole('option', { name: /Everyday/ }).click();
  await expect(account).toHaveValue('Everyday');
  await expect(again.getByRole('status')).toHaveCount(0);
});

// Between the Cash account being made and the account list reloading, the dialog still holds the
// previous account: it must not save there, and Cash (create) must not make a second one (03-12 review WR-01)
test('while the new Cash account loads, nothing can be added or created twice', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday', 50_000);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await addCoffee(dialog);
  const account = dialog.getByRole('combobox', { name: 'Account' });
  await account.click();
  await dialog.getByRole('option', { name: /Everyday/ }).click();
  await expect(account).toHaveValue('Everyday');
  // The list opens on focus, so leave the field before opening it again
  await dialog.getByLabel('Amount', { exact: true }).click();

  // Hold the account list's reload once the Cash account has been made
  let created = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/accounts(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') created = true;
    else if (method === 'GET' && created) await held;
    await route.continue();
  });

  await account.click();
  const createCash = dialog.getByRole('button', { name: 'Cash (create)' });
  await createCash.click();
  await expect.poll(() => created).toBe(true);
  // The open list hides the rest of the dialog from the accessibility tree, so look past that
  const add = dialog.getByRole('button', { name: 'Add transaction', includeHidden: true });
  await expect(add).toBeDisabled();
  await expect(createCash).toBeDisabled();

  release();
  await expect(account).toHaveValue('Cash');
  await expect(dialog.getByRole('button', { name: 'Add transaction' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();
  const accounts = await api.accounts();
  expect(accounts.filter((a) => a.name === 'Cash')).toHaveLength(1);
  expect(accounts.find((a) => a.name === 'Cash')!.balance).toBe(-1_450);
  expect(accounts.find((a) => a.name === 'Everyday')!.balance).toBe(50_000);
});

for (const [label, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`adding from a linked account's own page warns and moves the entry to Cash (${label})`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(viewport);
    await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/normal`, { method: 'POST' });
    await freshUpWindow(page, api, 6);
    await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
    await api.call('POST', '/up/map-accounts', {
      mappings: [
        { upAccountId: 'spending', action: 'create' },
        { upAccountId: 'saver', action: 'create' },
      ],
    });
    const bank = (await api.accounts()).find((a: any) => a.bankLinked)!;
    expect((await api.accounts()).some((a) => a.name === 'Cash')).toBe(false);

    await open(page, `/accounts/${bank.id}?add=1`);
    const form = page.getByRole('status').filter({ hasText: 'is linked to your bank' });
    await expect(form).toContainText(`${bank.name} is linked to your bank`);
    await form.getByRole('button', { name: 'Use a new Cash account instead' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Adding to Cash' })).toBeVisible();
    const scope = viewport.width < 600 ? page.getByRole('dialog') : page;
    await typeAmount(scope.getByLabel('Outflow').first(), '14.50');
    await scope.getByRole('button', { name: /^Save/ }).first().click();
    await expect
      .poll(async () => (await api.accounts()).find((a) => a.name === 'Cash')?.balance)
      .toBe(-1_450);
    expect((await api.accounts()).find((a) => a.id === bank.id)!.balance).toBe(bank.balance);
    await api.call('DELETE', '/up/connection');
  });
}
