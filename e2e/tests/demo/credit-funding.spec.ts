import { test, expect } from '@playwright/test';
test('card payment reserves and ordering survive backup restore in the offline demo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/demo/#/budget');
  await expect(page.getByRole('region', { name: 'Demo' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const call = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(`${path}: ${JSON.stringify(data)}`);
      return data;
    };
    const today = new Date().toISOString().slice(0, 10),
      month = today.slice(0, 7);
    const cash = await call('POST', '/accounts', {
      name: 'Demo payment cash',
      type: 'checking',
      startingBalance: 1000000,
    });
    const card = await call('POST', '/accounts', {
      name: 'Demo reserve card',
      type: 'credit',
      startingBalance: -20000,
    });
    const group = (await call('GET', '/categories')).find((g: { isIncome: number }) => !g.isIncome);
    const food = await call('POST', '/categories', {
      name: 'Demo card food',
      groupId: group.id,
      budgetType: 'flexible',
    });
    const setup = await call('POST', `/budget/cards/${card.id}/setup/preview`, {});
    await call('POST', `/budget/cards/${card.id}/setup/apply`, { revision: setup.revision });
    const funding = await call('POST', `/budget/cards/${card.id}/funding/preview`, {
      amount: 10000,
    });
    await call('POST', `/budget/cards/${card.id}/funding/apply`, {
      amount: 10000,
      revision: funding.revision,
    });
    await call('PUT', `/budget/${month}/${food.id}`, { budgeted: 10000 });
    await call('POST', '/transactions', {
      accountId: card.id,
      amount: -8000,
      date: today,
      categoryId: food.id,
    });
    const out = await call('POST', '/transactions', {
        accountId: cash.id,
        amount: -8000,
        date: today,
      }),
      into = await call('POST', '/transactions', { accountId: card.id, amount: 8000, date: today });
    await call('POST', '/transactions/transfers/link', {
      transactionId: out.id,
      otherTransactionId: into.id,
    });
    const before = await call('GET', `/budget/${month}/summary`),
      backup = await call('GET', '/export/backup');
    await call('POST', '/export/restore', backup);
    const after = await call('GET', `/budget/${month}/summary`),
      groups = await call('GET', `/budget/${month}`);
    return {
      before: before.paymentReserved,
      after: after.paymentReserved,
      version: backup.version,
      available: groups
        .flatMap((g: { categories: unknown[] }) => g.categories)
        .find((c: { id: string }) => c.id === food.id).balance,
    };
  });
  expect(result).toEqual({ before: 10000, after: 10000, version: 8, available: 2000 });
  await page.getByRole('button', { name: 'Card payment funding', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Card payment funding', exact: true }),
  ).toContainText('Demo reserve card');
  expect(errors).toEqual([]);
});
