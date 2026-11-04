import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  categories,
  categoryGroups,
  payees,
  transactions,
  upAccountMappings,
  upConnections,
  upDeletedImports,
} from '../db/schema.js';
import { upRouter } from './up.js';
import { transactionsRouter } from './transactions.js';
import { syncUp } from '../services/upSyncService.js';
import type { UpTransaction } from '../services/upTransactions.js';
import { startUpMock, upMockTransaction, UP_TEST_TOKEN } from '../test/upMock.js';

// Audit F-16 (docs/AUDIT-2026-11.md): Up sync as properties over generated histories, through
// the Up mock and the real routes. Syncing twice equals syncing once, the order Up lists rows in
// changes nothing, and a sync after deletes and edits keeps both while importing only what is
// new. Held rows never import and Up's transfer pairs are never linked silently (CLAUDE.md).

const RUNS = Number(process.env.PROPERTY_RUNS ?? 20);
const TIMEOUT = Math.max(120_000, RUNS * 3_000);
const UP_ACCOUNTS = ['spending', 'saver'] as const;

let mock: Awaited<ReturnType<typeof startUpMock>>;
let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  mock = await startUpMock();
  process.env.FLYBUDGET_UP_API = mock.base;
  const app = express();
  app.use(express.json());
  app.use('/up', upRouter);
  app.use('/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await mock.close();
  server.close();
  delete process.env.FLYBUDGET_UP_API;
});

const call = (path: string, data?: unknown, method = 'POST') =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });

// --- Generated Up histories -----------------------------------------------------------------

/** Up's own transaction shape (upTransactions.ts), which the mock serves as it is */
type UpRow = UpTransaction;
type History = Record<(typeof UP_ACCOUNTS)[number], UpRow[]>;

const when = (dayIndex: number, hour: number) => {
  const d = new Date(Date.UTC(2026, 8, 1 + dayIndex, hour));
  return `${d.toISOString().slice(0, 19)}+10:00`;
};
const aud = (valueInBaseUnits: number) => ({ currencyCode: 'AUD' as const, valueInBaseUnits });

const plainArb = fc.record({
  kind: fc.constant('plain' as const),
  account: fc.constantFrom(...UP_ACCOUNTS),
  amount: fc.integer({ min: -90_000, max: 90_000 }).filter((n) => n !== 0),
  status: fc.constantFrom('SETTLED', 'SETTLED', 'SETTLED', 'HELD'),
  day: fc.integer({ min: 0, max: 59 }),
  hour: fc.integer({ min: 0, max: 23 }),
  cashback: fc.option(fc.integer({ min: 1, max: 2_000 }), { nil: null }),
  category: fc.option(fc.constantFrom('groceries', 'restaurants-and-cafes', 'fuel', 'new-slug'), {
    nil: null,
  }),
});
const transferArb = fc.record({
  kind: fc.constant('transfer' as const),
  from: fc.constantFrom(...UP_ACCOUNTS),
  amount: fc.integer({ min: 1, max: 50_000 }),
  day: fc.integer({ min: 0, max: 59 }),
  hour: fc.integer({ min: 0, max: 23 }),
});
const opsArb = fc.array(
  fc.oneof({ weight: 4, arbitrary: plainArb }, { weight: 1, arbitrary: transferArb }),
  {
    minLength: 1,
    maxLength: 20,
  },
);

type Ops = typeof opsArb extends fc.Arbitrary<infer T> ? T : never;
/** Up ids: `u3` (or `u3-saver` for one side of a transfer) is the fourth generated row */
const opIndex = (id: string) => Number(id.slice(1).split('-')[0]);

function history(ops: Ops, prefix = 'u'): History {
  const out: History = { spending: [], saver: [] };
  ops.forEach((o, i) => {
    const id = `${prefix}${i}`;
    if (o.kind === 'plain') {
      const row = upMockTransaction(id, o.amount, o.status, o.account) as unknown as UpRow;
      const at = when(o.day, o.hour);
      row.attributes = {
        ...row.attributes,
        description: `Shop ${i % 5}`,
        createdAt: at,
        settledAt: o.status === 'SETTLED' ? at : null,
        cashback: o.cashback ? { description: 'Cashback', amount: aud(o.cashback) } : null,
      };
      if (o.category)
        row.relationships = { ...row.relationships, category: { data: { id: o.category } } };
      out[o.account].push(row);
    } else {
      const to = o.from === 'spending' ? 'saver' : 'spending';
      const at = when(o.day, o.hour);
      for (const [account, amount, other] of [
        [o.from, -o.amount, to],
        [to, o.amount, o.from],
      ] as const) {
        const row = upMockTransaction(
          `${id}-${account}`,
          amount,
          'SETTLED',
          account,
        ) as unknown as UpRow;
        row.attributes = {
          ...row.attributes,
          description: 'Transfer',
          createdAt: at,
          settledAt: at,
        };
        row.relationships = { ...row.relationships, transferAccount: { data: { id: other } } };
        out[account].push(row);
      }
    }
  });
  return out;
}
/** One ordering for every list compared here */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Rows Allotment should hold: settled ones, plus a cashback row each */
const expectedImports = (h: History) =>
  UP_ACCOUNTS.flatMap((a) =>
    h[a]
      .filter((t) => t.attributes.status === 'SETTLED')
      .flatMap((t) => [
        `up:${a}:${t.id}`,
        ...(t.attributes.cashback ? [`up:${a}:${t.id}:cashback`] : []),
      ]),
  ).sort(byText);

function serve(h: History) {
  mock.setMode('normal');
  for (const a of UP_ACCOUNTS) mock.setHistory(a, h[a]);
}

async function connect(h: History) {
  for (const table of [
    upConnections,
    upAccountMappings,
    upDeletedImports,
    transactions,
    payees,
    accounts,
    budgetSettings,
  ])
    db.delete(table).run();
  serve(h);
  expect((await call('/up/setup', { accessToken: UP_TEST_TOKEN })).ok).toBe(true);
  const mapped = await call('/up/map-accounts', {
    mappings: UP_ACCOUNTS.map((upAccountId) => ({ upAccountId, action: 'create' })),
  });
  expect(mapped.ok).toBe(true);
  const first = await syncUp();
  expect(first.errors).toEqual([]);
  return first;
}

/** Everything a sync could change, keyed by Up's ids so separate imports compare */
function snapshot() {
  const local = new Map(
    db
      .select()
      .from(upAccountMappings)
      .all()
      .map((m) => [m.accountId, m.upAccountId]),
  );
  const rows = db.select().from(transactions).all();
  const importedOf = new Map(rows.map((t) => [t.id, t.importedId]));
  return {
    accounts: db
      .select()
      .from(accounts)
      .all()
      .map((a) => ({ up: local.get(a.id), startingBalance: a.startingBalance, name: a.name }))
      .sort((a, b) => byText(String(a.up), String(b.up))),
    rows: rows
      .map((t) => ({
        importedId: t.importedId,
        up: local.get(t.accountId),
        date: t.date,
        amount: t.amount,
        payeeName: t.payeeName,
        notes: t.notes,
        categoryId: t.categoryId,
        transfer: t.transferTransactionId ? importedOf.get(t.transferTransactionId) : null,
        reconciled: t.reconciled,
        isParent: t.isParent,
      }))
      .sort((a, b) => byText(String(a.importedId), String(b.importedId))),
  };
}

describe('Up sync properties (audit F-16)', () => {
  it(
    'syncing twice equals syncing once; held rows never import; transfers are never linked silently',
    async () => {
      await fc.assert(
        fc.asyncProperty(opsArb, async (ops) => {
          const h = history(ops);
          await connect(h);
          const once = snapshot();
          expect(once.rows.map((r) => r.importedId)).toEqual(expectedImports(h));
          expect(once.rows.every((r) => r.transfer === null)).toBe(true);
          const again = await syncUp();
          expect(again.errors).toEqual([]);
          expect(again.added).toBe(0);
          expect(snapshot()).toEqual(once);
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'the order Up lists rows in changes nothing',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          opsArb.chain((ops) =>
            fc.tuple(
              fc.constant(ops),
              fc.shuffledSubarray(
                ops.map((_, i) => i),
                { minLength: ops.length },
              ),
            ),
          ),
          async ([ops, order]) => {
            const h = history(ops);
            await connect(h);
            const listed = snapshot();
            const listedIn = (rows: UpRow[]) =>
              [...rows].sort((a, b) => order.indexOf(opIndex(a.id)) - order.indexOf(opIndex(b.id)));
            const reordered: History = { spending: listedIn(h.spending), saver: listedIn(h.saver) };
            await connect(reordered);
            expect(snapshot()).toEqual(listed);
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'a sync after deletes and edits keeps both, and imports only what is new, once',
    async () => {
      db.delete(categories).run();
      db.delete(categoryGroups).run();
      db.insert(categoryGroups).values({ id: 'mine', name: 'Mine' }).run();
      db.insert(categories).values({ id: 'chosen', name: 'Chosen', groupId: 'mine' }).run();
      await fc.assert(
        fc.asyncProperty(
          opsArb,
          opsArb,
          fc.array(fc.constantFrom('delete', 'edit', 'keep'), { minLength: 1, maxLength: 40 }),
          async (ops, newOps, actions) => {
            const h = history(ops);
            await connect(h);
            const rows = db.select().from(transactions).all();
            const deleted = new Set<string>();
            const edited = new Set<string>();
            for (const [i, t] of rows.entries()) {
              const action = actions[i % actions.length];
              if (action === 'delete') {
                expect((await call(`/transactions/${t.id}`, undefined, 'DELETE')).status).toBe(204);
                deleted.add(t.importedId!);
              } else if (action === 'edit') {
                const res = await call(
                  `/transactions/${t.id}`,
                  { categoryId: 'chosen', notes: 'Mine' },
                  'PUT',
                );
                expect(res.ok, await res.clone().text()).toBe(true);
                edited.add(t.importedId!);
              }
            }
            const before = snapshot();
            // Up adds rows since the last sync, and keeps returning the deleted ones
            const added = history(newOps, 'n');
            const next: History = {
              spending: [...h.spending, ...added.spending],
              saver: [...h.saver, ...added.saver],
            };
            serve(next);
            // New rows here may be dated anywhere in history: a full sweep finds every one (an
            // incremental sync covers recent rows and open holds; upIncremental.test.ts)
            const result = await syncUp({ full: true });
            expect(result.errors).toEqual([]);
            expect(result.added).toBe(expectedImports(added).length);
            const after = snapshot();
            const byId = new Map(after.rows.map((r) => [r.importedId, r]));
            for (const id of deleted) expect(byId.has(id), id).toBe(false);
            for (const id of edited)
              expect(byId.get(id), id).toMatchObject({ categoryId: 'chosen', notes: 'Mine' });
            // Everything that was there is unchanged; the new rows are there once each
            expect(after.rows.filter((r) => !r.importedId!.includes(':n'))).toEqual(before.rows);
            expect(
              after.rows.filter((r) => r.importedId!.includes(':n')).map((r) => r.importedId),
            ).toEqual(expectedImports(added));
            // A further sync changes nothing
            await syncUp();
            expect(snapshot()).toEqual(after);
            // And restoring keeps working from the remembered deletes
            expect(db.select().from(upDeletedImports).all().length).toBe(deleted.size);
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
