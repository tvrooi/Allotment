import { test, expect, type Locator, type Page } from '@playwright/test';
import { tokenColour } from '../fixtures';
import {
  clearFocus,
  expectScreenshot,
  openGallery,
  PIXELS,
  specimen,
  tabTo,
  type GalleryTheme,
} from './gallery';

// The shared controls as a set in the controls gallery (#267, WAVG-03 and WAVG-04): the keyboard
// reaches every control's Focus specimen with Tab and finds a focus mark on it, the cards are
// visited in page order, and each focused specimen is pictured in light and dark. Every test
// opens its own page at its own size and theme, so each passes alone.

/** The browser's clock is pinned, so "today" in any picker is the gallery's own day */
const TODAY = new Date('2026-11-16T12:00:00');

type Mark = 'ring' | 'outline';

/**
 * The eleven shared controls and MonthRangePicker (D-11), with the element in its Focus
 * specimen that takes keyboard focus. Label and Field are reached through the field they label.
 * Fields and triggers show a brand ring (box-shadow); toggles a brand outline on the indicator.
 */
const CONTROLS: { control: string; mark: Mark; target: (row: Locator) => Locator }[] = [
  { control: 'Label', mark: 'ring', target: (row) => row.getByRole('textbox') },
  { control: 'Field', mark: 'ring', target: (row) => row.getByRole('textbox') },
  { control: 'Input', mark: 'ring', target: (row) => row.getByRole('textbox') },
  { control: 'Textarea', mark: 'ring', target: (row) => row.getByRole('textbox') },
  { control: 'Select', mark: 'ring', target: (row) => row.getByRole('button') },
  { control: 'Combobox', mark: 'ring', target: (row) => row.getByRole('combobox') },
  { control: 'DatePicker', mark: 'ring', target: (row) => row.getByRole('spinbutton').first() },
  { control: 'MonthPicker', mark: 'ring', target: (row) => row.getByRole('button').first() },
  { control: 'MonthRangePicker', mark: 'ring', target: (row) => row.getByRole('button').first() },
  { control: 'Checkbox', mark: 'outline', target: (row) => row.getByRole('checkbox') },
  { control: 'RadioGroup', mark: 'outline', target: (row) => row.getByRole('radio').first() },
  { control: 'Switch', mark: 'outline', target: (row) => row.getByRole('switch') },
];

/**
 * What the focused element looks like: for a field or trigger, the box-shadow and outline style
 * of the nearest element from it up to its specimen that draws a ring in `brand`; for a toggle,
 * the outline of the visible indicator inside its label.
 */
const focusMark = (page: Page, mark: Mark, brand: string) =>
  page.evaluate(
    ({ mark, brand }) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      if (mark === 'ring') {
        const stop = active.closest('[role="group"][aria-label]');
        for (let el: HTMLElement | null = active; el; el = el.parentElement) {
          const style = getComputedStyle(el);
          if (style.boxShadow.includes(brand))
            return {
              boxShadow: style.boxShadow,
              outlineStyle: style.outlineStyle,
              focusedOutline: getComputedStyle(active).outlineStyle,
            };
          if (el === stop) break;
        }
        return null;
      }
      const indicator = active.closest('label')?.querySelector('span[aria-hidden="true"]');
      if (!indicator) return null;
      const style = getComputedStyle(indicator);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    },
    { mark, brand },
  );

/** Opens the gallery and Tabs from the top of the page to the control's Focus specimen */
async function focusSpecimen(
  page: Page,
  { control, target }: (typeof CONTROLS)[number],
  theme: GalleryTheme = 'light',
) {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page, { theme, width: 1280 });
  await clearFocus(page);
  const element = target(specimen(page, control, 'Focus'));
  await tabTo(page, element);
  await expect(element).toBeFocused();
  return element;
}

for (const entry of CONTROLS)
  test(`Tab reaches the ${entry.control} Focus specimen and shows its focus mark`, async ({
    page,
  }) => {
    await focusSpecimen(page, entry);
    const brand = await tokenColour(page, '--color-brand-600', 'color');
    // Polled: a toggle's indicator and a field's border ease into their focused colours
    if (entry.mark === 'ring') {
      await expect
        .poll(() => focusMark(page, 'ring', brand))
        .toMatchObject({ outlineStyle: 'none', focusedOutline: 'none' });
    } else {
      await expect
        .poll(() => focusMark(page, 'outline', brand))
        .toEqual({ outlineStyle: 'solid', outlineWidth: '2px', outlineColor: brand });
    }
  });

test('Tab visits the gallery cards in page order', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page);
  await clearFocus(page);
  // The card each Tab stop is in, as its position among the page's cards (-1 outside one)
  const cardOf = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll('main section[aria-labelledby]')];
      const card = document.activeElement?.closest('main section[aria-labelledby]');
      return card ? cards.indexOf(card) : -1;
    });
  const total = await page.locator('main section[aria-labelledby]').count();
  const visited: number[] = [];
  for (let presses = 0; presses < 600; presses++) {
    await page.keyboard.press('Tab');
    const card = await cardOf();
    if (card === -1 && visited.length) break;
    if (card !== -1 && visited[visited.length - 1] !== card) visited.push(card);
  }
  // Each card once, in order, and every card that has a control (all of them) is reached
  expect(visited).toEqual([...Array(total).keys()]);
});

for (const theme of ['light', 'dark'] as const)
  for (const entry of CONTROLS)
    test(`the keyboard-focused ${entry.control} specimen matches its baseline (${theme})`, async ({
      page,
    }) => {
      test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
      await focusSpecimen(page, entry, theme);
      const row = specimen(page, entry.control, 'Focus');
      const box = (await row.boundingBox())!;
      // 8 px around the row, so a toggle's outline (2 px, offset 2 px) is inside the picture
      await expectScreenshot(page, `focus-${entry.control.toLowerCase()}-${theme}`, {
        clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
      });
    });

/**
 * A clock far from the gallery's pinned day. The full-page pictures run on it, so a specimen that
 * read today's date instead of its pinned value would show it and fail both checks below.
 */
const ELSEWHEN = new Date('2031-03-05T12:00:00');

for (const width of [1280, 390] as const)
  for (const theme of ['light', 'dark'] as const)
    test(`the whole gallery matches its baseline at ${width} px (${theme})`, async ({ page }) => {
      await page.clock.setFixedTime(ELSEWHEN);
      await openGallery(page, { theme, width });
      // Every platform: nothing shows the clock's date, and the page does not scroll sideways
      const text = await page.locator('main').innerText();
      for (const shown of ['2031', '05/03', '5 Mar']) expect(text).not.toContain(shown);
      expect(text).toContain('16 Nov 2026');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
      await expectScreenshot(page, `gallery-${width}-${theme}`, { fullPage: true });
    });
