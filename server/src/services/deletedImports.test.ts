import { beforeAll, describe, expect, it, vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';

// Audit F-14: a row a bank sync brought in stays deleted after the owner deletes it, for every
// synced provider, not only Up. SimpleFIN is mocked; made-up data only.
const bank = {
  errors: [],
  connections: [],
  accounts: [
    {
      id: 'sf-acct',
      name: 'Mock Bank',
      currency: 'AUD',
      balance: '-12.00',
      'balance-date': 1_790_000_000,
      transactions: [
        { id: 't1', posted: 1_789_000_000, amount: '-5.00', description: 'Mock Cafe' },
        { id: 't2', posted: 1_789_100_000, amount: '-7.00', description: 'Mock Grocer' },
      ],
    },
  ],
};
vi.mock('./simplefinService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./simplefinService.js')>()),
  fetchAccounts: vi.fn(async () => bank),
}));

const { db } = await import('../db/index.js');
const { accounts, simplefinAccountMappings, simplefinConnections, transactions, upDeletedImports } =
  await import('../db/schema.js');
const { syncSimplefinConnection } = await import('./simplefinSyncService.js');
const { deleteTransactionByOwner, deletedSyncedImports, isSyncedImport } =
  await import('./transactionHelpers.js');

const { restoreDeletedImport } = await import('./deletedImportRestore.js');

beforeAll(() => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  db.insert(accounts).values({ id: 'acct', name: 'Everyday', type: 'checking' }).run();
  db.insert(simplefinConnections)
    .values({
      id: 'conn',
      accessUrl: 'https://user:pass@bridge.example/simplefin',
      connectionName: 'Mock',
    })
    .run();
  db.insert(simplefinAccountMappings)
    .values({
      id: 'map',
      connectionId: 'conn',
      simplefinAccountId: 'sf-acct',
      accountId: 'acct',
      simplefinAccountName: 'Mock Bank',
    })
    .run();
});

const imported = () =>
  db
    .select({ importedId: transactions.importedId })
    .from(transactions)
    .where(eq(transactions.accountId, 'acct'))
    .all()
    .map((t) => t.importedId)
    .sort();

describe('deleted bank imports (audit F-14)', () => {
  it('knows which imports a sync would bring back', () => {
    for (const id of ['up:a:1', 'eb:m:1', 'simplefin:a:1', 'plaid:1'])
      expect(isSyncedImport(id)).toBe(true);
    expect(isSyncedImport('csv:abc')).toBe(false);
    expect(isSyncedImport(null)).toBe(false);
  });

  it('keeps a deleted SimpleFIN row deleted until the owner restores it', async () => {
    await syncSimplefinConnection('conn');
    expect(imported()).toEqual(['simplefin:sf-acct:t1', 'simplefin:sf-acct:t2']);
    const row = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'simplefin:sf-acct:t1'))
      .get()!;
    deleteTransactionByOwner(row);
    await syncSimplefinConnection('conn');
    expect(imported()).toEqual(['simplefin:sf-acct:t2']);
    expect(deletedSyncedImports()).toEqual([
      expect.objectContaining({
        accountId: 'acct',
        accountName: 'Everyday',
        importedId: 'simplefin:sf-acct:t1',
        amount: -500,
        description: 'Mock Cafe',
      }),
    ]);
    // Up's are Up review's to restore
    db.insert(upDeletedImports)
      .values({ accountId: 'acct', importedId: 'up:x:1', deletedAt: new Date().toISOString() })
      .run();
    expect(deletedSyncedImports()).toHaveLength(1);
    expect(restoreDeletedImport('acct', 'up:x:1')).toBeNull();
    // Recreated from what was kept, even when the bank no longer sends it (Plaid's cursor,
    // Enable Banking's window): here the bank has dropped it
    const sent = bank.accounts[0].transactions.splice(0, 1);
    expect(restoreDeletedImport('acct', 'simplefin:sf-acct:t1')).toEqual({ recreated: true });
    expect(imported()).toEqual(['simplefin:sf-acct:t1', 'simplefin:sf-acct:t2']);
    const back = db
      .select()
      .from(transactions)
      .where(eq(transactions.importedId, 'simplefin:sf-acct:t1'))
      .get()!;
    expect(back).toMatchObject({ amount: -500, date: row.date, payeeName: 'Mock Cafe' });
    // ...and the bank sending it again never adds it twice
    bank.accounts[0].transactions.unshift(...sent);
    await syncSimplefinConnection('conn');
    expect(imported()).toEqual(['simplefin:sf-acct:t1', 'simplefin:sf-acct:t2']);
    expect(restoreDeletedImport('acct', 'simplefin:sf-acct:t1')).toBeNull();
    // An older deletion with no details kept is only forgotten
    db.insert(upDeletedImports)
      .values({ accountId: 'acct', importedId: 'plaid:old', deletedAt: new Date().toISOString() })
      .run();
    expect(restoreDeletedImport('acct', 'plaid:old')).toEqual({ recreated: false });
  });
});
