import { test, expect } from '@playwright/test';
import { openGallery, specimen } from './gallery';

// The gallery itself: it opens in its own build, switches theme, and fits a phone.

test('the gallery opens with its heading', async ({ page }) => {
  await openGallery(page);
  await expect(page.getByRole('region', { name: 'Switch' })).toBeVisible();
});

test('the theme button switches the theme and says what it will do next', async ({ page }) => {
  await openGallery(page);
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  const toLight = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(toLight).toBeVisible();

  await toLight.click();
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('the gallery has no sideways scroll on a phone', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test('the Switch card shows a disabled switch', async ({ page }) => {
  await openGallery(page);
  const disabled = specimen(page, 'Switch', 'Disabled').getByRole('switch');
  await expect(disabled).not.toHaveCount(0);
  for (const control of await disabled.all()) await expect(control).toBeDisabled();
  await expect(specimen(page, 'Switch', 'Default').getByRole('switch')).toBeEnabled();
});
