import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  expectScreenshot,
  openGallery,
  PIXELS,
  specimen,
  type GalleryTheme,
  type GalleryWidth,
} from './gallery';

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

// --- Number field and Money field gallery cards (03-03) -----------------------------------------

test('the Number field card shows valid, invalid, optional, disabled and sm % states', async ({
  page,
}) => {
  await openGallery(page);
  const valid = specimen(page, 'NumberField', 'Valid').getByRole('textbox');
  await expect(valid).toHaveValue('12');
  await expect(valid).toHaveAttribute('type', 'text');
  await expect(valid).toHaveAttribute('inputmode', 'numeric');
  await expect(valid).not.toHaveAttribute('aria-invalid', 'true');

  // Interactive bound crossing (WR-01): valid -> invalid alert -> valid clears alert
  await valid.fill('61');
  await expect(valid).toHaveAttribute('aria-invalid', 'true');
  const alert = specimen(page, 'NumberField', 'Valid').getByRole('alert');
  await expect(alert).toHaveText('Enter a whole number from 1 to 60.');
  await valid.fill('60');
  await expect(valid).not.toHaveAttribute('aria-invalid', 'true');
  await expect(alert).toHaveCount(0);

  const invalidRow = specimen(page, 'NumberField', 'Invalid');
  const invalid = invalidRow.getByRole('textbox');
  await expect(invalid).toHaveValue('61');
  await expect(invalid).toHaveAttribute('aria-invalid', 'true');
  await expect(invalidRow.getByRole('alert')).toHaveText('Enter a whole number from 1 to 60.');
  await expect(invalid).toHaveAccessibleDescription('Enter a whole number from 1 to 60.');

  const optional = specimen(page, 'NumberField', 'Optional').getByRole('textbox');
  await expect(optional).toHaveValue('');
  await expect(optional).not.toHaveAttribute('aria-invalid', 'true');

  const disabled = specimen(page, 'NumberField', 'Disabled').getByRole('textbox');
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveValue('12');

  const smallRow = specimen(page, 'NumberField', 'Small');
  const small = smallRow.getByRole('textbox');
  await expect(small).toHaveValue('33.5');
  await expect(small).toHaveAttribute('inputmode', 'decimal');
  expect((await small.boundingBox())!.height).toBe(32);
  await expect(smallRow.locator('span[aria-hidden="true"]', { hasText: '%' })).toBeVisible();
});

test('the Money field card shows md, sm and expression CurrencyInput states', async ({ page }) => {
  await openGallery(page);
  const filled = specimen(page, 'CurrencyInput', 'Filled').getByRole('textbox');
  const small = specimen(page, 'CurrencyInput', 'Small').getByRole('textbox');
  const expr = specimen(page, 'CurrencyInput', 'Expression').getByRole('textbox');

  expect((await filled.boundingBox())!.height).toBe(40);
  expect((await small.boundingBox())!.height).toBe(32);

  await expr.focus();
  await expr.fill('100+50');
  await expr.blur();
  await expect(expr).toHaveValue('$150');
});

for (const width of [1280, 390] as GalleryWidth[])
  for (const theme of ['light', 'dark'] as GalleryTheme[])
    test(`the Number field and Money field cards match their baselines at ${width} px (${theme})`, async ({
      page,
    }) => {
      await openGallery(page, { width, theme });
      const numberCard = card(page, 'Number field');
      const moneyCard = card(page, 'Money field');
      expect(await strayLabels(numberCard)).toEqual([]);
      expect(await strayLabels(moneyCard)).toEqual([]);

      if (width === 390) {
        for (const field of await numberCard.getByRole('textbox').all()) {
          expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await expect(field).toHaveCSS('font-size', '16px');
        }
        for (const field of await moneyCard.getByRole('textbox').all()) {
          expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
      await expectScreenshot(numberCard, `number-field-card-${width}-${theme}`);
      await expectScreenshot(moneyCard, `money-field-card-${width}-${theme}`);
    });

// --- Phase 2 review fixes: IN-04 and R2-IN-02 ---------------------------------------------------

test('the gallery theme button switches locally without writing the saved theme preference (IN-04)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'budget-preferences',
      JSON.stringify({ state: { theme: 'light' }, version: 4 }),
    );
  });
  await openGallery(page, { theme: 'light' });
  const before = await page.evaluate(() => window.localStorage.getItem('budget-preferences'));

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
  expect(await page.evaluate(() => window.localStorage.getItem('budget-preferences'))).toBe(before);

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/);
  expect(await page.evaluate(() => window.localStorage.getItem('budget-preferences'))).toBe(before);
});

test('creating categories in the offline picker never collides across groups or gives an empty id (R2-IN-02)', async ({
  page,
}) => {
  await openGallery(page);
  const opener = specimen(page, 'Category picker', 'Anchored').getByRole('button', {
    name: /^Category:/,
  });
  const readout = page.getByTestId('category-picker-readout-anchored');

  const createInEveryday = async (categoryName: string) => {
    await opener.click();
    await page.getByRole('button', { name: 'Create new category' }).click();
    const input = page.getByRole('textbox', { name: 'New category name' });
    await input.fill(categoryName);
    await input.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Search categories' })).toHaveCount(0);
  };

  // Collides with Bills' "rent" -> gets a unique suffix
  await createInEveryday('Rent');
  await expect(readout).toHaveText('Chosen: rent-2');

  // Punctuation strips to existing Everyday "groceries" -> gets a unique suffix
  await createInEveryday('Groceries!');
  await expect(readout).toHaveText('Chosen: groceries-2');

  // Non-Latin / punctuation-only names get non-empty unique fallback ids
  await createInEveryday('!!!');
  await expect(readout).toHaveText('Chosen: category');
  await createInEveryday('日本');
  await expect(readout).toHaveText('Chosen: category-2');
});

// --- Mounted React interaction checks for NumberField and CurrencyInput (03-02 WR-03) -----------

async function openFieldProbes(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/controls?probe=fields');
  await expect(page.getByTestId('probe-r3-cr-01')).toBeVisible();
}

test('mounted NumberField: typing 05 over 5 then external value change shows the new value (R3-CR-01)', async ({
  page,
}) => {
  await openFieldProbes(page);
  const section = page.getByTestId('probe-r3-cr-01');
  const input = section.getByRole('textbox');
  await input.fill('05');
  await expect(input).toHaveValue('05');
  await expect(section.getByTestId('saved')).toHaveText('5');
  await expect(input).toBeFocused();

  await section.getByRole('button', { name: 'Set external 7' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('7');
  await expect(section.getByTestId('valid')).toHaveText('true');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');

  // Unfocused bound-relax variant when caller ignores emitted 61 and later sets 20
  const unfocused = page.getByTestId('probe-r3-cr-01-unfocused');
  const uInput = unfocused.getByRole('textbox');
  await uInput.fill('61');
  await uInput.blur();
  await unfocused.getByRole('button', { name: 'Set max 100' }).click();
  await unfocused.getByRole('button', { name: 'Set external 20' }).click();
  await expect(uInput).toHaveValue('20');
});

test('mounted NumberField: rounded acknowledgements keep typed text, including half-up and deferred (CR-02, R2-CR-02, R5-WR-01)', async ({
  page,
}) => {
  await openFieldProbes(page);
  const rounded = page.getByTestId('probe-cr-02');
  const rInput = rounded.getByRole('textbox');

  await rInput.fill('3.141');
  await expect(rounded.getByTestId('bps')).toHaveText('314');
  await expect(rInput).toHaveValue('3.141');
  await expect(rounded.getByTestId('valid')).toHaveText('true');

  await rInput.fill('3.146');
  await expect(rounded.getByTestId('bps')).toHaveText('315');
  await expect(rInput).toHaveValue('3.146');
  await expect(rounded.getByTestId('valid')).toHaveText('true');

  // Math.round half-up values that disagree with toFixed(2) (R5-WR-01)
  await rInput.fill('2.675');
  await expect(rounded.getByTestId('bps')).toHaveText('268');
  await expect(rInput).toHaveValue('2.675');
  await rInput.fill('0.015');
  await expect(rounded.getByTestId('bps')).toHaveText('2');
  await expect(rInput).toHaveValue('0.015');

  // External reset updates the visible text
  await rounded.getByRole('button', { name: 'Reset 6.5' }).click();
  await expect(rInput).toHaveValue('6.5');

  // Deferred rounding, resetKey, and blur reset (R2-CR-02)
  const deferred = page.getByTestId('probe-r2-cr-02');
  const dInput = deferred.getByRole('textbox');
  await dInput.fill('3.146');
  await expect(deferred.getByTestId('deferred')).toHaveText('315');
  await expect(dInput).toHaveValue('3.146');

  await deferred.getByRole('button', { name: 'Flush deferred' }).click();
  await expect(dInput).toHaveValue('3.146');
  await expect(deferred.getByTestId('valid')).toHaveText('true');

  await deferred.getByRole('button', { name: 'Set 6.5' }).click();
  await expect(dInput).toHaveValue('6.5');

  await dInput.fill('6.501');
  await expect(deferred.getByTestId('deferred')).toHaveText('650');
  await expect(dInput).toHaveValue('6.501');
  await deferred.getByRole('button', { name: 'Bump resetKey' }).click();
  await expect(dInput).toHaveValue('6.5');

  await dInput.fill('6.501');
  await dInput.blur();
  await deferred.getByRole('button', { name: 'Set 7' }).click();
  await expect(dInput).toHaveValue('7');
});

test('mounted NumberField: in-order async acknowledgements keep typed draft and external value replaces it (R3-WR-01)', async ({
  page,
}) => {
  await openFieldProbes(page);
  const section = page.getByTestId('probe-r3-wr-01');
  const input = section.getByRole('textbox');

  await input.fill('3.1');
  await input.fill('3.14');
  await input.fill('3.146');
  await expect(section.getByTestId('emitted')).toHaveText('[3.1,3.14,3.146]');

  await section.getByRole('button', { name: 'Deliver 3.1', exact: true }).click();
  await expect(input).toHaveValue('3.146');
  await section.getByRole('button', { name: 'Deliver 3.14', exact: true }).click();
  await expect(input).toHaveValue('3.146');
  await section.getByRole('button', { name: 'Deliver 3.15', exact: true }).click();
  await expect(input).toHaveValue('3.146');

  await section.getByRole('button', { name: 'Deliver 6.5', exact: true }).click();
  await expect(input).toHaveValue('6.5');
});

test('mounted NumberField: external nearby decimal changes resync when no edit is in flight (R4-CR-01)', async ({
  page,
}) => {
  await openFieldProbes(page);
  const untouched = page.getByTestId('probe-r4-cr-01').getByTestId('untouched');
  const uInput = untouched.getByRole('textbox');
  await expect(uInput).toHaveValue('3.14');
  await untouched.getByRole('button', { name: 'Set 3.1', exact: true }).click();
  await expect(uInput).toHaveValue('3.1');
  await untouched.getByRole('button', { name: 'Set 3.05', exact: true }).click();
  await expect(uInput).toHaveValue('3.05');
  await untouched.getByRole('button', { name: 'Set 3', exact: true }).click();
  await expect(uInput).toHaveValue('3');

  const edited = page.getByTestId('probe-r4-cr-01').getByTestId('edited');
  const eInput = edited.getByRole('textbox');
  await eInput.fill('3.14');
  await expect(edited.getByTestId('saved')).toHaveText('3.14');
  await eInput.blur();
  await edited.getByRole('button', { name: 'Reset edited 3.1' }).click();
  await expect(eInput).toHaveValue('3.1');
});

test('mounted NumberField: raising max with retained out-of-range text commits only when enabled, and disabled validity holds (CR-03, R2-CR-03, R2-CR-04, R3-WR-02, R4-WR-01, R4-WR-02)', async ({
  page,
}) => {
  await openFieldProbes(page);
  const section = page.getByTestId('probe-bound-disabled');
  const input = section.getByRole('textbox');

  // Enabled bound relax (CR-03): raising max while enabled commits retained '61' before Save enables
  await input.fill('61');
  await expect(section.getByTestId('calls')).toHaveText('0');
  await expect(section.getByTestId('saved')).toHaveText('12');
  await expect(section.getByTestId('valid')).toHaveText('false');
  await section.getByRole('button', { name: 'Set max 100' }).click();
  await expect(section.getByTestId('calls')).toHaveText('1');
  await expect(section.getByTestId('saved')).toHaveText('61');
  await expect(input).toHaveValue('61');
  await expect(section.getByTestId('valid')).toHaveText('true');
  await section.getByRole('button', { name: 'Set max 50' }).click();
  await expect(section.getByTestId('saved')).toHaveText('61');
  await expect(section.getByTestId('valid')).toHaveText('false');

  // Reset probe for the disabled-reconciliation sequence
  await section.getByRole('button', { name: 'Reset probe' }).click();
  await expect(section.getByTestId('calls')).toHaveText('0');
  await expect(section.getByTestId('saved')).toHaveText('12');
  await expect(input).toHaveValue('12');

  await input.fill('61');
  await expect(section.getByTestId('calls')).toHaveText('0');
  await expect(section.getByTestId('saved')).toHaveText('12');
  await expect(section.getByTestId('valid')).toHaveText('false');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(section.getByRole('alert')).toBeVisible();

  // Disable while max is still 60: shows controlled '12', valid, hides error (R4-WR-02)
  await section.getByRole('button', { name: 'Toggle disabled' }).click();
  await expect(input).toBeDisabled();
  await expect(input).toHaveValue('12');
  await expect(section.getByTestId('valid')).toHaveText('true');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(section.getByRole('alert')).toHaveCount(0);

  // Re-enable while max is still 60: restores '61' and error (R4-WR-02)
  await section.getByRole('button', { name: 'Toggle disabled' }).click();
  await expect(input).toHaveValue('61');
  await expect(section.getByTestId('valid')).toHaveText('false');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(section.getByRole('alert')).toBeVisible();

  // Disable and raise max to 100: emits nothing, shows '12', valid, no error (R2-CR-04, R3-WR-02)
  await section.getByRole('button', { name: 'Toggle disabled' }).click();
  await section.getByRole('button', { name: 'Set max 100' }).click();
  await expect(section.getByTestId('calls')).toHaveText('0');
  await expect(section.getByTestId('saved')).toHaveText('12');
  await expect(input).toHaveValue('12');
  await expect(section.getByTestId('valid')).toHaveText('true');
  await expect(section.getByRole('alert')).toHaveCount(0);

  // Re-enable: reconciles and commits 61 (CR-03, R2-CR-04)
  await section.getByRole('button', { name: 'Toggle disabled' }).click();
  await expect(section.getByTestId('calls')).toHaveText('1');
  await expect(section.getByTestId('saved')).toHaveText('61');
  await expect(input).toHaveValue('61');
  await expect(section.getByTestId('valid')).toHaveText('true');

  // Tighten max to 50: disables Save without altering saved (CR-03)
  await section.getByRole('button', { name: 'Set max 50' }).click();
  await expect(section.getByTestId('saved')).toHaveText('61');
  await expect(section.getByTestId('valid')).toHaveText('false');

  // Tighten bound on rounded controlled value (R2-CR-03)
  const tighten = page.getByTestId('probe-r2-cr-03');
  const tInput = tighten.getByRole('textbox');
  await tInput.fill('3.146');
  await expect(tighten.getByTestId('bps')).toHaveText('315');
  await expect(tighten.getByTestId('valid')).toHaveText('true');
  await tighten.getByRole('button', { name: 'Set max 3.147' }).click();
  await expect(tighten.getByTestId('valid')).toHaveText('false');
  await expect(tInput).toHaveAttribute('aria-invalid', 'true');
  await tighten.getByRole('button', { name: 'Set max 3.15' }).click();
  await expect(tighten.getByTestId('valid')).toHaveText('true');

  // Disabled with out-of-range controlled value (R4-WR-01)
  const initialOut = page.getByTestId('probe-r4-wr-01').getByTestId('initial');
  await expect(initialOut.getByRole('textbox')).toHaveValue('100');
  await expect(initialOut.getByTestId('valid')).toHaveText('false');
  await expect(initialOut.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  await expect(initialOut.getByRole('alert')).toHaveText('Enter a whole number from 1 to 60.');

  const tightenedOut = page.getByTestId('probe-r4-wr-01').getByTestId('tightened');
  await expect(tightenedOut.getByTestId('valid')).toHaveText('true');
  await tightenedOut.getByRole('button', { name: 'Tighten to 3.147' }).click();
  await expect(tightenedOut.getByTestId('valid')).toHaveText('false');
  await expect(tightenedOut.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
});

test('mounted CurrencyInput: read-only emits nothing on focus and blur, explicit-commit draft survives blur/refocus and resets on focused value change, and refs clean up (CR-01, R2-CR-01, CR-04, WR-02)', async ({
  page,
}) => {
  await openFieldProbes(page);

  // Read-only money field emits nothing on focus and blur (CR-04)
  const ro = page.getByTestId('probe-cr-04');
  const roInput = ro.getByRole('textbox');
  await roInput.focus();
  await roInput.blur();
  await expect(ro.getByTestId('changes')).toHaveText('0');
  await expect(ro.getByTestId('blurs')).toHaveText('1');
  await expect(roInput).toHaveValue('-$12.50');

  // Explicit-commit draft survives blur and refocus (CR-01)
  const ec = page.getByTestId('probe-cr-01');
  const ecInput = ec.getByRole('textbox');
  await ecInput.focus();
  await ecInput.fill('100+50');
  await expect(ec.getByTestId('text')).toHaveText('15000');
  await expect(ec.getByTestId('valid')).toHaveText('true');

  await ecInput.blur();
  await expect(ec.getByTestId('changes')).toHaveText('0');
  await expect(ec.getByTestId('blurs')).toHaveText('1');
  await expect(ecInput).toHaveValue('100+50');
  await expect(ecInput).not.toHaveAttribute('aria-invalid', 'true');
  await expect(ec.getByTestId('valid')).toHaveText('true');

  await ecInput.focus();
  await expect(ecInput).toHaveValue('100+50');

  // Mirrors UNREADABLE_AMOUNT in client/src/utils/currency.ts
  const UNREADABLE_AMOUNT = "That isn't an amount. Type it like 12.50 or 12,50.";

  await ecInput.fill('abc');
  await expect(ec.getByTestId('text')).toHaveText('null');
  await expect(ec.getByTestId('valid')).toHaveText('false');
  expect(await ecInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe(
    UNREADABLE_AMOUNT,
  );

  await ecInput.blur();
  await expect(ecInput).toHaveValue('abc');
  await expect(ecInput).toHaveAttribute('aria-invalid', 'true');
  await expect(ec.getByTestId('valid')).toHaveText('false');
  expect(await ecInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe(
    UNREADABLE_AMOUNT,
  );

  await ecInput.focus();
  await expect(ecInput).toHaveValue('abc');
  await expect(ecInput).toHaveAttribute('aria-invalid', 'true');
  await expect(ec.getByTestId('valid')).toHaveText('false');
  expect(await ecInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe(
    UNREADABLE_AMOUNT,
  );

  // Unmounting clears invalidity from AmountFields
  await ec.getByRole('button', { name: 'Toggle mount' }).click();
  await expect(ec.getByTestId('valid')).toHaveText('true');

  // Explicit-commit focused reset replaces both valid and invalid drafts (R2-CR-01)
  const reset = page.getByTestId('probe-r2-cr-01');
  const resetInput = reset.getByRole('textbox');
  await resetInput.focus();
  await resetInput.fill('100+50');
  await reset.getByRole('button', { name: 'Set 2000' }).click();
  await expect(resetInput).toBeFocused();
  await expect(resetInput).toHaveValue('20.00');
  await expect(resetInput).not.toHaveAttribute('aria-invalid', 'true');
  await resetInput.blur();
  await expect(resetInput).toHaveValue('$20');
  await expect(resetInput).not.toHaveAttribute('aria-invalid', 'true');
  await expect(reset.getByTestId('valid')).toHaveText('true');

  await resetInput.focus();
  await expect(resetInput).toHaveValue('20.00');
  await resetInput.fill('abc');
  await expect(reset.getByTestId('valid')).toHaveText('false');
  expect(await resetInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe(
    UNREADABLE_AMOUNT,
  );
  await reset.getByRole('button', { name: 'Set 3500' }).click();
  await expect(resetInput).toBeFocused();
  await expect(resetInput).toHaveValue('35.00');
  await expect(resetInput).not.toHaveAttribute('aria-invalid', 'true');
  await expect(reset.getByTestId('valid')).toHaveText('true');
  expect(await resetInput.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe('');
  await resetInput.blur();
  await expect(resetInput).toHaveValue('$35');
  await expect(resetInput).not.toHaveAttribute('aria-invalid', 'true');
  await expect(reset.getByTestId('valid')).toHaveText('true');

  // React 19 callback ref cleanup, classic callback ref null-detach, object ref (WR-02)
  const refs = page.getByTestId('probe-wr-02');
  await refs.getByRole('button', { name: 'Read refs' }).click();
  const mountedSnap = JSON.parse((await refs.getByTestId('refs').textContent())!);
  expect(mountedSnap.cleanupMounts).toBeGreaterThanOrEqual(1);
  expect(mountedSnap.cleanupNulls).toBe(0);
  expect(mountedSnap.cleanupsRun).toBe(0);
  expect(mountedSnap.classicMounts).toBeGreaterThanOrEqual(1);
  expect(mountedSnap.classicNulls).toBe(0);
  expect(mountedSnap.objTag).toBe('INPUT');

  await refs.getByRole('button', { name: 'Toggle refs' }).click();
  await refs.getByRole('button', { name: 'Read refs' }).click();
  const unmountedSnap = JSON.parse((await refs.getByTestId('refs').textContent())!);
  expect(unmountedSnap.cleanupsRun).toBe(mountedSnap.cleanupMounts);
  expect(unmountedSnap.cleanupNulls).toBe(0);
  expect(unmountedSnap.classicNulls).toBe(mountedSnap.classicMounts);
  expect(unmountedSnap.objTag).toBeNull();
});
