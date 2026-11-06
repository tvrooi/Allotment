import { test, expect, open } from './fixtures';
import { UP_TEST_TOKEN } from '../mockUp';
import { UP_MOCK_PORT } from '../ports';
import { freshUpWindow } from './upWindow';

// Up's Saver transfers: Up names the other account of a transfer, so those pairs are listed on
// their own under "Up reported these". Sync links nothing; the owner reviews and links them.

type Suggestion = {
  outflow: { id: string; accountId: string };
  inflow: { id: string };
  reported: boolean;
};

test('lists the transfers Up reported for review, and links only what the owner approves', async ({
  page,
  api,
}) => {
  test.slow();
  await fetch(`http://127.0.0.1:${UP_MOCK_PORT}/__mock/rich`, { method: 'POST' });
  await freshUpWindow(page, api);
  await api.call('POST', '/up/setup', { accessToken: UP_TEST_TOKEN });
  await api.call('POST', '/up/map-accounts', {
    mappings: [
      { upAccountId: 'spending', action: 'create' },
      { upAccountId: 'saver', action: 'create' },
    ],
  });
  await api.call('POST', '/up/sync');

  // Nothing was linked by the sync
  expect((await api.transactions()).every((t) => !t.transferTransactionId)).toBe(true);
  const saver = (await api.accounts()).find((a) => a.name === 'Up Saver')!;
  const all = await api.call<Suggestion[]>(
    'GET',
    `/transactions/transfers/suggestions?account_id=${saver.id}`,
  );
  const reported = all.filter((s) => s.reported);
  expect(reported.length).toBeGreaterThan(0);

  await open(page, `/accounts/${saver.id}`);
  const banner = page.getByRole('region', { name: 'Possible transfers' });
  await expect(banner).toContainText(`${reported.length} reported by Up`);
  await banner.getByRole('button', { name: 'Review' }).click();
  const dialog = page.getByRole('dialog', { name: 'Possible transfers' });
  const upList = dialog.getByRole('region', { name: 'Up reported these' });
  await expect(upList.getByRole('listitem')).toHaveCount(reported.length);

  // The owner unticks all but the first reported pair, then links it
  const boxes = upList.getByRole('checkbox');
  for (let i = 1; i < reported.length; i++) await boxes.nth(i).uncheck();
  const others = dialog.getByRole('region', { name: 'Other possible transfers' });
  if (await others.count()) {
    for (const box of await others.getByRole('checkbox').all()) await box.uncheck();
  }
  await dialog.getByRole('button', { name: 'Link 1 transfer' }).click();
  await expect(dialog).toBeHidden();
  await expect(banner).toContainText('Linked 1 transfer.');

  const linked = (await api.transactions()).filter((t) => t.transferTransactionId);
  expect(linked.map((t) => t.id).sort()).toEqual(
    [reported[0].outflow.id, reported[0].inflow.id].sort(),
  );
});
