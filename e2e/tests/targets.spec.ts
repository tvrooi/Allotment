import { test, expect, open, isoDay, thisMonth, chooseOption, typeAmount } from './fixtures';

for (const phone of [false, true])
  test(`category targets suggest funding that is applied only after review${phone ? ' on a phone' : ''}`, async ({
    page,
    api,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await api.createAccount('Target cash', 50000);
    const insurance = await api.category('Groceries');
    await api.call('PUT', `/budget/category/${insurance.id}/target`, {
      type: 'monthly',
      amount: 80000,
    });
    await open(page, `/budget/category/${insurance.id}`);
    const form = page.getByRole('form', { name: 'Category target' });
    await expect(form).toContainText('Needs $800 more');
    // Unfocused, the amount reads as money
    await expect(form.getByLabel('Target amount')).toHaveValue('$800');
    // The shared Select: a listbox trigger on desktop, a native select on a phone
    await chooseOption(
      phone
        ? form.getByRole('combobox', { name: 'Target type' })
        : form.getByRole('button', { name: /Target type$/ }),
      'Refill to balance',
    );
    await typeAmount(form.getByLabel('Target amount'), '300');
    await form.getByRole('button', { name: 'Save target' }).click();
    await expect(form).toContainText('Needs $300 more');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);

    await open(page, '/budget');
    if (phone) {
      await page.getByRole('button', { name: 'More budget actions' }).click();
      await page.getByRole('menuitem', { name: 'Fund targets (1)' }).click();
    } else {
      await page.getByRole('button', { name: 'Assign', exact: true }).click();
      await page.getByRole('menuitem', { name: /Fund targets \(1\)/ }).click();
    }
    const preview = page.getByRole('region', { name: 'Target funding preview' });
    await expect(preview).toContainText('$500 is ready to assign today');
    await expect(preview).toContainText('assign $300');
    expect((await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted).toBe(0);
    await preview.getByRole('button', { name: 'Apply $300' }).click();
    await expect(preview).toBeHidden();
    await expect
      .poll(async () => (await api.call('GET', `/budget/${thisMonth()}/summary`)).totalBudgeted)
      .toBe(30000);
    await expect(page.getByRole('button', { name: /Fund targets/ })).toHaveCount(0);
    if (!phone) {
      // Nothing underfunded: no menu, just the one Auto-assign action
      await expect(page.getByRole('button', { name: 'Assign', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Auto-assign…' })).toBeVisible();
    }
    await expect(page.getByText('Target funded').first()).toBeVisible();
  });

// D-14: the cycle is a bounded whole number; a value outside 1 to 60 is named, not clamped
test('a recurring target repeats every 1 to 60 months', async ({ page, api }) => {
  const bill = await api.category('Rent / Mortgage');
  await api.call('PUT', `/budget/category/${bill.id}/target`, {
    type: 'recurring',
    amount: 60000,
    dueDate: isoDay(30),
    cycleMonths: 6,
  });
  /** The saved target's cycle and amount, as the server reports them */
  const saved = async () => {
    const groups = await api.call<
      {
        categories: {
          id: string;
          target: { cycleMonths?: number; amount: number } | null;
        }[];
      }[]
    >('GET', `/budget/${thisMonth()}`);
    const target = groups.flatMap((g) => g.categories).find((c) => c.id === bill.id)?.target;
    return { cycleMonths: target?.cycleMonths, amount: target?.amount };
  };
  await open(page, `/budget/category/${bill.id}`);
  const form = page.getByRole('form', { name: 'Category target' });
  const cycle = form.getByLabel('Repeats every (months)');
  const save = form.getByRole('button', { name: 'Save target' });
  const range = form.getByText('Enter a whole number from 1 to 60.');
  await expect(cycle).toHaveValue('6');
  for (const bad of ['61', '0', '1.5']) {
    await cycle.fill(bad);
    await expect(range).toBeVisible();
    await expect(save).toBeDisabled();
  }
  await cycle.fill('12');
  await expect(range).toHaveCount(0);
  await expect(save).toBeEnabled();
  // Enter in the amount saves what was just typed, as the old field did
  const amount = form.getByLabel('Target amount');
  await amount.click();
  await expect(amount).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('700');
  await page.keyboard.press('Enter');
  await expect.poll(saved).toEqual({ cycleMonths: 12, amount: 70000 });
});

// A typed negative amount is refused, never saved as its positive (Enter and click alike)
test('a negative target amount is refused', async ({ page, api }) => {
  const food = await api.category('Groceries');
  await api.call('PUT', `/budget/category/${food.id}/target`, { type: 'monthly', amount: 80000 });
  const savedAmount = async () => {
    const groups = await api.call<
      { categories: { id: string; target: { amount: number } | null }[] }[]
    >('GET', `/budget/${thisMonth()}`);
    return groups.flatMap((g) => g.categories).find((c) => c.id === food.id)?.target?.amount;
  };
  await open(page, `/budget/category/${food.id}`);
  const form = page.getByRole('form', { name: 'Category target' });
  const amount = form.getByLabel('Target amount');
  await amount.click();
  await expect(amount).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('-50');
  await page.keyboard.press('Enter');
  await expect(form.getByRole('alert')).toHaveText('Enter a target amount above zero.');
  await form.getByRole('button', { name: 'Save target' }).click();
  await expect(form.getByRole('alert')).toHaveText('Enter a target amount above zero.');
  expect(await savedAmount()).toBe(80000);
});

// A due date with one segment cleared is not a date: Save target waits, and never sends the old one
test('a half-cleared due date keeps Save target unavailable', async ({ page, api }) => {
  const bill = await api.category('Rent / Mortgage');
  await api.call('PUT', `/budget/category/${bill.id}/target`, {
    type: 'by-date',
    amount: 60000,
    dueDate: isoDay(30),
  });
  await open(page, `/budget/category/${bill.id}`);
  const form = page.getByRole('form', { name: 'Category target' });
  const save = form.getByRole('button', { name: 'Save target' });
  await expect(save).toBeEnabled();
  const day = form
    .getByRole('group', { name: 'Due date', exact: true })
    .locator('[data-type="day"]');
  await day.click();
  await expect(day).toBeFocused();
  for (let i = 0; i < 4 && (await day.getAttribute('data-placeholder')) === null; i++)
    await day.press('Backspace');
  await expect(day).toHaveAttribute('data-placeholder', 'true');
  // Unavailable while the segment is being edited, and after leaving the field
  await expect(save).toBeDisabled();
  await form.getByRole('heading', { name: 'Target' }).click();
  await expect(save).toBeDisabled();
});
