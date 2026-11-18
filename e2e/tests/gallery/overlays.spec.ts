import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  expectScreenshot,
  openGallery,
  PIXELS,
  specimen,
  type GalleryTheme,
  type GalleryWidth,
  type Region,
} from './gallery';

// The shared popover controls as a set in the controls gallery (#267, WAVG-03 and WAVG-04):
// Escape with a list open inside the app's Modal closes only the list (D-12), Tab stays in the
// dialog, every control is a 44 px target with native pickers on a phone, the date pickers turn
// native below 768 px (E-03), and each open popover is pictured. Every test opens its own page
// at its own size and theme, so each passes alone.

/** The browser's clock is pinned, so Today and This month are the gallery's own day */
const TODAY = new Date('2026-11-16T12:00:00');

const gallery = async (
  page: Page,
  options: { theme?: GalleryTheme; width?: GalleryWidth } = {},
) => {
  await page.clock.setFixedTime(TODAY);
  await openGallery(page, options);
};

/** Lets the scroll a focus or click causes reach the page before a list opens (combobox.spec.ts) */
const settle = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

// --- Escape and Tab inside the shared Modal (D-12, 02-RESEARCH.md assumption A1) ----------------

const modal = (page: Page) => page.getByRole('dialog', { name: 'Controls in a dialog' });

async function openDialog(page: Page) {
  await gallery(page);
  await page.getByRole('button', { name: 'Open a dialog' }).click();
  await expect(modal(page)).toBeVisible();
  return modal(page);
}

/**
 * The seven popover controls in the dialog: how each opens, and its open list or popover. A
 * React Aria popover hides the rest of the page from getByRole while it is open, so the opener
 * is found before the list opens.
 */
const IN_DIALOG: { control: string; open: (dialog: Locator) => Promise<Locator> }[] = [
  {
    control: 'Select',
    open: async (dialog) => {
      await dialog.getByRole('button', { name: 'Monthly Frequency' }).click();
      return dialog.page().getByRole('listbox');
    },
  },
  {
    control: 'Combobox',
    open: async (dialog) => {
      await dialog.getByRole('combobox', { name: 'Account' }).focus();
      await dialog.page().keyboard.press('ArrowDown');
      return dialog.page().getByRole('listbox');
    },
  },
  {
    control: 'DatePicker',
    open: async (dialog) => {
      await dialog.getByRole('button', { name: 'Choose from a calendar' }).click();
      return dialog
        .page()
        .getByRole('dialog')
        .filter({ has: dialog.page().getByRole('grid') });
    },
  },
  {
    control: 'MonthPicker',
    open: async (dialog) => {
      await dialog.getByRole('button', { name: /^Month Nov 2026/ }).click();
      return dialog.page().getByRole('dialog', { name: 'Choose a month' });
    },
  },
  {
    control: 'MonthRangePicker',
    open: async (dialog) => {
      await dialog.getByRole('button', { name: /^Months Jun 2026/ }).click();
      return dialog.page().getByRole('dialog', { name: 'Choose months' });
    },
  },
  {
    control: 'PayeeCombobox',
    // The payee field opens its suggestions on focus
    open: async (dialog) => {
      await dialog.getByRole('combobox', { name: 'Payee' }).focus();
      return dialog.page().getByRole('listbox');
    },
  },
  {
    control: 'CategoryPicker',
    open: async (dialog) => {
      await dialog.getByRole('button', { name: /^Category:/ }).click();
      return dialog.page().getByRole('dialog', { name: 'Search categories' });
    },
  },
];

for (const { control, open } of IN_DIALOG)
  test(`Escape with the ${control} open in a dialog closes only the ${control}`, async ({
    page,
  }) => {
    const dialog = await openDialog(page);
    const list = await open(dialog);
    await expect(list).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    // The page under the dialog stays out of reach of clicks and screen readers. React Aria's
    // list cleanup used to clear the inert the dialog holds (utils/inertRoot.ts).
    await expect(page.locator('#root')).toHaveJSProperty('inert', true);

    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    await expect(page.locator('#root')).toHaveJSProperty('inert', false);
  });

/** Whether focus is in the dialog or a popover over it, never back in the page beneath */
const focusAboveThePage = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return (
      !!active && active !== document.body && !document.getElementById('root')!.contains(active)
    );
  });

for (const { control, open } of IN_DIALOG)
  test(`Tab stays inside the dialog while the ${control} is open and after it closes`, async ({
    page,
  }) => {
    const dialog = await openDialog(page);
    const stops = await dialog.evaluate(
      (el) =>
        el.querySelectorAll('button:not([disabled]), input:not([type="hidden"]), [tabindex="0"]')
          .length,
    );
    // Closed with Escape, the list leaves Tab going round the dialog, never into the page beneath
    let list = await open(dialog);
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press('Tab');
      expect(await focusAboveThePage(page)).toBe(true);
    }
    // Open, Tab keeps to the popover or the dialog, also when Tab is what closes the list
    list = await open(dialog);
    await expect(list).toBeVisible();
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press('Tab');
      expect(await focusAboveThePage(page)).toBe(true);
    }
  });

// --- Phones -----------------------------------------------------------------------------------

/** The cards of the eleven shared controls and MonthRangePicker (Money entry is not in the set) */
const SET_CARDS = [
  'Label',
  'Field',
  'Input',
  'Textarea',
  'Select',
  'Combobox',
  'DatePicker',
  'MonthPicker',
  'MonthRangePicker',
  'Checkbox',
  'RadioGroup',
  'Switch',
];

const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/**
 * Every visible control in a card that is smaller than 44 by 44 px. A checkbox, radio or switch
 * is measured by its label, the target a finger presses (the input itself is visually hidden);
 * a Combobox's text field by the field box around it and its buttons. The Combobox card's
 * "Payee field" specimen is left out: PayeeCombobox is a wrapper, not one of the set, and its
 * bare look is the register row's (the phone sheet passes its own field classes).
 */
const smallTargets = (scope: Locator) =>
  scope.evaluate((root) => {
    const controls = root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button, [role="combobox"]',
    );
    const small: string[] = [];
    for (const control of controls) {
      if (control.closest('[role="group"][aria-label="Combobox, Payee field"]')) continue;
      const toggle =
        control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type);
      const target = toggle
        ? control.closest('label')
        : control.getAttribute('role') === 'combobox' && control.tagName === 'INPUT'
          ? (control.closest('[data-rac][role="group"]') ?? control)
          : control;
      if (!target || target.getClientRects().length === 0) continue;
      const { width, height } = target.getBoundingClientRect();
      if (width < 44 || height < 44)
        small.push(
          `${control.tagName.toLowerCase()} "${control.getAttribute('aria-label') ?? target.textContent?.trim()}" ${Math.round(width)}x${Math.round(height)}`,
        );
    }
    return small;
  });

const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test('at 390 px every control in the set is a 44 px target and the page does not scroll sideways', async ({
  page,
}) => {
  await gallery(page, { width: 390 });
  for (const name of SET_CARDS) {
    const region = card(page, name);
    await expect(region).toBeVisible();
    expect(await smallTargets(region), `${name} card`).toEqual([]);
  }
  expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
});

test('at 390 px Select, DatePicker and MonthPicker are native and MonthRangePicker is two month inputs', async ({
  page,
}) => {
  await gallery(page, { width: 390 });
  const select = specimen(page, 'Select', 'Default').getByRole('combobox', { name: 'Frequency' });
  await expect(select).toHaveJSProperty('tagName', 'SELECT');
  const date = specimen(page, 'DatePicker', 'Default').getByLabel('Date', { exact: true });
  await expect(date).toHaveJSProperty('tagName', 'INPUT');
  await expect(date).toHaveAttribute('type', 'date');
  const month = specimen(page, 'MonthPicker', 'Default').getByLabel('Budget month', {
    exact: true,
  });
  await expect(month).toHaveJSProperty('tagName', 'INPUT');
  await expect(month).toHaveAttribute('type', 'month');
  const range = specimen(page, 'MonthRangePicker', 'Default');
  for (const name of ['From', 'To']) {
    const input = range.getByLabel(name, { exact: true });
    await expect(input).toHaveJSProperty('tagName', 'INPUT');
    await expect(input).toHaveAttribute('type', 'month');
    // Each input gets the card's width beside the other, not a column squeezed by the row label
    expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(150);
  }
});

test('at 390 px an open Combobox list and an open category picker fit the screen', async ({
  page,
}) => {
  await gallery(page, { width: 390 });
  const row = specimen(page, 'Combobox', 'Default');
  await row.scrollIntoViewIfNeeded();
  await settle(page);
  await row.getByRole('combobox').focus();
  await page.keyboard.press('ArrowDown');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  const listBox = (await list.boundingBox())!;
  expect(listBox.x).toBeGreaterThanOrEqual(0);
  expect(listBox.x + listBox.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);

  await specimen(page, 'Category picker', 'Anchored').getByRole('button').click();
  const picker = page.getByRole('dialog', { name: 'Search categories' });
  await expect(picker).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  const pickerBox = (await picker.boundingBox())!;
  expect(pickerBox.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(390);
});

// --- The 768 px line (E-03) -------------------------------------------------------------------

test('at 767 px the date pickers are native inputs', async ({ page }) => {
  await gallery(page, { width: 767 });
  const date = specimen(page, 'DatePicker', 'Default');
  await expect(date.locator('input[type="date"]:not([tabindex="-1"])')).toHaveCount(1);
  await expect(date.getByRole('spinbutton')).toHaveCount(0);
  const month = specimen(page, 'MonthPicker', 'Default');
  await expect(month.locator('input[type="month"]')).toHaveCount(1);
  await expect(month.getByRole('button')).toHaveCount(0);
  const range = specimen(page, 'MonthRangePicker', 'Default');
  await expect(range.locator('input[type="month"]')).toHaveCount(2);
  await expect(range.getByRole('button')).toHaveCount(0);
});

test('at 768 px the date pickers are the custom controls', async ({ page }) => {
  await gallery(page, { width: 768 });
  const date = specimen(page, 'DatePicker', 'Default');
  // React Aria keeps a hidden date input (tabindex -1) for forms; the native one is the other
  await expect(date.locator('input[type="date"]:not([tabindex="-1"])')).toHaveCount(0);
  await expect(date.getByRole('spinbutton')).toHaveCount(3);
  await expect(date.getByRole('button', { name: 'Choose from a calendar' })).toBeVisible();
  const month = specimen(page, 'MonthPicker', 'Default');
  await expect(month.locator('input[type="month"]')).toHaveCount(0);
  await expect(month.getByRole('button', { name: 'Budget month Nov 2026' })).toBeVisible();
  const range = specimen(page, 'MonthRangePicker', 'Default');
  await expect(range.locator('input[type="month"]')).toHaveCount(0);
  await expect(range.locator('button[aria-haspopup="dialog"]')).toHaveCount(1);
});

// --- Open popovers, pictured ------------------------------------------------------------------

/**
 * Each popover control's gallery specimen and how it opens, returning its open list or popover.
 * Specimens with a chosen value are used, so the chosen option shows its mark.
 */
const OPEN: {
  control: string;
  row: (page: Page) => Locator;
  open: (row: Locator) => Promise<Locator>;
}[] = [
  {
    control: 'Select',
    row: (page) => specimen(page, 'Select', 'Grouped'),
    open: async (row) => {
      await row.getByRole('button').click();
      return listPopover(row.page());
    },
  },
  {
    control: 'Combobox',
    row: (page) => specimen(page, 'Combobox', 'Optional'),
    open: async (row) => {
      await row.getByRole('combobox').focus();
      await row.page().keyboard.press('ArrowDown');
      return listPopover(row.page());
    },
  },
  {
    control: 'CategoryPicker',
    row: (page) => specimen(page, 'Category picker', 'Anchored'),
    open: async (row) => {
      await row.getByRole('button').click();
      return row.page().getByRole('dialog', { name: 'Search categories' });
    },
  },
  {
    control: 'PayeeCombobox',
    row: (page) => specimen(page, 'Combobox', 'Payee field'),
    // Typed text that three payees match and none equals: suggestions and the new-payee row
    open: async (row) => {
      await row.getByRole('combobox').fill('Corner');
      return listPopover(row.page());
    },
  },
  {
    control: 'DatePicker',
    row: (page) => specimen(page, 'DatePicker', 'Default'),
    open: async (row) => {
      await row.getByRole('button', { name: 'Choose from a calendar' }).click();
      return row
        .page()
        .getByRole('dialog')
        .filter({ has: row.page().getByRole('grid') });
    },
  },
  {
    control: 'MonthPicker',
    row: (page) => specimen(page, 'MonthPicker', 'Default'),
    open: async (row) => {
      await row.getByRole('button').first().click();
      return row.page().getByRole('dialog', { name: 'Choose a month' });
    },
  },
  {
    control: 'MonthRangePicker',
    row: (page) => specimen(page, 'MonthRangePicker', 'Default'),
    open: async (row) => {
      await row.getByRole('button').first().click();
      return row.page().getByRole('dialog', { name: 'Choose months' });
    },
  },
];

/** An open list's popover, footer included: React Aria marks it with the control that opened it */
const listPopover = (page: Page) =>
  page.locator('[data-trigger]').filter({ has: page.getByRole('listbox') });

/**
 * The page region holding both boxes, 8 px around them, inside the viewport, on whole pixels so
 * a box's fractional edge never changes the picture's size
 */
function around(a: Region, b: Region, viewport: { width: number; height: number }): Region {
  const x = Math.max(0, Math.floor(Math.min(a.x, b.x) - 8));
  const y = Math.max(0, Math.floor(Math.min(a.y, b.y) - 8));
  const right = Math.min(viewport.width, Math.ceil(Math.max(a.x + a.width, b.x + b.width) + 8));
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(a.y + a.height, b.y + b.height) + 8));
  return { x, y, width: right - x, height: bottom - y };
}

/** Opens the control with its row near the top of the screen and pictures both */
async function pictureOpen(
  page: Page,
  { control, row, open }: (typeof OPEN)[number],
  name: string,
) {
  const specimenRow = row(page);
  // 96 px down the screen, so a popover opening below the row has the room it needs
  await specimenRow.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 96));
  await settle(page);
  const popover = await open(specimenRow);
  await expect(popover).toBeVisible();
  // Measured once the popover's entrance has played out: mid-animation its box is a pixel or
  // two off, and the picture's size with it
  await popover.evaluate((el) =>
    Promise.all(
      (el.closest('[data-trigger]') ?? el)
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ),
  );
  const viewport = page.viewportSize()!;
  const popoverBox = (await popover.boundingBox())!;
  const rowBox = (await specimenRow.boundingBox())!;
  expect(
    popoverBox.y + popoverBox.height,
    `${control} popover inside the screen`,
  ).toBeLessThanOrEqual(viewport.height);
  await expectScreenshot(page, name, { clip: around(rowBox, popoverBox, viewport) });
}

for (const theme of ['light', 'dark'] as const)
  for (const entry of OPEN)
    test(`the open ${entry.control} matches its baseline (${theme})`, async ({ page }) => {
      test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
      await gallery(page, { theme, width: 1280 });
      await pictureOpen(page, entry, `open-${entry.control.toLowerCase()}-${theme}`);
    });

for (const entry of OPEN.filter((e) => ['Combobox', 'CategoryPicker'].includes(e.control)))
  test(`the open ${entry.control} matches its baseline at 390 px (light)`, async ({ page }) => {
    test.skip(!PIXELS, 'Linux baselines; on macOS run them with e2e/gallery-baselines.sh');
    await gallery(page, { theme: 'light', width: 390 });
    await pictureOpen(page, entry, `open-${entry.control.toLowerCase()}-390-light`);
  });
