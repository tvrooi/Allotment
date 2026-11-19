import { test, expect, type Locator, type Page } from '@playwright/test';
import { expectScreenshot, openGallery, PIXELS, specimen, type GalleryWidth } from './gallery';

// The shared Switch in the controls gallery: keyboard, target size and the disabled look (#264).

/** A token's computed colour, drawn by the page itself, so tests never hard-code a hex value */
const tokenColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);

/** The visible track of each switch in a row (the hidden input sits beside it) */
const tracks = (row: Locator) => row.locator('label > span[aria-hidden="true"]');

test('the keyboard reaches the switch, shows its ring and toggles it with Space', async ({
  page,
}) => {
  await openGallery(page);
  const focus = specimen(page, 'Switch', 'Focus').getByRole('switch');
  await specimen(page, 'Switch', 'Default').getByRole('switch').focus();
  await page.keyboard.press('Tab');
  await expect(focus).toBeFocused();

  // toHaveCSS waits out the track's colour transition rather than reading a mid-way colour
  const ring = tracks(specimen(page, 'Switch', 'Focus')).first();
  await expect(ring).toHaveCSS('outline-width', '2px');
  await expect(ring).toHaveCSS('outline-style', 'solid');
  await expect(ring).toHaveCSS('outline-color', await tokenColour(page, '--color-brand-600'));

  await expect(focus).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(focus).toBeChecked();

  // Tab skips both disabled switches and goes on to the invalid one
  await page.keyboard.press('Tab');
  await expect(specimen(page, 'Switch', 'Invalid').getByRole('switch')).toBeFocused();

  // A read-only switch takes focus but Space does not change it
  await page.keyboard.press('Tab');
  const readOnly = specimen(page, 'Switch', 'Read-only').getByRole('switch').first();
  await expect(readOnly).toBeFocused();
  const before = await readOnly.isChecked();
  await page.keyboard.press('Space');
  expect(await readOnly.isChecked()).toBe(before);
});

test('the disabled switches cannot be used', async ({ page }) => {
  await openGallery(page);
  const disabled = specimen(page, 'Switch', 'Disabled').getByRole('switch');
  await expect(disabled).toHaveCount(2);
  for (const control of await disabled.all()) await expect(control).toBeDisabled();
  await expect(disabled.nth(0)).not.toBeChecked();
  await expect(disabled.nth(1)).toBeChecked();
});

for (const width of [1280, 390] as GalleryWidth[])
  test(`every switch has a 44 px hit area at ${width} px`, async ({ page }) => {
    await openGallery(page, { width });
    const targets = page.getByRole('region', { name: 'Switch' }).locator('label');
    expect(await targets.count()).toBeGreaterThanOrEqual(5);
    for (const target of await targets.all()) {
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

test('a disabled switch in the dark theme has the surface-alt track (#264)', async ({ page }) => {
  await openGallery(page, { theme: 'dark' });
  const surfaceAlt = await tokenColour(page, '--color-surface-alt');
  const brand = await tokenColour(page, '--color-brand-600');
  const row = tracks(specimen(page, 'Switch', 'Disabled'));
  await expect(row).toHaveCount(2);
  expect(surfaceAlt).not.toBe(brand);
  // toHaveCSS waits out the colour transition the theme change starts
  for (const track of await row.all())
    await expect(track).toHaveCSS('background-color', surfaceAlt);
});

for (const theme of ['light', 'dark'] as const)
  test(`an invalid required switch is described by its default line (${theme})`, async ({
    page,
  }) => {
    await openGallery(page, { theme });
    const row = specimen(page, 'Switch', 'Invalid');
    const control = row.getByRole('switch');
    await expect(control).toHaveAttribute('aria-invalid', 'true');
    await expect(control).toHaveAttribute('required', '');
    await expect(control).toHaveAccessibleDescription(/^Turn on .+ to continue$/);
    const line = row.getByText(/^Turn on .+ to continue$/);
    await expect(line).toHaveCSS('color', await tokenColour(page, '--color-negative'));

    // Turning it on clears the error, and the line leaves no gap behind
    await row.locator('label').click();
    await expect(control).toBeChecked();
    await expect(line).toHaveCount(0);
  });

test('help text and an errorLabel line describe their switches', async ({ page }) => {
  await openGallery(page);
  await expect(
    specimen(page, 'Switch', 'Help text').getByRole('switch'),
  ).toHaveAccessibleDescription('Transactions arrive within the hour');
  await expect(
    specimen(page, 'Switch', 'Error label').getByRole('switch'),
  ).toHaveAccessibleDescription('Turn on Up sync to continue');
});

for (const theme of ['light', 'dark'] as const)
  test(`the Switch card matches its baseline in the ${theme} theme`, async ({ page }) => {
    test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
    await openGallery(page, { theme, width: 1280 });
    await expectScreenshot(page.getByRole('region', { name: 'Switch' }), `switch-card-${theme}`);
  });
