import { expect, type Locator, type Page } from '@playwright/test';

// Helpers for the gallery project (the development-only controls gallery, served from its own
// build on GALLERY_PORT). The gallery has no server or budget, so these use Playwright's own
// `test`, not the desktop suite's fixtures.

export type GalleryTheme = 'light' | 'dark';
/**
 * The widths the gallery is checked at: a desktop window, a phone (iPhone 13/14), and the two
 * sides of the 768 px line where the date pickers turn native (E-03)
 */
export type GalleryWidth = 1280 | 390 | 767 | 768;

const HEIGHT: Record<GalleryWidth, number> = { 1280: 800, 390: 844, 767: 800, 768: 800 };

/**
 * Opens the gallery at the given width and theme. Every test calls it, so no test depends on
 * the viewport or theme another one left.
 */
export async function openGallery(
  page: Page,
  { theme = 'light', width = 1280 }: { theme?: GalleryTheme; width?: GalleryWidth } = {},
) {
  await page.setViewportSize({ width, height: HEIGHT[width] });
  // A fresh page follows the device's theme: pin it light, then switch when dark is asked for
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/controls');
  await expect(page.getByRole('heading', { level: 1, name: 'Controls gallery' })).toBeVisible();
  const toDark = page.getByRole('button', { name: 'Switch to dark theme' });
  await expect(toDark).toBeVisible();
  if (theme === 'dark') {
    await toDark.click();
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** One specimen row: the group named "<Control>, <State>", for example "Switch, Disabled" */
export function specimen(page: Page, control: string, state: string) {
  return page.getByRole('group', { name: `${control}, ${state}`, exact: true });
}

/**
 * Whether this run compares screenshots. The committed baselines are Linux images (CI's
 * platform) and macOS draws type differently, so pixel tests run on Linux only: in CI, and on a
 * Mac through e2e/gallery-baselines.sh. Every functional gallery test runs everywhere.
 */
export const PIXELS = process.platform === 'linux';

/** A page region, in CSS pixels from the viewport's top left */
export type Region = { x: number; y: number; width: number; height: number };

/**
 * Compares one part of the gallery, or the page, with its committed baseline, once the fonts
 * have loaded. `clip` takes a region of the page (a trigger with its portaled popover);
 * `fullPage` the whole scrolling page. No tolerance: a changed pixel fails.
 */
export async function expectScreenshot(
  target: Locator | Page,
  name: string,
  options: { clip?: Region; fullPage?: boolean } = {},
) {
  const page = 'page' in target ? target.page() : target;
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  if ('page' in target) await expect(target).toHaveScreenshot(`${name}.png`);
  else await expect(target).toHaveScreenshot(`${name}.png`, options);
}

/**
 * Presses Tab until `target` has keyboard focus, failing after `limit` presses. Real key
 * presses only: the gallery has no way to fake a focused look. The element is held once, so a
 * list that hides the rest of the page while open does not hide the target from the search.
 */
export async function tabTo(page: Page, target: Locator, limit = 400) {
  const element = await target.elementHandle();
  if (!element) throw new Error('tabTo: the target is not on the page');
  for (let presses = 0; presses < limit; presses++) {
    if (await element.evaluate((el) => el === document.activeElement)) return presses;
    await page.keyboard.press('Tab');
  }
  if (await element.evaluate((el) => el === document.activeElement)) return limit;
  throw new Error(`tabTo: not reached within ${limit} Tab presses`);
}

/**
 * Drops any pointer focus and starts the keyboard from the page's heading, so the next Tab
 * lands on the first control after it, as it does for a keyboard user arriving on the page
 */
export async function clearFocus(page: Page) {
  // A click on plain text moves the browser's Tab starting point there and focuses nothing
  await page.getByRole('heading', { level: 1, name: 'Controls gallery' }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
}
