import { test, expect, open, isoDay, thisMonth } from '../fixtures';

// UX audit AU-002: on a phone the Budget page put Ready to assign (with its Hold and Put the
// rest in buttons), the month's inspector and note, Move money and card payments all above
// the envelopes, with Income first among them, so assigning money began with scrolling. Now a
// compact Ready to assign comes first, then the envelopes you assign to, then income, and
// the inspector and moves after them. Hold and the calculation are in one labelled disclosure.

for (const width of [390, 320]) {
  test(`the envelopes you assign to are in view on opening the budget at ${width} px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const everyday = await api.createAccount('Everyday', 300_000);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await api.createTransaction({
      accountId: everyday.id,
      date: isoDay(),
      amount: -4_000,
      payeeName: 'Market',
      categoryId: groceries.id,
    } as never);
    await open(page, '/budget');

    // Ready to assign, compact, with the assign action beside it
    const ready = page.getByRole('status', { name: 'Ready to assign' });
    await expect(ready).toContainText('$2,500');
    await expect(page.getByRole('button', { name: 'Put the rest in…' })).toBeInViewport();

    // The first envelope's amount is on screen without scrolling
    const planned = page.getByRole('button', { name: /^Planned for / }).first();
    await expect(planned).toBeInViewport();
    const box = (await planned.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);

    // Envelopes come before income, and the month's inspector and moves after both
    const order = await page.evaluate(() => {
      const at = (el: Element | null) =>
        el ? Array.from(document.querySelectorAll('*')).indexOf(el) : -1;
      return {
        expenses: at(
          document.querySelector('section[aria-label="Fixed"], section[aria-label="Flexible"]'),
        ),
        income: at(document.querySelector('section[aria-label="Income"]')),
        note: at(document.querySelector('textarea')),
      };
    });
    expect(order.expenses).toBeGreaterThan(-1);
    expect(order.expenses).toBeLessThan(order.income);
    expect(order.income).toBeLessThan(order.note);

    // Hold money and the calculation are still there, in a labelled disclosure
    await expect(page.getByRole('button', { name: 'Hold money…' })).toBeHidden();
    await page.getByText('Hold money, and how this is worked out').click();
    await expect(page.getByRole('button', { name: 'Hold money…' })).toBeVisible();
    await expect(page.getByText('Cash in your budget accounts')).toBeVisible();
  });
}
