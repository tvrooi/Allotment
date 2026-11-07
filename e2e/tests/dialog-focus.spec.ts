import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// UX audit AU-001: Tab used to leave an open dialog for the page behind it, and closing one
// left focus nowhere. Dialogs (ui/Modal) now keep focus, make the page inert, close only the
// one on top with Escape, and give focus back to whatever opened them.

/** Whether focus is inside the open dialog whose text includes `text` */
const focusInside = (page: Page, text: string) =>
  page.evaluate(
    (t) =>
      [...document.querySelectorAll('[role="dialog"]')]
        .filter((d) => d.textContent?.includes(t))
        .some((d) => d.contains(document.activeElement)),
    text,
  );

for (const phone of [false, true]) {
  const where = phone ? ' on a phone' : '';

  test(`Tab stays in a dialog and Escape gives focus back${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await open(page, '/goals');
    const add = page.getByRole('button', { name: 'Add goal' }).first();
    await add.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Add goal' });
    await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
    // The page behind can't be reached while it's open
    await expect(page.locator('#root')).toHaveJSProperty('inert', true);

    // Far more presses than the form has controls: focus never leaves it, either way
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, 'Progress source'), `Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInside(page, 'Progress source'), `Shift+Tab ${i + 1}`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
    await expect(page.locator('#root')).toHaveJSProperty('inert', false);
  });

  test(`Escape closes only the dialog on top${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    // Only an account at zero can be closed
    const account = await api.createAccount('Old savings', 0);
    await open(page, `/accounts/${account.id}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit account' });
    const closeAccount = edit.getByRole('button', { name: 'Close account' });
    await closeAccount.focus();
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('dialog', { name: 'Close account' });
    await expect(confirm).toBeVisible();
    // The edit dialog underneath can't be reached while the confirmation is open
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusInside(page, 'Are you sure')).toBe(true);

    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(edit).toBeVisible();
    await expect(closeAccount).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(edit).toBeHidden();
    // Escape cancelled the confirmation: the account is still open
    const accounts = await api.call<{ id: string; closedAt: string | null }[]>('GET', '/accounts');
    expect(accounts.find((a) => a.id === account.id)?.closedAt).toBeNull();
  });

  test(`a dialog from a row menu returns focus to that menu${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
    await api.call('POST', '/goals', { name: 'Car', targetAmount: 900_000 });
    await open(page, '/goals');
    const actions = page.getByRole('button', { name: 'Actions' }).first();
    await actions.click();
    await page.getByRole('menuitem', { name: 'Edit goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit goal' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(actions).toBeFocused();
  });
}
