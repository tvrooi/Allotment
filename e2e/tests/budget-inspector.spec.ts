import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth } from './fixtures';

// BUD-05 and BUD-10: typing assignments from the keyboard, sums, the inspector and notes
// (docs/ENVELOPE-FUNDING.md, "Typing assignments" and "The inspector and notes").

/** The expense envelopes' names, in the order the table shows them */
const plannedNames = (page: Page) =>
  page
    .getByRole('button', { name: /^Planned for / })
    .evaluateAll((els) =>
      els.map((e) => /^Planned for (.*): /.exec(e.getAttribute('aria-label') ?? '')![1]),
    );

async function budgetOf(api: { call: (m: string, p: string) => Promise<unknown> }) {
  const groups = (await api.call('GET', `/budget/${thisMonth()}`)) as {
    categories: { name: string; budgeted: number; note: string }[];
  }[];
  return new Map(groups.flatMap((g) => g.categories).map((c) => [c.name, c]));
}

test.describe('budget keyboard and inspector', () => {
  test.beforeEach(async ({ api }) => {
    const account = await api.createAccount('Cash', 0);
    await api.createTransaction({
      accountId: account.id,
      date: isoDay(),
      amount: 300_000,
      categoryId: (await api.category('Paychecks')).id,
    });
  });

  test('sums, and the keys that move between envelopes', async ({ page, api }) => {
    await open(page, '/budget');
    // The filter keeps the same rows on screen while assigning reshapes a new budget's list;
    // the keys move only through rows it shows
    await page.getByRole('searchbox', { name: 'Find a category' }).fill('e');
    await expect(page.getByRole('button', { name: /^Planned for / }).first()).toBeVisible();
    const [a, b, c] = await plannedNames(page);
    const field = (name: string) => page.getByRole('textbox', { name: `Planned for ${name}` });

    // A sum is worked out; Down saves it and opens the next envelope
    await page.getByRole('button', { name: new RegExp(`^Planned for ${a}:`) }).click();
    await field(a).fill('100+50');
    await field(a).press('ArrowDown');
    await expect(field(b)).toBeFocused();
    await expect(page.getByRole('button', { name: `Planned for ${a}: $150` })).toBeVisible();
    // Tab saves and opens the next; Shift+Tab goes back without saving an unchanged amount
    await field(b).fill('150*2');
    await field(b).press('Tab');
    await expect(field(c)).toBeFocused();
    await expect(page.getByRole('button', { name: `Planned for ${b}: $300` })).toBeVisible();
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/api/budget/')) puts.push(r.url());
    });
    await field(c).press('Shift+Tab');
    await expect(field(b)).toBeFocused();
    await field(b).press('ArrowUp');
    await expect(field(a)).toBeFocused();
    expect(puts).toEqual([]);
    // A sum isn't relative to what was there: +50 is 50. Malformed ones stay open, unsaved
    await field(a).fill('+50');
    await field(a).press('Enter');
    await expect(page.getByRole('button', { name: `Planned for ${a}: $50` })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`^Planned for ${a}:`) }).click();
    for (const bad of ['*2', '100+', '10/0']) {
      await field(a).fill(bad);
      await field(a).press('ArrowDown');
      await expect(field(a)).toHaveAttribute('aria-invalid', 'true');
      await expect(field(a)).toBeFocused();
    }
    await field(a).press('Escape');
    await expect(field(a)).toBeHidden();
    const saved = await budgetOf(api);
    expect(saved.get(a)!.budgeted).toBe(5000);
    expect(saved.get(b)!.budgeted).toBe(30000);
    expect(saved.get(c)!.budgeted).toBe(0);
    // A negative assignment opens with its minus sign, so saving it unchanged keeps it
    await page.getByRole('button', { name: new RegExp(`^Planned for ${b}:`) }).click();
    await field(b).fill('-20');
    await field(b).press('Enter');
    await page.getByRole('button', { name: new RegExp(`^Planned for ${b}:`) }).click();
    await expect(field(b)).toHaveValue('-20.00');
    await field(b).press('Enter');
    await expect(page.getByRole('button', { name: `Planned for ${b}: -$20` })).toBeVisible();
  });

  test('the inspector shows the month, one envelope or several, with notes', async ({
    page,
    api,
  }) => {
    const month = thisMonth();
    const groceries = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    await api.call('PUT', `/budget/${month}/${groceries.id}`, { budgeted: 40000 });
    await api.call('PUT', `/budget/${month}/${rent.id}`, { budgeted: 150000 });
    await api.createTransaction({
      accountId: (await api.call('GET', '/accounts'))[0].id,
      date: isoDay(),
      amount: -12500,
      categoryId: groceries.id,
    });
    await open(page, '/budget');
    const inspector = page.getByRole('region', { name: 'Inspector' });

    // Nothing ticked: the month, matching the Total expenses row
    await expect(inspector).toContainText('Every envelope this month');
    const total = page.locator('tr').filter({ hasText: 'Total expenses' });
    await expect(total).toContainText('$1,900');
    await expect(inspector.locator('dd').nth(1)).toHaveText('$1,900');
    const monthNote = inspector.getByRole('textbox', { name: 'Note for this month' });
    await monthNote.fill('Bonus lands mid-month 🎉');
    await monthNote.blur();
    await expect(inspector.getByText('Note saved.')).toBeVisible();

    // One envelope: its figures and its own note
    await page.getByRole('checkbox', { name: 'Select Groceries' }).check();
    await expect(inspector.getByRole('heading', { name: 'Groceries' })).toBeVisible();
    await expect(inspector).toContainText('Activity-$125');
    await expect(inspector).toContainText('Available$275');
    const catNote = inspector.getByRole('textbox', { name: 'Note for Groceries' });
    await catNote.fill('Costco every other week');
    // Ticking another envelope saves the note being typed
    await page.getByRole('checkbox', { name: 'Select Rent / Mortgage' }).check();
    await expect(inspector.getByRole('heading', { name: '2 envelopes selected' })).toBeVisible();
    await expect(inspector).toContainText('Assigned$1,900');
    await expect(inspector).toContainText('Available$1,775');
    await expect
      .poll(async () => (await budgetOf(api)).get('Groceries')!.note)
      .toBe('Costco every other week');
    // Selecting moved no money
    expect((await api.call('GET', `/budget/${month}/summary`)).toBeBudgeted).toBe(110000);

    await inspector.getByRole('button', { name: 'Clear selection' }).click();
    await expect(inspector).toContainText('Every envelope this month');
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', {
        name: 'Note for this month',
      }),
    ).toHaveValue('Bonus lands mid-month 🎉');
    await page.getByRole('checkbox', { name: 'Select Groceries' }).check();
    await expect(
      page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', {
        name: 'Note for Groceries',
      }),
    ).toHaveValue('Costco every other week');
  });

  test('Fund targets from a selection funds only the selected envelopes', async ({ page, api }) => {
    const groceries = await api.category('Groceries');
    const rent = await api.category('Rent / Mortgage');
    for (const c of [groceries, rent])
      await api.call('PUT', `/budget/category/${c.id}/target`, { type: 'monthly', amount: 20000 });
    await open(page, '/budget');
    await page.getByRole('checkbox', { name: 'Select Groceries' }).check();
    await page
      .getByRole('region', { name: 'Inspector' })
      .getByRole('button', { name: 'Fund target' })
      .click();
    const preview = page.getByRole('region', { name: 'Target funding preview' });
    await expect(preview.getByRole('checkbox', { name: /Groceries/ })).toBeChecked();
    await expect(preview.getByRole('checkbox', { name: /Rent/ })).not.toBeChecked();
    await page.getByRole('button', { name: 'Apply $200' }).click();
    await expect(preview).toBeHidden();
    const saved = await budgetOf(api);
    expect(saved.get('Groceries')!.budgeted).toBe(20000);
    expect(saved.get('Rent / Mortgage')!.budgeted).toBe(0);
  });

  test('on a phone, the sheet takes a sum and keeps the envelope’s note', async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/budget');
    const card = page.getByTestId('budget-card').filter({ hasText: 'Groceries' });
    await card.getByRole('button', { name: /^Planned for Groceries/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Plan Groceries' });
    await sheet.getByRole('textbox', { name: 'Planned for Groceries' }).fill('20*3');
    await sheet.getByRole('textbox', { name: 'Note for Groceries' }).fill('Split with Sam');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();
    await expect
      .poll(async () => {
        const g = (await budgetOf(api)).get('Groceries')!;
        return [g.budgeted, g.note];
      })
      .toEqual([6000, 'Split with Sam']);
    // Changing a note back to what it was when the sheet opened, after saving something else,
    // is saved too: the sheet compares with its last save, not with the note it opened with
    await card.getByRole('button', { name: /^Planned for Groceries/ }).click();
    const amount = sheet.getByRole('textbox', { name: 'Planned for Groceries' });
    const note = sheet.getByRole('textbox', { name: 'Note for Groceries' });
    await note.fill('Temporary');
    await amount.click();
    await expect(sheet.getByText('Note saved.')).toBeVisible();
    await expect.poll(async () => (await budgetOf(api)).get('Groceries')!.note).toBe('Temporary');
    await note.fill('Split with Sam');
    await amount.click();
    await expect
      .poll(async () => (await budgetOf(api)).get('Groceries')!.note)
      .toBe('Split with Sam');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
    // Dismissing the sheet keeps a note typed in it
    await card.getByRole('button', { name: /^Planned for Groceries/ }).click();
    await sheet.getByRole('textbox', { name: 'Note for Groceries' }).fill('Split with Sam and Jo');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect
      .poll(async () => (await budgetOf(api)).get('Groceries')!.note)
      .toBe('Split with Sam and Jo');
  });
});
