import { test, expect, type Page } from '@playwright/test';
import { openGallery, specimen } from './gallery';

// The shared searchable list (SearchList in client/src/components/ui/Combobox.tsx) in the
// controls gallery: the category picker's keyboard rules, proved before the picker moves onto it
// (#267, plan 02-10). With a search typed Enter picks the first match; with none it picks nothing.

const row = (page: Page) => specimen(page, 'Searchable list', 'Default');
const opener = (page: Page) => row(page).getByRole('button', { name: /^Envelope:/ });
const search = (page: Page) => page.getByRole('textbox', { name: 'Search envelopes' });
const list = (page: Page) => page.getByRole('listbox', { name: 'Search envelopes' });
const readout = (page: Page) => page.getByTestId('search-list-readout');

async function openList(page: Page) {
  await opener(page).click();
  await expect(search(page)).toBeFocused();
}

test('opens with focus in the search field; a typed search filters and Enter picks its first match', async ({
  page,
}) => {
  await openGallery(page);
  await openList(page);
  // A text field, not a search field: the role specs find it by
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(list(page).getByRole('group', { name: 'Everyday' })).toBeVisible();

  // Mixed case: the caller's lower-cased substring match
  await page.keyboard.type('fUeL');
  await expect(list(page).getByRole('option')).toHaveText(['No envelope', 'Fuel']);
  await page.keyboard.press('Enter');
  await expect(search(page)).toHaveCount(0);
  await expect(readout(page)).toHaveText('Chosen: fuel');
});

test('Enter with nothing typed picks nothing and leaves the list open', async ({ page }) => {
  await openGallery(page);
  await openList(page);
  await page.keyboard.press('Enter');
  await expect(search(page)).toBeFocused();
  await expect(readout(page)).toHaveText('Chosen: none');
});

test('ArrowDown from an empty search reaches the pinned row first; while searching it is skipped', async ({
  page,
}) => {
  await openGallery(page);
  await openList(page);
  await page.keyboard.type('rent');
  await page.keyboard.press('Enter');
  await expect(readout(page)).toHaveText('Chosen: rent');

  await openList(page);
  await page.keyboard.press('ArrowDown');
  const pinned = list(page).getByRole('option', { name: 'No envelope' });
  await expect(search(page)).toHaveAttribute(
    'aria-activedescendant',
    (await pinned.getAttribute('id'))!,
  );
  await page.keyboard.press('ArrowUp');
  await expect(pinned).toHaveAttribute('data-focused', 'true');
  await page.keyboard.press('Enter');
  await expect(readout(page)).toHaveText('Chosen: none');

  // While searching, the pinned row shows but the first match is the highlighted one
  await openList(page);
  await page.keyboard.type('o');
  await expect(pinned).toBeVisible();
  await expect(pinned).not.toHaveAttribute('data-focused', 'true');
  await expect(list(page).getByRole('option', { name: 'Groceries' })).toHaveAttribute(
    'data-focused',
    'true',
  );
});

test('a search with no match shows the empty text while the pinned row still shows', async ({
  page,
}) => {
  await openGallery(page);
  await openList(page);
  await page.keyboard.type('zzz');
  await expect(row(page).page().getByText('No envelopes found')).toBeVisible();
  await expect(list(page).getByRole('option')).toHaveText(['No envelope']);
  // Nothing to pick: Enter does nothing
  await page.keyboard.press('Enter');
  await expect(search(page)).toBeFocused();
  await expect(readout(page)).toHaveText('Chosen: none');
});

test('Escape and a click outside close with no pick; focus returns to the opening button', async ({
  page,
}) => {
  await openGallery(page);
  await openList(page);
  await page.keyboard.type('gro');
  await page.keyboard.press('Escape');
  await expect(search(page)).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  await expect(readout(page)).toHaveText('Chosen: none');

  await openList(page);
  // A click outside closes the list with no pick
  await page.mouse.click(8, 8);
  await expect(search(page)).toHaveCount(0);
  await expect(readout(page)).toHaveText('Chosen: none');
});

test('a click on an option picks it', async ({ page }) => {
  await openGallery(page);
  await openList(page);
  await list(page).getByRole('option', { name: 'Power and gas' }).click();
  await expect(search(page)).toHaveCount(0);
  await expect(readout(page)).toHaveText('Chosen: power');
  await openList(page);
  await expect(list(page).getByRole('option', { name: 'Power and gas' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

// The category picker (client/src/components/transactions/CategoryPicker.tsx) on the shared
// searchable list (#267, plan 02-18), floating beside its button and inside its button's own
// wrapper. The gallery has no server and fetches nothing (T-02-10): its create waits half a
// second, then adds the category to the specimen, or refuses a name its group already has.

type PickerState = 'Anchored' | 'Inline';
const pickerRow = (page: Page, state: PickerState) => specimen(page, 'Category picker', state);
const pickerOpener = (page: Page, state: PickerState) =>
  pickerRow(page, state).getByRole('button', { name: /^Category:/ });
const categorySearch = (page: Page) => page.getByRole('textbox', { name: 'Search categories' });
const categoryList = (page: Page) => page.getByRole('listbox', { name: 'Search categories' });
const pickerReadout = (page: Page, state: PickerState) =>
  page.getByTestId(`category-picker-readout-${state === 'Anchored' ? 'anchored' : 'inline'}`);

async function openPicker(page: Page, state: PickerState) {
  await pickerOpener(page, state).click();
  await expect(categorySearch(page)).toBeFocused();
}

async function openCreate(page: Page, state: PickerState = 'Anchored') {
  await openGallery(page);
  await openPicker(page, state);
  await page.getByRole('button', { name: 'Create new category' }).click();
  const name = page.getByRole('textbox', { name: 'New category name' });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('placeholder', 'Category name');
  return name;
}

/** Every request the page makes to the app's API; the gallery must make none */
function apiRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) urls.push(request.url());
  });
  return urls;
}

for (const state of ['Anchored', 'Inline'] as const) {
  test(`${state}: the rows are listbox options, filtered by a search in any letter case`, async ({
    page,
  }) => {
    await openGallery(page);
    await openPicker(page, state);
    const list = categoryList(page);
    // The hidden category stays out; the Transfer section names the accounts
    await expect(list.getByRole('option', { name: 'Old gym' })).toHaveCount(0);
    await expect(list.getByRole('group', { name: 'Transfer' }).getByRole('option')).toHaveText([
      'Transfer: Rainy day savings',
      'Transfer: Credit card',
    ]);
    await expect(list.getByRole('option').first()).toHaveText('Uncategorised');
    await expect(list.getByRole('option', { name: 'Uncategorised' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.keyboard.type('gRoCeR');
    await expect(list.getByRole('option')).toHaveText(['Uncategorised', 'Groceries']);
    await page.keyboard.press('Enter');
    await expect(categorySearch(page)).toHaveCount(0);
    await expect(pickerReadout(page, state)).toHaveText('Chosen: groceries');

    await openPicker(page, state);
    await page.keyboard.type('zzz');
    await expect(page.getByText('No categories found')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(categorySearch(page)).toHaveCount(0);
    await expect(pickerOpener(page, state)).toBeFocused();
    await expect(pickerReadout(page, state)).toHaveText('Chosen: groceries');

    await openPicker(page, state);
    await categoryList(page).getByRole('option', { name: 'Transfer: Credit card' }).click();
    await expect(pickerReadout(page, state)).toHaveText('Chosen: transfer:card');
  });

  test(`${state}: on a phone the picker fits the screen with 44 px rows and 16 px search text`, async ({
    page,
  }) => {
    await openGallery(page, { width: 390 });
    await openPicker(page, state);
    await expect(categorySearch(page)).toHaveCSS('font-size', '16px');
    const option = categoryList(page).getByRole('option', { name: 'Groceries' });
    await expect
      .poll(async () => (await option.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(44);
    // The long name truncates on one line: no wider than its row
    const long = categoryList(page).getByRole('option', { name: /^Weekend markets/ });
    const longBox = (await long.boundingBox())!;
    expect(longBox.height).toBeLessThan(60);
    expect(longBox.x + longBox.width).toBeLessThanOrEqual(390 - 8);
    const create = page.getByRole('button', { name: 'Create new category' });
    await expect(create).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
}

test('while a create is pending its button is disabled and reads "Creating..."', async ({
  page,
}) => {
  // The page's timers are held, so the gallery's create stays pending until the clock moves
  await page.clock.install();
  const name = await openCreate(page);
  await name.fill('Fitness');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const creating = page.getByRole('button', { name: 'Creating...' });
  await expect(creating).toBeDisabled();
  await page.clock.runFor(1_000);
  await expect(pickerReadout(page, 'Anchored')).toHaveText('Chosen: fitness');
});

test('a failed create keeps the form open with an error line and the typed name', async ({
  page,
}) => {
  const name = await openCreate(page, 'Inline');
  // Everyday already has Groceries, so the gallery refuses it, as a failed request would be
  await name.fill('groceries');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(pickerRow(page, 'Inline').getByRole('alert')).toHaveText(
    "Couldn't create the category. Try again.",
  );
  await expect(name).toHaveValue('groceries');
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  await expect(pickerReadout(page, 'Inline')).toHaveText('Chosen: none');
});

test('a successful create gives the group, budget type and name, picks the new category and fetches nothing', async ({
  page,
}) => {
  const requests = apiRequests(page);
  const name = await openCreate(page);
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fixed', exact: true }).click();
  await name.fill('Fitness');
  // Enter in the name field creates
  await name.press('Enter');
  await expect(categorySearch(page)).toHaveCount(0);
  await expect(pickerReadout(page, 'Anchored')).toHaveText('Chosen: fitness');
  await expect(page.getByTestId('category-picker-readout-anchored-created')).toHaveText(
    'Created: Fitness in Everyday, fixed',
  );
  // The new category is listed with the others the next time the picker opens
  await openPicker(page, 'Anchored');
  await expect(categoryList(page).getByRole('option', { name: 'Fitness' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(requests).toEqual([]);
});

test('an income group hides the budget types; cancel returns to the create button and clears the name', async ({
  page,
}) => {
  const name = await openCreate(page);
  await expect(page.getByRole('button', { name: 'Non-Monthly', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /New category group/ }).click();
  await page.getByRole('option', { name: 'Income', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flexible', exact: true })).toHaveCount(0);
  await name.fill('Bonus');
  await page.getByRole('button', { name: 'Cancel new category' }).click();
  await expect(name).toHaveCount(0);
  await page.getByRole('button', { name: 'Create new category' }).click();
  await expect(page.getByRole('textbox', { name: 'New category name' })).toHaveValue('');
  // Escape in the form closes the picker with no pick, and focus returns to its button
  await page.keyboard.press('Escape');
  await expect(categorySearch(page)).toHaveCount(0);
  await expect(pickerOpener(page, 'Anchored')).toBeFocused();
  await expect(pickerReadout(page, 'Anchored')).toHaveText('Chosen: none');
});
