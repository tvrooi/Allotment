import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  payees,
  rules,
  transactions,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { accountTransactionSum } from '../services/balances.js';
import { budgetGroups, fundingState } from '../services/budgetService.js';
import { annualOverview } from '../services/annualOverview.js';
import { insertNewTransaction } from '../services/ruleService.js';
import { exportRouter } from './export.js';
import { reportsRouter } from './reports.js';
import { rulesRouter } from './rules.js';
import { savedViewsRouter, tagsRouter } from './tags.js';
import { transactionsRouter } from './transactions.js';

// Phase 9 (docs/PHASE-9-DEVELOPMENT-PHASE.md): review, report visibility, tags and saved views.
// Mock data only.

const TODAY = '2026-10-22';
let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(accounts)
    .values({ id: 'mock', name: 'Mock account', type: 'checking', createdAt: '2026-01-01' })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'living', name: 'Living' },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'paychecks', name: 'Paychecks', groupId: 'income' },
      { id: 'groceries', name: 'Groceries', groupId: 'living' },
      { id: 'work', name: 'Work costs', groupId: 'living' },
    ])
    .run();
  db.insert(payees).values({ id: 'grocer', name: 'Mock grocer' }).run();
  db.insert(transactions)
    .values([
      { id: 'pay', accountId: 'mock', date: '2026-10-05', amount: 200000, categoryId: 'paychecks' },
      {
        id: 'groc',
        accountId: 'mock',
        date: '2026-10-07',
        amount: -12000,
        categoryId: 'groceries',
        payeeId: 'grocer',
        payeeName: 'Mock grocer',
      },
      { id: 'laptop', accountId: 'mock', date: '2026-10-08', amount: -30000, categoryId: 'work' },
    ])
    .run();
  db.insert(budgetMonths)
    .values({ id: 'b1', month: '2026-10', categoryId: 'work', budgeted: 30000 })
    .run();
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/saved-views', savedViewsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const send = async <T = any>(method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
};
const ids = async (query: string) =>
  (await send<{ id: string }[]>('GET', `/transactions?${query}`)).body.map((r) => r.id).sort();

/** Everything the budget sees, which hiding must never change */
const ledger = () => ({
  balance: accountTransactionSum('mock'),
  budget: budgetGroups('2026-10', TODAY).flatMap((g) => g.categories),
  funding: (({ balances: _b, revision: _r, ...rest }) => rest)(fundingState(TODAY)),
  year: annualOverview(2026, TODAY).groups,
});
const reports = async () => ({
  ie: (await send('GET', '/reports/income-vs-expenses?from=2026-10&to=2026-10')).body,
  byCategory: (await send('GET', '/reports/spending-by-category?from=2026-10&to=2026-10')).body,
  byPayee: (await send('GET', '/reports/spending-by-payee?from=2026-10&to=2026-10')).body,
  cashFlow: (await send('GET', '/reports/cash-flow?from=2026-10&to=2026-10')).body,
});

describe('hide from reports', () => {
  it('changes reports only, never balances, the budget or the annual overview', async () => {
    const before = ledger();
    const reportsBefore = await reports();
    expect(reportsBefore.ie[0]).toMatchObject({ income: 200000, expenseNet: -42000 });

    const hide = await send('PATCH', '/transactions/laptop/flags', { hiddenFromReports: true });
    expect(hide.status).toBe(200);
    const hidden = await reports();
    expect(hidden.ie[0]).toMatchObject({ income: 200000, expenseNet: -12000 });
    expect(hidden.byCategory.find((c: any) => c.categoryId === 'work')).toBeUndefined();
    expect(hidden.cashFlow[0].net).toBe(200000 - 12000);
    expect(ledger()).toEqual(before);
    // The register still lists it (it moved money), and its drill-down scope agrees with Cash Flow
    expect(await ids('from=2026-10-01&to=2026-10-31')).toContain('laptop');
    expect(await ids('from=2026-10-01&to=2026-10-31&budget_report=1')).not.toContain('laptop');
    expect(await ids('hidden=1')).toEqual(['laptop']);

    await send('PATCH', '/transactions/laptop/flags', { hiddenFromReports: false });
    expect(await reports()).toEqual(reportsBefore);
  });

  it('hides every part of a hidden split, and changes nothing on a split part directly', async () => {
    db.insert(transactions)
      .values([
        { id: 'split', accountId: 'mock', date: '2026-10-10', amount: -5000, isParent: 1 },
        {
          id: 'split-a',
          accountId: 'mock',
          date: '2026-10-10',
          amount: -2000,
          categoryId: 'groceries',
          parentTransactionId: 'split',
        },
        {
          id: 'split-b',
          accountId: 'mock',
          date: '2026-10-10',
          amount: -3000,
          categoryId: 'work',
          parentTransactionId: 'split',
        },
      ])
      .run();
    try {
      const before = (await reports()).ie[0].expenseNet;
      expect((await send('PATCH', '/transactions/split-a/flags', { reviewed: true })).status).toBe(
        400,
      );
      await send('PATCH', '/transactions/split/flags', { hiddenFromReports: true });
      expect((await reports()).ie[0].expenseNet).toBe(before + 5000);
      expect((await send('GET', '/transactions/summary?hidden=1')).body).toMatchObject({
        count: 1,
        leafCount: 2,
      });
    } finally {
      db.delete(transactions)
        .where(inArray(transactions.id, ['split', 'split-a', 'split-b']))
        .run();
    }
  });

  it('is allowed on a reconciled transaction, which keeps its amounts', async () => {
    db.update(transactions).set({ reconciled: 1 }).where(eq(transactions.id, 'groc')).run();
    try {
      const res = await send('PATCH', '/transactions/groc/flags', {
        reviewed: true,
        hiddenFromReports: true,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ amount: -12000, reconciled: 1, hiddenFromReports: 1 });
      expect(res.body.reviewedAt).toEqual(expect.any(String));
    } finally {
      db.update(transactions)
        .set({ reconciled: 0, reviewedAt: null, hiddenFromReports: 0 })
        .where(eq(transactions.id, 'groc'))
        .run();
    }
  });

  it('rejects unknown fields and unknown transactions', async () => {
    expect((await send('PATCH', '/transactions/groc/flags', { amount: 1 })).status).toBe(400);
    expect((await send('PATCH', '/transactions/nope/flags', { reviewed: true })).status).toBe(404);
  });
});

describe('review', () => {
  it('marks the confirmed selection, refuses a changed one and undoes exactly', async () => {
    db.update(transactions)
      .set({ reviewedAt: '2026-10-01T00:00:00.000Z' })
      .where(eq(transactions.id, 'pay'))
      .run();
    const selection = { from: '2026-10-01', to: '2026-10-31' };
    const done = await send('POST', '/transactions/review', {
      selection,
      reviewed: true,
      expectedCount: 3,
    });
    expect(done.status).toBe(200);
    expect(done.body.matched).toBe(3);
    // Already reviewed rows keep their time; only the others change
    expect(done.body.changes.map((c: any) => c.id).sort()).toEqual(['groc', 'laptop']);
    expect(await ids('reviewed=0&from=2026-10-01&to=2026-10-31')).toEqual([]);

    db.insert(transactions)
      .values({ id: 'late', accountId: 'mock', date: '2026-10-20', amount: -100 })
      .run();
    try {
      const stale = await send('POST', '/transactions/review', {
        selection,
        reviewed: false,
        expectedCount: 3,
      });
      expect(stale.status).toBe(409);
      expect(await ids('reviewed=1&from=2026-10-01&to=2026-10-31')).toEqual([
        'groc',
        'laptop',
        'pay',
      ]);
    } finally {
      db.delete(transactions).where(eq(transactions.id, 'late')).run();
    }

    const undo = await send('POST', '/transactions/review', { restore: done.body.changes });
    expect(undo.body).toEqual({ restored: 2 });
    const rows = db.select().from(transactions).all();
    expect(rows.find((r) => r.id === 'pay')?.reviewedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(rows.filter((r) => r.id !== 'pay').every((r) => r.reviewedAt === null)).toBe(true);
    db.update(transactions).set({ reviewedAt: null }).where(eq(transactions.id, 'pay')).run();
  });

  it('is never set by new transactions, imports or rules', async () => {
    db.insert(rules)
      .values({
        id: 'r-review',
        conditions: JSON.stringify([{ field: 'payee_name', op: 'contains', value: 'Imported' }]),
        actions: JSON.stringify([{ type: 'set_category', value: 'groceries' }]),
      })
      .run();
    try {
      const { transaction } = insertNewTransaction({
        accountId: 'mock',
        date: '2026-10-15',
        amount: -700,
        payeeId: null,
        payeeName: 'Imported shop',
        importedPayee: 'Imported shop',
        notes: null,
        categoryId: null,
        importedId: 'csv:1',
      });
      const row = db.select().from(transactions).where(eq(transactions.id, transaction.id)).get();
      expect(row).toMatchObject({
        categoryId: 'groceries',
        reviewedAt: null,
        hiddenFromReports: 0,
      });
      db.delete(transactions).where(eq(transactions.id, transaction.id)).run();
    } finally {
      db.delete(rules).where(eq(rules.id, 'r-review')).run();
    }
  });
});

describe('tags', () => {
  it('creates, assigns, filters and deletes tags without touching transactions', async () => {
    const holiday = await send('POST', '/tags', { name: 'Holiday', color: '#22c55e' });
    expect(holiday.status).toBe(201);
    expect((await send('POST', '/tags', { name: 'holiday' })).status).toBe(409);
    const tagId = holiday.body.id;

    db.insert(transactions)
      .values([
        { id: 'trip', accountId: 'mock', date: '2026-10-12', amount: -8000, isParent: 1 },
        {
          id: 'trip-a',
          accountId: 'mock',
          date: '2026-10-12',
          amount: -5000,
          categoryId: 'groceries',
          parentTransactionId: 'trip',
        },
        {
          id: 'trip-b',
          accountId: 'mock',
          date: '2026-10-12',
          amount: -3000,
          categoryId: 'work',
          parentTransactionId: 'trip',
        },
      ])
      .run();
    try {
      expect(
        (await send('PUT', '/transactions/trip/tags', { tagIds: [tagId, tagId] })).body,
      ).toEqual({ tagIds: [tagId] });
      await send('PUT', '/transactions/groc/tags', { tagIds: [tagId] });
      expect((await send('PUT', '/transactions/trip-a/tags', { tagIds: [] })).status).toBe(400);
      expect((await send('PUT', '/transactions/groc/tags', { tagIds: ['nope'] })).status).toBe(400);

      // The split shows once; its parts count in the summary and export
      expect(await ids(`tag_ids=${tagId}`)).toEqual(['groc', 'trip']);
      expect((await send('GET', `/transactions/summary?tag_ids=${tagId}`)).body).toMatchObject({
        count: 2,
        leafCount: 3,
        moneyOut: 20000,
      });
      const csv = await (await fetch(`${base}/export/transactions/csv?tag_ids=${tagId}`)).text();
      const lines = csv.trim().split('\n');
      expect(lines[0].endsWith('Reconciled,Tags,Reviewed,Hidden from reports')).toBe(true);
      expect(lines.slice(1)).toHaveLength(3);
      expect(lines.slice(1).every((l) => l.endsWith(',No,Holiday,No,No'))).toBe(true);
      // The register row carries its tags
      const row = (await send<any[]>('GET', '/transactions?from=2026-10-12&to=2026-10-12')).body[0];
      expect(row.tagIds).toEqual([tagId]);

      expect((await send('GET', '/tags')).body).toEqual([
        expect.objectContaining({ name: 'Holiday', count: 2 }),
      ]);
      expect((await send('DELETE', `/tags/${tagId}`)).status).toBe(204);
      expect(await ids(`tag_ids=${tagId}`)).toEqual([]);
      expect(db.select().from(transactions).where(eq(transactions.id, 'trip')).get()).toBeTruthy();
    } finally {
      db.delete(transactions)
        .where(inArray(transactions.id, ['trip', 'trip-a', 'trip-b']))
        .run();
      await send('PUT', '/transactions/groc/tags', { tagIds: [] });
    }
  });

  it('adds tags from rules on new and existing transactions and never removes one', async () => {
    const tag = (await send('POST', '/tags', { name: 'Work trip' })).body;
    const keep = (await send('POST', '/tags', { name: 'Keep me' })).body;
    db.insert(rules)
      .values({
        id: 'r-tag',
        conditions: JSON.stringify([{ field: 'notes', op: 'contains', value: 'conference' }]),
        actions: JSON.stringify([{ type: 'add_tag', value: tag.id }]),
      })
      .run();
    try {
      const { transaction } = insertNewTransaction({
        accountId: 'mock',
        date: '2026-10-16',
        amount: -900,
        payeeId: null,
        payeeName: 'Taxi',
        importedPayee: null,
        notes: 'conference taxi',
        categoryId: null,
        importedId: null,
      });
      expect(await ids(`tag_ids=${tag.id}`)).toEqual([transaction.id]);

      db.insert(transactions)
        .values({
          id: 'hotel',
          accountId: 'mock',
          date: '2026-10-17',
          amount: -20000,
          notes: 'conference hotel',
        })
        .run();
      await send('PUT', '/transactions/hotel/tags', { tagIds: [keep.id] });
      const preview = await send('POST', '/rules/preview', { scope: 'all', ruleIds: ['r-tag'] });
      expect(preview.status).toBe(200);
      const applied = await send('POST', '/rules/apply', {
        scope: 'all',
        ruleIds: ['r-tag'],
        transactionIds: ['hotel', transaction.id],
      });
      expect(applied.status).toBe(200);
      expect(await ids(`tag_ids=${tag.id}`)).toEqual(['hotel', transaction.id].sort());
      expect(await ids(`tag_ids=${keep.id}`)).toEqual(['hotel']);
      // A rule that adds a tag is accepted by the rules API
      const saved = await send('POST', '/rules', {
        conditions: [],
        actions: [{ type: 'add_tag', value: tag.id }],
      });
      expect(saved.status).toBe(201);
      db.delete(rules).where(eq(rules.id, saved.body.id)).run();
      db.delete(transactions)
        .where(inArray(transactions.id, ['hotel', transaction.id]))
        .run();
    } finally {
      db.delete(rules).where(eq(rules.id, 'r-tag')).run();
      await send('DELETE', `/tags/${tag.id}`);
      await send('DELETE', `/tags/${keep.id}`);
    }
  });
});

describe('saved views', () => {
  it('stores a valid register query and rejects anything else', async () => {
    const view = await send('POST', '/saved-views', {
      name: 'Big grocery runs',
      query: 'range=all&payee_ids=grocer&direction=debit&min_amount=10001',
    });
    expect(view.status).toBe(201);
    const reopened = new URLSearchParams(view.body.query);
    reopened.delete('range');
    expect(await ids(reopened.toString())).toEqual(['groc']);

    for (const query of [
      'range=decade',
      'range=all&range=this-month',
      'limit=5',
      'account_id=mock',
      'min_amount=-1',
      'from=2026-02-30',
      'search=a&search=b',
    ]) {
      expect((await send('POST', '/saved-views', { name: 'Bad', query })).status, query).toBe(400);
    }
    const renamed = await send('PUT', `/saved-views/${view.body.id}`, { name: 'Groceries' });
    expect(renamed.body).toMatchObject({ name: 'Groceries', query: view.body.query });
    expect((await send('GET', '/saved-views')).body).toHaveLength(1);
    expect((await send('DELETE', `/saved-views/${view.body.id}`)).status).toBe(204);
  });
});

describe('backups', () => {
  it('round-trips tags, views and flags in format 12 and restores format 11 unchanged', async () => {
    const tag = (await send('POST', '/tags', { name: 'Renovation' })).body;
    await send('PUT', '/transactions/laptop/tags', { tagIds: [tag.id] });
    await send('PATCH', '/transactions/laptop/flags', { reviewed: true, hiddenFromReports: true });
    await send('POST', '/saved-views', { name: 'Reno', query: `range=all&tag_ids=${tag.id}` });

    const backup = (await send('GET', '/export/backup')).body;
    expect(backup.version).toBe(19);
    expect(backup.tags).toHaveLength(1);
    expect(backup.transactionTags).toEqual([{ transactionId: 'laptop', tagId: tag.id }]);
    expect(backup.savedViews).toHaveLength(1);

    const restore = (body: unknown) =>
      fetch(`${base}/export/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await restore(backup)).status).toBe(200);
    const laptop = db.select().from(transactions).where(eq(transactions.id, 'laptop')).get()!;
    expect(laptop).toMatchObject({ hiddenFromReports: 1, reviewedAt: expect.any(String) });
    expect(await ids(`tag_ids=${tag.id}`)).toEqual(['laptop']);

    // A format 11 backup has none of it: everything comes back unreviewed, visible, untagged
    const old = { ...backup, version: 11 };
    delete old.tags;
    delete old.transactionTags;
    delete old.savedViews;
    old.transactions = backup.transactions.map((t: any) => {
      const { reviewedAt: _r, hiddenFromReports: _h, ...rest } = t;
      return rest;
    });
    expect((await restore(old)).status).toBe(200);
    expect(
      db
        .select()
        .from(transactions)
        .all()
        .every((t) => t.reviewedAt === null && t.hiddenFromReports === 0),
    ).toBe(true);
    expect((await send('GET', '/tags')).body).toEqual([]);

    const badView = { ...backup, savedViews: [{ ...backup.savedViews[0], query: 'limit=1' }] };
    expect((await restore(badView)).status).toBe(400);
  });
});
