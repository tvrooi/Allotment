import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// UX audit AU-004: when a page's list couldn't be fetched, Goals said "Save for what
// matters", Payees "No payees yet", Rules offered the first rule and Files "No files yet", as
// if there were none. They now say it couldn't be loaded, keep what exists, and Retry fetches it.

/** Refuses GET requests for exactly `path` (e.g. /api/goals) until the returned function is called */
async function refuseList(page: Page, path: string) {
  let refusing = true;
  await page.route(
    (url) => url.pathname === path,
    (route) =>
      refusing && route.request().method() === 'GET'
        ? route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'The server refused this for the test.' }),
          })
        : route.continue(),
  );
  return () => {
    refusing = false;
  };
}

const cases = [
  {
    page: '/goals',
    path: '/api/goals',
    what: 'goals',
    empty: 'Save for what matters',
    seed: (api: any) => api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 }),
    record: 'Holiday',
  },
  {
    page: '/payees',
    path: '/api/payees',
    what: 'payees',
    empty: 'No payees yet',
    seed: (api: any) => api.call('POST', '/payees', { name: 'Corner Cafe' }),
    record: 'Corner Cafe',
  },
  {
    page: '/rules',
    path: '/api/rules',
    what: 'rules',
    empty: 'Let rules do the sorting',
    seed: (api: any) =>
      api.call('POST', '/rules', {
        actions: [{ type: 'set_notes', value: 'streaming' }],
        conditions: [{ field: 'payee_name', op: 'contains', value: 'Netflix' }],
      }),
    record: /Netflix/,
  },
];

for (const c of cases) {
  test(`a ${c.what} list that can't be loaded says so, and Retry loads it`, async ({
    page,
    api,
  }) => {
    await c.seed(api);
    const allow = await refuseList(page, c.path);
    await open(page, c.page);

    const problem = page.getByRole('alert').filter({ hasText: `Couldn’t load your ${c.what}.` });
    await expect(problem).toBeVisible();
    await expect(problem).toContainText('The server refused this for the test.');
    await expect(page.getByText(c.empty)).toHaveCount(0);

    allow();
    await problem.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText(c.record).first()).toBeVisible();
    await expect(problem).toHaveCount(0);
  });
}

test('a files list that can’t be loaded says so, and Retry loads it', async ({ page }) => {
  await open(page, '/files');
  await page.getByLabel('Add files: choose files').setInputFiles([
    {
      name: 'warranty.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n% a made-up warranty for tests\n'),
    },
  ]);
  await expect(page.getByRole('button', { name: 'Open warranty.pdf' })).toBeVisible();

  const allow = await refuseList(page, '/api/files');
  await page.reload();
  const problem = page.getByRole('alert').filter({ hasText: 'Couldn’t load your files.' });
  await expect(problem).toBeVisible();
  await expect(page.getByText('No files yet', { exact: false })).toHaveCount(0);

  allow();
  await problem.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: 'Open warranty.pdf' })).toBeVisible();
});

test('goals already on screen stay, with a note, when refreshing them fails', async ({
  page,
  api,
}) => {
  await api.call('POST', '/goals', { name: 'Holiday', targetAmount: 200_000 });
  await open(page, '/goals');
  await expect(page.getByText('Holiday', { exact: true })).toBeVisible();

  const allow = await refuseList(page, '/api/goals');
  // Goals refetch whenever the page is shown again; moving within the app keeps what's loaded
  const nav = page.getByRole('navigation').first();
  await nav.getByRole('link', { name: 'Payees' }).click();
  await nav.getByRole('link', { name: 'Goals' }).click();
  const note = page.getByRole('status').filter({ hasText: 'Couldn’t refresh your goals.' });
  await expect(note).toBeVisible();
  await expect(page.getByText('Holiday', { exact: true })).toBeVisible();

  allow();
  await note.getByRole('button', { name: 'Retry' }).click();
  await expect(note).toHaveCount(0);
  await expect(page.getByText('Holiday', { exact: true })).toBeVisible();
});
