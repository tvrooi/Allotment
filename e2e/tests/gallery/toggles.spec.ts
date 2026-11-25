import { test, expect, type Locator, type Page } from '@playwright/test';
import { openGallery, specimen, type GalleryTheme, type GalleryWidth } from './gallery';

// The shared Checkbox and RadioGroup in the controls gallery: keys, the focus ring, phone
// targets, a wrapping label and the invalid path end to end (#267).

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

/** The text of each visible <label> in `scope` that points at no field (accessibility.spec.ts) */
const strayLabels = (scope: Locator) =>
  scope.evaluate((root) =>
    [...root.querySelectorAll('label')]
      .filter((el) => el.getBoundingClientRect().width > 0 && !(el as HTMLLabelElement).control)
      .map((el) => el.textContent?.trim()),
  );

const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The visible indicator of each toggle in a row (the hidden input sits beside it) */
const indicators = (row: Locator) => row.locator('label > span[aria-hidden="true"]');

const SIZES: { width: GalleryWidth; theme: GalleryTheme }[] = [
  { width: 1280, theme: 'light' },
  { width: 1280, theme: 'dark' },
  { width: 390, theme: 'light' },
  { width: 390, theme: 'dark' },
];

test('the keyboard reaches a checkbox, shows its ring and toggles it with Space', async ({
  page,
}) => {
  await openGallery(page);
  const focus = specimen(page, 'Checkbox', 'Focus').getByRole('checkbox');
  await specimen(page, 'Checkbox', 'Default').getByRole('checkbox').focus();
  await page.keyboard.press('Tab');
  await expect(focus).toBeFocused();

  const ring = indicators(specimen(page, 'Checkbox', 'Focus')).first();
  await expect(ring).toHaveCSS('outline-width', '2px');
  await expect(ring).toHaveCSS('outline-style', 'solid');
  await expect(ring).toHaveCSS('outline-color', await tokenColour(page, '--color-brand-600'));

  await expect(focus).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(focus).toBeChecked();

  // Tab skips both disabled boxes and goes on to the invalid one
  await page.keyboard.press('Tab');
  await expect(specimen(page, 'Checkbox', 'Invalid').getByRole('checkbox')).toBeFocused();

  // A read-only box takes focus but Space does not change it
  await page.keyboard.press('Tab');
  const readOnly = specimen(page, 'Checkbox', 'Read-only').getByRole('checkbox').first();
  await expect(readOnly).toBeFocused();
  await page.keyboard.press('Space');
  await expect(readOnly).not.toBeChecked();
});

for (const { width, theme } of SIZES)
  test(`an invalid required checkbox is described by its default line (${width} px, ${theme})`, async ({
    page,
  }) => {
    await openGallery(page, { width, theme });
    const row = specimen(page, 'Checkbox', 'Invalid');
    const box = row.getByRole('checkbox');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(box).toHaveAttribute('required', '');
    await expect(box).toHaveAccessibleDescription(/^Turn on .+ to continue$/);
    const line = row.getByText(/^Turn on .+ to continue$/);
    await expect(line).toHaveCSS('color', await tokenColour(page, '--color-negative'));
    await expect(indicators(row)).not.toHaveCSS('box-shadow', 'none');

    // Ticking it clears the error; the line leaves no gap behind
    await row.locator('label').click();
    await expect(box).toBeChecked();
    await expect(line).toHaveCount(0);
  });

test('the help text describes its checkbox', async ({ page }) => {
  await openGallery(page);
  await expect(
    specimen(page, 'Checkbox', 'Help text').getByRole('checkbox'),
  ).toHaveAccessibleDescription('Rows you have reconciled stay as they are');
});

test('every checkbox is a 44 px target at 390 px, with or without a visible label', async ({
  page,
}) => {
  await openGallery(page, { width: 390 });
  const targets = card(page, 'Checkbox').locator('label');
  expect(await targets.count()).toBeGreaterThanOrEqual(9);
  for (const target of await targets.all()) {
    const box = (await target.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [1280, 390] as GalleryWidth[])
  test(`a long checkbox label wraps with the box level with its first line at ${width} px`, async ({
    page,
  }) => {
    await openGallery(page, { width });
    const row = specimen(page, 'Checkbox', 'Long label');
    const text = (await row.getByText(/^Count transfers/).boundingBox())!;
    const box = (await indicators(row).boundingBox())!;
    const lineHeight = await row
      .getByText(/^Count transfers/)
      .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(text.height).toBeGreaterThanOrEqual(lineHeight * 2);
    expect(box.y).toBeGreaterThanOrEqual(text.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(text.y + lineHeight + 1);
  });

test('an indeterminate checkbox is mixed until it is ticked', async ({ page }) => {
  await openGallery(page);
  const box = specimen(page, 'Checkbox', 'Indeterminate').getByRole('checkbox');
  await expect(box).toHaveJSProperty('indeterminate', true);
  await specimen(page, 'Checkbox', 'Indeterminate').locator('label').click();
  await expect(box).toHaveJSProperty('indeterminate', false);
  await expect(box).toBeChecked();
});

test('every label on the Checkbox card points at its box', async ({ page }) => {
  await openGallery(page);
  expect(await strayLabels(card(page, 'Checkbox'))).toEqual([]);
});

test('arrow keys move and select through a radio group in order, and Tab leaves it', async ({
  page,
}) => {
  await openGallery(page);
  const row = specimen(page, 'RadioGroup', 'Focus');
  const radios = row.getByRole('radio');
  await specimen(page, 'RadioGroup', 'Default').getByRole('radio', { checked: true }).focus();
  await page.keyboard.press('Tab');
  await expect(radios.nth(0)).toBeFocused();

  const ring = indicators(row).nth(0);
  await expect(ring).toHaveCSS('outline-width', '2px');
  await expect(ring).toHaveCSS('outline-style', 'solid');
  await expect(ring).toHaveCSS('outline-color', await tokenColour(page, '--color-brand-600'));

  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(2)).toBeFocused();
  await expect(radios.nth(2)).toBeChecked();
  await expect(radios.nth(0)).not.toBeChecked();

  // One Tab leaves the group, past the disabled one, for the invalid group
  await page.keyboard.press('Tab');
  await expect(specimen(page, 'RadioGroup', 'Invalid').getByRole('radio').first()).toBeFocused();
});

test('a read-only radio group takes focus but the arrow keys do not change it', async ({
  page,
}) => {
  await openGallery(page);
  const radios = specimen(page, 'RadioGroup', 'Read-only').getByRole('radio');
  await radios.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(0)).toBeChecked();
  await expect(radios.nth(1)).not.toBeChecked();
});

for (const { width, theme } of SIZES)
  test(`an invalid required radio group is described by its default line (${width} px, ${theme})`, async ({
    page,
  }) => {
    await openGallery(page, { width, theme });
    const row = specimen(page, 'RadioGroup', 'Invalid');
    const group = row.getByRole('radiogroup');
    await expect(group).toHaveAttribute('aria-invalid', 'true');
    await expect(group).toHaveAccessibleDescription(
      'How often the bill comes in Select Frequency to continue',
    );
    await expect(row.getByText(/^Select .+ to continue$/)).toHaveCSS(
      'color',
      await tokenColour(page, '--color-negative'),
    );
  });

test('every radio is a 44 px target at 390 px', async ({ page }) => {
  await openGallery(page, { width: 390 });
  const targets = card(page, 'RadioGroup').locator('label');
  expect(await targets.count()).toBeGreaterThanOrEqual(12);
  for (const target of await targets.all()) {
    const box = (await target.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('a horizontal radio group lays its options side by side', async ({ page }) => {
  await openGallery(page);
  const radios = specimen(page, 'RadioGroup', 'Horizontal').locator('label');
  const first = (await radios.nth(0).boundingBox())!;
  const second = (await radios.nth(1).boundingBox())!;
  expect(second.y).toBe(first.y);
  expect(second.x).toBeGreaterThan(first.x + first.width);
});

test('every label on the RadioGroup card points at its radio', async ({ page }) => {
  await openGallery(page);
  expect(await strayLabels(card(page, 'RadioGroup'))).toEqual([]);
});
