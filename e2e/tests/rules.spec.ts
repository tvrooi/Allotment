import type { Page } from '@playwright/test';
import {
  test,
  expect,
  open,
  isoDay,
  categoryOption,
  chooseOption,
  fillDate,
  setToggle,
  type Api,
} from './fixtures';

// Rules: build one in the editor, preview and apply it to existing transactions, and
// check it runs on new ones.

async function seedCoffee(api: Api) {
  const checking = await api.createAccount('Checking', 100_000);
  for (const [day, amount] of [
    [-1, -450],
    [-2, -525],
    [-3, -610],
  ]) {
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(day),
      amount,
      payeeName: `Blue Bottle Coffee #${-day}`,
    });
  }
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(-1),
    amount: -9_900,
    payeeName: 'Hardware Store',
  });
  return checking;
}

async function buildCoffeeRule(page: Page, expectedMatches: number) {
  await page.getByRole('main').getByRole('button', { name: 'Add rule' }).click();
  const dialog = page.getByRole('dialog', { name: 'New rule' });
  await chooseOption(dialog.getByRole('button', { name: /Field$/ }), 'Payee name');
  await chooseOption(dialog.getByRole('button', { name: /Operator$/ }), 'contains');
  await dialog.getByRole('textbox', { name: 'Match value' }).fill('coffee');
  // Live preview of what the conditions match
  await expect(dialog).toContainText(
    expectedMatches
      ? new RegExp(`${expectedMatches} (matching )?transactions?`)
      : 'No transactions match yet',
  );
  await dialog.getByRole('button', { name: 'Choose a category…' }).click();
  await page.getByPlaceholder('Search categories...').fill('coffee');
  await categoryOption(page, /Coffee Shops/).click();
  return dialog;
}

test.describe('rules', () => {
  test('a new rule can be applied to existing transactions', async ({ page, api }) => {
    await seedCoffee(api);
    await open(page, '/rules');
    const dialog = await buildCoffeeRule(page, 3);
    await setToggle(
      dialog.getByRole('checkbox', { name: 'Apply to existing transactions after saving' }),
      true,
    );
    await dialog.getByRole('button', { name: 'Save rule' }).click();

    const apply = page.getByRole('dialog', { name: 'Apply rule to existing transactions' });
    const firstBox = apply.getByRole('checkbox', { name: 'Include this transaction' }).first();
    await expect(apply.getByRole('checkbox', { name: 'Include this transaction' })).toHaveCount(3);
    // Clicking the cell padding outside the checkbox label still toggles the row (WR-05)
    const firstCell = apply.locator('tbody tr').first().locator('td').first();
    await firstCell.click({ position: { x: 2, y: 2 } });
    await expect(firstBox).not.toBeChecked();
    await firstCell.click({ position: { x: 2, y: 2 } });
    await expect(firstBox).toBeChecked();
    // Leave one out via the checkbox itself (must not double-toggle)
    await setToggle(firstBox, false);
    await apply.getByRole('button', { name: 'Apply to 2 transactions' }).click();
    await expect(apply).toContainText('Updated 2 transactions');
    await apply.getByRole('button', { name: 'Done' }).click();

    const coffee = (await api.category('Coffee Shops')).id;
    const txs = await api.transactions();
    const categorized = txs.filter((t) => t.categoryId === coffee).map((t) => t.payeeName);
    expect(categorized).toHaveLength(2);
    expect(categorized.every((n: string) => n.includes('Coffee'))).toBe(true);
    expect(txs.find((t) => t.payeeName === 'Hardware Store').categoryId).toBeNull();
  });

  test('rules run on transactions entered by hand', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 100_000);
    await open(page, '/rules');
    const dialog = await buildCoffeeRule(page, 0);
    await dialog.getByRole('button', { name: 'Save rule' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('main')).toContainText('Coffee Shops');

    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Add Transaction' }).click();
    const form = page.getByRole('form', { name: 'New transaction' });
    await form.getByRole('combobox', { name: 'Payee' }).fill('Corner Coffee Co');
    // React Aria hide-outside: Tab closes the list (02-19 checkpoint decision, option 1)
    await form.getByRole('combobox', { name: 'Payee' }).press('Tab');
    await form.getByRole('textbox', { name: 'Outflow' }).fill('3.75');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByTestId('transaction-row').filter({ hasText: 'Corner Coffee Co' }),
    ).toContainText('Coffee Shops');
  });

  test('turning a rule off keeps its settings and position', async ({ page, api }) => {
    await api.createAccount('Checking');
    const common = { actions: [{ type: 'set_notes', value: 'x' }] };
    await api.call('POST', '/rules', {
      ...common,
      conditions: [{ field: 'payee_name', op: 'contains', value: 'first' }],
      sortOrder: 0,
    });
    const second = await api.call('POST', '/rules', {
      ...common,
      conditionsOp: 'or',
      conditions: [
        { field: 'payee_name', op: 'contains', value: 'a' },
        { field: 'notes', op: 'contains', value: 'b' },
      ],
      sortOrder: 1,
    });

    await open(page, '/rules');
    await page.getByRole('switch', { name: 'Disable rule' }).nth(1).click();
    await expect(page.getByRole('switch', { name: 'Enable rule' })).not.toBeChecked();

    const rules = await api.call<any[]>('GET', '/rules');
    expect(rules.map((r) => r.id)).toEqual([expect.any(String), second.id]);
    expect(rules[1]).toMatchObject({ enabled: false, conditionsOp: 'or', sortOrder: 1 });
  });

  test('deletes a rule', async ({ page, api }) => {
    await api.createAccount('Checking');
    await api.call('POST', '/rules', {
      conditions: [{ field: 'payee_name', op: 'is', value: 'Gym' }],
      actions: [{ type: 'set_notes', value: 'fitness' }],
    });
    await open(page, '/rules');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Delete rule' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByRole('button', { name: 'Add your first rule' })).toBeVisible();
    expect(await api.call('GET', '/rules')).toEqual([]);
  });

  test('split percent validates decimals from 0 to 100 and gates Save', async ({ page, api }) => {
    await api.createAccount('Checking', 100_000);
    await open(page, '/rules');
    await page.getByRole('main').getByRole('button', { name: 'Add rule' }).click();
    const dialog = page.getByRole('dialog', { name: 'New rule' });
    await dialog.getByRole('textbox', { name: 'Match value' }).fill('split-test');
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }), 'Split transaction');

    const percent = dialog.getByRole('textbox', { name: 'Split percentage' });
    const save = dialog.getByRole('button', { name: 'Save rule' });
    await expect(percent).toBeVisible();
    await expect(save).toBeEnabled();

    await percent.fill('100.5');
    await expect(dialog.getByRole('alert')).toHaveText('Enter a percentage from 0% to 100%.');
    await expect(save).toBeDisabled();

    await percent.fill('50.5');
    await expect(dialog.getByText('Enter a percentage from 0% to 100%.')).toHaveCount(0);
    await expect(save).toBeEnabled();

    await save.click();
    await expect(dialog).toBeHidden();

    const rules = await api.call<any[]>('GET', '/rules');
    expect(rules).toHaveLength(1);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'split',
      parts: [expect.objectContaining({ kind: 'percent', value: 50.5 }), expect.anything()],
    });
  });

  test('clearing split percent leaves the field empty rather than snapping to 0', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 100_000);
    await open(page, '/rules');
    await page.getByRole('main').getByRole('button', { name: 'Add rule' }).click();
    const dialog = page.getByRole('dialog', { name: 'New rule' });
    await dialog.getByRole('textbox', { name: 'Match value' }).fill('clear-test');
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }), 'Split transaction');

    const percent = dialog.getByRole('textbox', { name: 'Split percentage' });
    const save = dialog.getByRole('button', { name: 'Save rule' });
    await percent.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(percent).toHaveValue('');
    await expect(save).toBeDisabled();
  });

  test('removing an invalid split row leaves the next percent row clean and Save enabled (WR-01)', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 100_000);
    await open(page, '/rules');
    await page.getByRole('main').getByRole('button', { name: 'Add rule' }).click();
    const dialog = page.getByRole('dialog', { name: 'New rule' });
    await dialog.getByRole('textbox', { name: 'Match value' }).fill('remove-split-test');
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }), 'Split transaction');
    // Switch the second split part from Remainder to Percent (both now hold 50)
    await chooseOption(
      dialog.getByRole('button', { name: /Split amount type$/ }).nth(1),
      'Percent',
    );

    const percents = dialog.getByRole('textbox', { name: 'Split percentage' });
    const save = dialog.getByRole('button', { name: 'Save rule' });
    await expect(percents).toHaveCount(2);

    // Clear row 0's percent (invalid draft '') then remove row 0
    await percents.first().click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(save).toBeDisabled();

    await dialog.getByRole('button', { name: 'Remove split' }).first().click();
    await expect(percents).toHaveCount(1);
    await expect(percents.first()).toHaveValue('50');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(save).toBeEnabled();
  });

  test('editing a rule whose account was removed shows (deleted) and lets the owner pick a live one (WR-02)', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 100_000);
    const removed = await api.createAccount('Old Account', 0);
    await api.call('POST', '/rules', {
      conditions: [{ field: 'account', op: 'is', value: removed.id }],
      actions: [{ type: 'set_notes', value: 'migrated' }],
    });
    await api.call('DELETE', `/accounts/${removed.id}`);

    await open(page, '/rules');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Edit rule' });
    const accountBox = dialog.getByRole('combobox', { name: 'Account' });
    await expect(accountBox).toHaveValue('(deleted)');

    await accountBox.fill('Check');
    await page.getByRole('listbox').getByRole('option', { name: 'Checking', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save rule' }).click();
    await expect(dialog).toBeHidden();

    const rules = await api.call<any[]>('GET', '/rules');
    expect(rules[0].conditions).toEqual([{ field: 'account', op: 'is', value: checking.id }]);
  });

  test('rule editor shared controls: named fields, date, pickers and tag-list save intact', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 100_000);
    const savings = await api.createAccount('Savings', 50_000);
    const groceries = await api.category('Groceries');
    const payee = await api.call<{ id: string }>('POST', '/payees', { name: 'Corner Cafe' });
    const workTag = await api.call<{ id: string }>('POST', '/tags', { name: 'Work' });

    await open(page, '/rules');
    await page.getByRole('main').getByRole('button', { name: 'Add rule' }).click();
    const dialog = page.getByRole('dialog', { name: 'New rule' });

    // Combine conditions with 'any'
    await chooseOption(dialog.getByRole('button', { name: /How conditions combine$/ }), 'any');

    // Condition 1: Payee name contains (Match value)
    await dialog.getByRole('textbox', { name: 'Match value' }).fill('supermarket');

    // Condition 2: Direction (new accessible name 'Direction')
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(1), 'Inflow / outflow');
    await chooseOption(dialog.getByRole('button', { name: /Direction$/ }), 'Is an inflow');

    // Condition 3: Date via shared DatePicker (fillDate)
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(2), 'Date');
    await fillDate(dialog, 'Date', '2026-11-15');

    // Condition 4: Single-value Account via shared Combobox
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(3), 'Account');
    const accountBox = dialog.getByRole('combobox', { name: 'Account' });
    await accountBox.fill('Check');
    await page.getByRole('listbox').getByRole('option', { name: 'Checking', exact: true }).click();

    // Condition 5: Multi-value Account via OptionPicker (shared Input + Checkbox)
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(4), 'Account');
    await chooseOption(dialog.getByRole('button', { name: /Operator$/ }).nth(3), 'is one of');
    await dialog.getByRole('button', { name: 'Account: Choose one or more…' }).click();
    await dialog.getByRole('textbox', { name: 'Search options' }).fill('Sav');
    await setToggle(dialog.getByRole('checkbox', { name: 'Savings' }), true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    // Condition 6: Single-value Category via CategorySelectButton
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(5), 'Category');
    await dialog.getByRole('button', { name: 'Category: Choose…' }).click();
    await page.getByPlaceholder('Search categories...').fill('Groc');
    await categoryOption(page, /Groceries/).click();

    // Condition 7: Free-text list TagInput (shared Input, Enter adds)
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Operator$/ }).nth(5), 'is one of');
    const tagList = dialog.getByRole('textbox', { name: 'Match values' });
    await tagList.fill('Aldi');
    await tagList.press('Enter');
    await tagList.fill('Coles');
    await tagList.press('Enter');

    // Condition 8: Single-value Payee via MerchantSelect (WR-06)
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(7), 'Payee');
    const payeeBox = dialog.getByRole('combobox', { name: 'Payee' });
    await payeeBox.fill('Corner');
    await dialog
      .getByRole('listbox')
      .getByRole('option', { name: /Corner Cafe/ })
      .click();

    // Condition 9: Date between pair (Start date / End date)
    await dialog.getByRole('button', { name: 'Add condition' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Field$/ }).nth(8), 'Date');
    await chooseOption(dialog.getByRole('button', { name: /Operator$/ }).nth(7), 'is between');
    await fillDate(dialog, 'Start date', '2026-11-01');
    await fillDate(dialog, 'End date', '2026-11-30');

    // Action 1: Set notes (new accessible name 'Notes text')
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }).first(), 'Set notes');
    await dialog.getByRole('textbox', { name: 'Notes text' }).fill('weekly shop');

    // Action 2: Split transaction (Split percentage + new accessible name 'Split notes')
    await dialog.getByRole('button', { name: 'Add action' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }).nth(1), 'Split transaction');
    await dialog.getByRole('textbox', { name: 'Split percentage' }).fill('60');
    await dialog.getByRole('textbox', { name: 'Split notes' }).first().fill('food part');

    // Action 3: Add tag via shared Combobox
    await dialog.getByRole('button', { name: 'Add action' }).click();
    await chooseOption(dialog.getByRole('button', { name: /Action$/ }).nth(2), 'Add tag');
    const tagBox = dialog.getByRole('combobox', { name: 'Tag' });
    await tagBox.fill('Work');
    await page.getByRole('listbox').getByRole('option', { name: 'Work', exact: true }).click();

    await dialog.getByRole('button', { name: 'Save rule' }).click();
    await expect(dialog).toBeHidden();

    const rules = await api.call<any[]>('GET', '/rules');
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      conditionsOp: 'or',
      conditions: [
        { field: 'payee_name', op: 'contains', value: 'supermarket' },
        { field: 'direction', op: 'is', value: 'inflow' },
        { field: 'date', op: 'is', value: '2026-11-15' },
        { field: 'account', op: 'is', value: checking.id },
        { field: 'account', op: 'one_of', value: [savings.id] },
        { field: 'category', op: 'is', value: groceries.id },
        { field: 'payee_name', op: 'one_of', value: ['Aldi', 'Coles'] },
        { field: 'payee', op: 'is', value: payee.id },
        { field: 'date', op: 'between', value: ['2026-11-01', '2026-11-30'] },
      ],
      actions: [
        { type: 'set_notes', value: 'weekly shop' },
        {
          type: 'split',
          parts: [
            expect.objectContaining({ kind: 'percent', value: 60, notes: 'food part' }),
            expect.objectContaining({ kind: 'remainder' }),
          ],
        },
        { type: 'add_tag', value: workTag.id },
      ],
    });
  });
});
