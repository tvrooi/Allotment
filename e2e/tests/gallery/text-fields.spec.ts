import { test, expect, type Locator, type Page } from '@playwright/test';
import { openGallery, specimen, type GalleryTheme, type GalleryWidth } from './gallery';

// The shared Label, Field, Input and Textarea in the controls gallery: the invalid path end to end, the
// keyboard, phone sizes and the placeholder's contrast token (#267).

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

const placeholderColour = (field: Locator) =>
  field.evaluate((el) => getComputedStyle(el, '::placeholder').color);

/** The text of each visible <label> in `scope` that points at no field (accessibility.spec.ts) */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !(el as HTMLLabelElement).control)
      .map((el) => el.textContent?.trim()),
  );

const CARDS = ['Label', 'Field', 'Input', 'Textarea'] as const;
const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test('an invalid Input inside a Field is marked, bordered and described by its error', async ({
  page,
}) => {
  await openGallery(page);
  const negative = await tokenColour(page, '--color-negative');
  for (const control of ['Field', 'Input']) {
    const row = specimen(page, control, 'Invalid');
    const field = row.getByRole('textbox');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveCSS('border-top-color', negative);
    const describedBy = (await field.getAttribute('aria-describedby'))?.split(' ') ?? [];
    const error = row.locator('.text-negative').last();
    await expect(error).toBeVisible();
    expect(describedBy).toContain(await error.getAttribute('id'));
    await expect(field).toHaveAccessibleDescription(new RegExp((await error.textContent())!));
  }

  // Focused, the invalid field keeps the negative colour for its ring
  const invalid = specimen(page, 'Field', 'Invalid').getByRole('textbox');
  await invalid.focus();
  await expect(invalid).toHaveCSS('box-shadow', new RegExp(negative.replace(/[()]/g, '\\$&')));
});

test('a required, empty Field shows the default line in the negative colour', async ({ page }) => {
  await openGallery(page);
  const row = specimen(page, 'Field', 'Required');
  const field = row.getByRole('textbox');
  await expect(field).toHaveValue('');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const error = row.getByText(/^Enter .+ to continue$/);
  await expect(error).toBeVisible();
  await expect(error).toHaveCSS('color', await tokenColour(page, '--color-negative'));
  expect((await field.getAttribute('aria-describedby'))?.split(' ')).toContain(
    await error.getAttribute('id'),
  );
  await expect(field).toHaveAccessibleDescription(/^Enter .+ to continue$/);
});

test('the Field names its control, and help text appears only when given', async ({ page }) => {
  await openGallery(page);
  await expect(
    specimen(page, 'Field', 'Default').getByRole('textbox', { name: 'Payee' }),
  ).toBeVisible();
  // No description: nothing under the field, so no gap is left for one
  await expect(specimen(page, 'Field', 'Default').locator('[slot="description"]')).toHaveCount(0);
  const help = specimen(page, 'Field', 'Help text');
  await expect(help.getByRole('textbox')).toHaveAccessibleDescription(/statement/);
});

test('long labels and errors wrap, and a long value scrolls inside its box', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const row = specimen(page, 'Field', 'Long text');
  const field = row.getByRole('textbox');
  const box = (await field.boundingBox())!;
  for (const text of [row.locator('label'), row.locator('.text-negative')]) {
    const part = (await text.boundingBox())!;
    expect(part.width).toBeLessThanOrEqual(box.width + 1);
    // More than one line: the text wrapped instead of being cut off
    expect(part.height).toBeGreaterThan(24);
  }
  expect(await field.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // Nothing scrolls sideways at phone width
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Tab reaches the focus specimen with a ring and no outline, skips disabled, stops on read-only', async ({
  page,
}) => {
  await openGallery(page);
  const brand = await tokenColour(page, '--color-brand-600');
  await specimen(page, 'Input', 'Default').getByRole('textbox').focus();
  await page.keyboard.press('Tab');
  const focus = specimen(page, 'Input', 'Focus').getByRole('textbox');
  await expect(focus).toBeFocused();
  await expect(focus).toHaveCSS('outline-style', 'none');
  await expect(focus).toHaveCSS('box-shadow', new RegExp(brand.replace(/[()]/g, '\\$&')));
  await expect(focus).toHaveCSS('border-top-color', brand);

  await page.keyboard.press('Tab');
  await expect(specimen(page, 'Input', 'Invalid').getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Tab');
  const readOnly = specimen(page, 'Input', 'Read-only').getByRole('textbox');
  await expect(readOnly).toBeFocused();
  const before = await readOnly.inputValue();
  await page.keyboard.type('more');
  await expect(readOnly).toHaveValue(before);
});

test('disabled fields cannot be used and look disabled without dimming', async ({ page }) => {
  await openGallery(page);
  const surfaceAlt = await tokenColour(page, '--color-surface-alt');
  const disabledText = await tokenColour(page, '--color-text-disabled');
  for (const control of CARDS) {
    const field = specimen(page, control, 'Disabled').getByRole('textbox');
    await expect(field).toBeDisabled();
    await expect(field).toHaveCSS('background-color', surfaceAlt);
    await expect(field).toHaveCSS('color', disabledText);
    await expect(field).toHaveCSS('cursor', 'not-allowed');
    await expect(field).toHaveCSS('opacity', '1');
  }
  // Read-only keeps full-contrast text
  const text = await tokenColour(page, '--color-text');
  await expect(specimen(page, 'Field', 'Read-only').getByRole('textbox')).toHaveCSS('color', text);
});

test('clearing an Input leaves an empty string, never null', async ({ page }) => {
  await openGallery(page);
  const field = specimen(page, 'Input', 'Default').getByRole('textbox');
  await field.fill('');
  await expect(field).toHaveValue('');
  expect(await field.evaluate((el) => (el as HTMLInputElement).value)).toBe('');
});

test('the Textarea is at least 80 px tall and looks like Input in every state', async ({
  page,
}) => {
  await openGallery(page);
  const box = (await specimen(page, 'Textarea', 'Default').getByRole('textbox').boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(80);
  const looks = (control: string, state: string) =>
    specimen(page, control, state)
      .getByRole('textbox')
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return [
          style.backgroundColor,
          style.borderTopColor,
          style.borderRadius,
          style.color,
          style.cursor,
        ];
      });
  for (const state of ['Default', 'Disabled', 'Invalid', 'Read-only'])
    expect(await looks('Textarea', state), state).toEqual(await looks('Input', state));

  // Focused, it takes the same brand border and ring as Input
  const brand = await tokenColour(page, '--color-brand-600');
  const focus = specimen(page, 'Textarea', 'Focus').getByRole('textbox');
  await focus.focus();
  await expect(focus).toHaveCSS('outline-style', 'none');
  await expect(focus).toHaveCSS('border-top-color', brand);
  await expect(focus).toHaveCSS('box-shadow', new RegExp(brand.replace(/[()]/g, '\\$&')));
  await expect(focus).toHaveCSS('resize', 'vertical');

  const invalid = specimen(page, 'Textarea', 'Invalid');
  await expect(invalid.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  await expect(invalid.getByRole('textbox')).toHaveAccessibleDescription(
    (await invalid.locator('.text-negative').textContent())!,
  );
});

test('a long Textarea value wraps and scrolls inside its box on a phone', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const field = specimen(page, 'Textarea', 'Long text').getByRole('textbox');
  await expect(field).toHaveCSS('font-size', '16px');
  expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const size = await field.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  // Wrapped onto more lines than fit, so it scrolls down, never sideways
  expect(size.scrollHeight).toBeGreaterThan(size.clientHeight);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('clearing a Textarea leaves an empty string, never null', async ({ page }) => {
  await openGallery(page);
  const field = specimen(page, 'Textarea', 'Default').getByRole('textbox');
  await field.fill('Paid back on Friday');
  await field.fill('');
  await expect(field).toHaveValue('');
  expect(await field.evaluate((el) => (el as HTMLTextAreaElement).value)).toBe('');
});

for (const width of [1280, 390] as GalleryWidth[])
  for (const theme of ['light', 'dark'] as GalleryTheme[])
    test(`the text-field cards hold together at ${width} px in the ${theme} theme`, async ({
      page,
    }) => {
      await openGallery(page, { width, theme });
      const tertiary = await tokenColour(page, '--color-text-tertiary');
      for (const name of CARDS) {
        const region = card(page, name);
        expect(await strayLabels(region)).toEqual([]);
        const fields = region.getByRole('textbox');
        expect(await fields.count()).toBeGreaterThanOrEqual(5);
        for (const field of await fields.all()) {
          if (await field.getAttribute('placeholder'))
            expect(await placeholderColour(field)).toBe(tertiary);
          if (width === 390) {
            const box = (await field.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(44);
            await expect(field).toHaveCSS('font-size', '16px');
          }
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });

for (const theme of ['light', 'dark'] as GalleryTheme[])
  test(`the amount field's placeholder uses the tertiary text colour in the ${theme} theme`, async ({
    page,
  }) => {
    await openGallery(page, { theme });
    const empty = specimen(page, 'CurrencyInput', 'Empty').getByRole('textbox');
    await expect(empty).toHaveAttribute('placeholder', /\S/);
    await expect(empty).toHaveAttribute('inputmode', 'decimal');
    expect(await placeholderColour(empty)).toBe(await tokenColour(page, '--color-text-tertiary'));
    await expect(specimen(page, 'CurrencyInput', 'Filled').getByRole('textbox')).not.toHaveValue(
      '',
    );
  });
