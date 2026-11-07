import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// UX audit AU-010: Recurring's views were plain buttons with an underline, and Settings'
// sections were buttons marked as the current page, while Forecast, Tax and Transactions were
// real tab lists. All now announce the open tab, move with the arrow keys, Home and End,
// and label their content with the tab it belongs to.

/** The open panel is labelled by the selected tab */
async function expectPanelOf(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel', { name, exact: true });
  await expect(panel).toBeVisible();
  await expect(tab).toHaveAttribute('aria-controls', (await panel.getAttribute('id'))!);
}

for (const phone of [false, true]) {
  const where = phone ? ' on a phone' : '';

  test(`Recurring's views are a tab list${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await open(page, '/recurring');
    const list = page.getByRole('tablist', { name: 'Recurring view' });
    await expect(list.getByRole('tab')).toHaveCount(2);
    await expectPanelOf(page, 'Monthly');

    await list.getByRole('tab', { name: 'Monthly' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(list.getByRole('tab', { name: 'All recurring' })).toBeFocused();
    await expectPanelOf(page, 'All recurring');
    await page.keyboard.press('Home');
    await expectPanelOf(page, 'Monthly');
    await page.keyboard.press('End');
    await expectPanelOf(page, 'All recurring');
    // Only the open tab is a Tab stop: Tab leaves the list
    await page.keyboard.press('Tab');
    await expect(list.getByRole('tab', { name: 'Monthly' })).not.toBeFocused();
    await expect(list.getByRole('tab', { name: 'All recurring' })).not.toBeFocused();
  });

  test(`Settings sections are a tab list that keeps its address${where}`, async ({ page, api }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Everyday', 100_000);
    await open(page, '/settings?tab=preferences');
    const list = page.getByRole('tablist', { name: 'Settings sections' });
    await expectPanelOf(page, 'Preferences');

    await list.getByRole('tab', { name: 'Preferences' }).focus();
    await page.keyboard.press('ArrowLeft');
    const before = list.getByRole('tab', { selected: true });
    await expect(before).toBeFocused();
    await expect(before).not.toHaveText('Preferences');
    await expect(page).not.toHaveURL(/tab=preferences/);
    await page.keyboard.press('ArrowRight');
    await expectPanelOf(page, 'Preferences');
    await expect(page).toHaveURL(/tab=preferences/);
  });
}

test('Forecast labels its content with the open tab', async ({ page, api }) => {
  await api.createAccount('Everyday', 100_000);
  await open(page, '/forecast?tab=cash');
  await expectPanelOf(page, 'Cash runway');
});
