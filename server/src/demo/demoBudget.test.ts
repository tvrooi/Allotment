import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { format, subMonths } from 'date-fns';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { logoSchema } from '../utils/logo.js';
import { budgetRouter } from '../routes/budget.js';
import { schedulesRouter } from '../routes/schedules.js';
import { buildDemoBudget } from './demoBudget.js';
import { loadDemoBudget } from './loadDemoBudget.js';
import { listTransferSuggestions } from '../services/transferService.js';

// The website demo's budget (see ../browser/README.md) has to look finished whatever day
// someone opens it: these check it for any "today".

const anyDay = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2035-12-31'),
  noInvalidDate: true,
});
const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

describe('the demo budget (property-based)', () => {
  it('is the same every time for the same day', () => {
    fc.assert(
      fc.property(anyDay, (today) => {
        expect(buildDemoBudget(today)).toEqual(buildDemoBudget(today));
      }),
      { numRuns: 20 },
    );
  });

  it('only has transactions from its history, up to today', () => {
    fc.assert(
      fc.property(anyDay, (today) => {
        const { transactions } = buildDemoBudget(today);
        const first = format(subMonths(today, 17), 'yyyy-MM');
        // The trip's flights were booked two months before the trip, still in the history
        for (const t of transactions) {
          expect(t.date <= ymd(today)).toBe(true);
          expect(t.date.slice(0, 7) >= first).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('keeps transfers paired and splits adding up, with nothing pointing nowhere', () => {
    fc.assert(
      fc.property(anyDay, (today) => {
        const demo = buildDemoBudget(today);
        const byId = new Map(demo.transactions.map((t) => [t.id, t]));
        expect(byId.size).toBe(demo.transactions.length);
        const accountIds = new Set(demo.accounts.map((a) => a.id));
        const payeeIds = new Set(demo.payees.map((p) => p.id));
        const categoryIds = new Set(demo.categories.map((c) => c.id));

        for (const t of demo.transactions) {
          expect(accountIds.has(t.accountId)).toBe(true);
          if (t.payeeId) expect(payeeIds.has(t.payeeId)).toBe(true);
          if (t.categoryId) expect(categoryIds.has(t.categoryId)).toBe(true);
          if (t.transferTransactionId) {
            const other = byId.get(t.transferTransactionId)!;
            expect(other.transferTransactionId).toBe(t.id);
            expect(other.amount + t.amount).toBe(0);
            expect(other.date).toBe(t.date);
          }
          if (t.isParent) {
            const parts = demo.transactions.filter((c) => c.parentTransactionId === t.id);
            expect(parts.length).toBeGreaterThan(1);
            expect(parts.reduce((s, c) => s + c.amount, 0)).toBe(t.amount);
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  it("is an Australian Up budget: every account in the budget's dollars, no exchange rates", () => {
    fc.assert(
      fc.property(anyDay, (today) => {
        const demo = buildDemoBudget(today);
        expect(demo.budgetSettings[0].currency).toBe('AUD');
        expect(demo.exchangeRates).toEqual([]);
        expect(demo.accounts.every((a) => !a.currency)).toBe(true);
        expect(demo.accounts.map((a) => a.name)).toEqual(
          expect.arrayContaining(['Spending', 'Rainy Day', 'Holiday', '2Up Spending']),
        );
      }),
      { numRuns: 10 },
    );
  });

  it("has no emoji: categories and goals use the app's icon names", () => {
    const demo = buildDemoBudget(new Date());
    for (const row of [...demo.categories, ...demo.goals]) {
      expect(row.icon, row.name).toMatch(/^[A-Z][A-Za-z0-9]+$/);
    }
    const emoji = /\p{Extended_Pictographic}/u;
    for (const t of demo.transactions) expect(t.notes ?? '').not.toMatch(emoji);
  });

  it('opens with nothing overspent and money ready to assign, whatever the day', () => {
    const onBudget = [
      'demo-acct-checking',
      'demo-acct-savings',
      'demo-acct-holiday',
      'demo-acct-card',
    ];
    fc.assert(
      fc.property(anyDay, (today) => {
        const demo = buildDemoBudget(today);
        const rows = demo.transactions.filter((t) => onBudget.includes(t.accountId));
        const income = new Set(['demo-cat-paychecks', 'demo-cat-interest', 'demo-cat-otherIncome']);
        const cash = rows.filter((t) => !t.parentTransactionId).reduce((s, t) => s + t.amount, 0);
        let envelopes = 0;
        const months = [...new Set(demo.budgetMonths.map((b) => b.month))].sort();
        for (const c of demo.categories.filter((c) => !income.has(c.id))) {
          let balance = 0;
          for (const month of months) {
            balance += demo.budgetMonths
              .filter((b) => b.categoryId === c.id && b.month === month)
              .reduce((s, b) => s + (b.budgeted ?? 0), 0);
            balance += rows
              .filter((t) => !t.isParent && t.categoryId === c.id && t.date.startsWith(month))
              .reduce((s, t) => s + t.amount, 0);
            expect(balance, `${c.name} ${month}`).toBeGreaterThanOrEqual(0);
          }
          envelopes += balance;
        }
        const uncategorised = rows
          .filter(
            (t) => !t.categoryId && !t.transferTransactionId && !t.isParent && !t.isAdjustment,
          )
          .reduce((s, t) => s + t.amount, 0);
        // Cash not in an envelope (less what still needs a category) is what's ready to assign
        expect(cash - envelopes + uncategorised).toBeGreaterThan(0);
      }),
      { numRuns: 25 },
    );
  });

  it('gives every account and payee a logo the app accepts', () => {
    const demo = buildDemoBudget(new Date());
    for (const row of [...demo.accounts, ...demo.payees]) {
      expect(row.logo, row.name).toBeTruthy();
      expect(logoSchema.safeParse(row.logo).success, row.name).toBe(true);
    }
  });
});

describe('the demo budget, loaded', () => {
  let server: Server;
  let base: string;
  // Loaded once, into this file's own in-memory database. As of the real today: match
  // suggestions and "Find recurring" look around the current date
  const today = new Date();

  beforeAll(async () => {
    migrate(db, { migrationsFolder: 'src/db/migrations' });
    loadDemoBudget(today);
    const app = express();
    app.use(express.json());
    app.use('/api/budget', budgetRouter);
    app.use('/api/schedules', schedulesRouter);
    server = await new Promise<Server>((r) => {
      const s = app.listen(0, '127.0.0.1', () => r(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(() => server.close());

  const get = async (path: string) => (await fetch(base + path)).json();

  it('reconciles historical resources and envelopes, disclosing overcommitments', async () => {
    for (let i = 0; i < 18; i++) {
      const month = format(subMonths(today, i), 'yyyy-MM');
      const summary = await get(`/budget/${month}/summary`);
      // Every dollar is in an envelope, taken by a later month, or ready to assign
      expect(summary.toBeBudgeted + summary.envelopes + summary.laterDeduction, month).toBe(
        summary.resources,
      );
      if (summary.toBeBudgeted < 0) expect(summary.resolved, month).toBe(false);
    }
  });

  it('pays its bills: every past occurrence is paid or skipped, except the one to review', async () => {
    const suggestions = await get('/schedules/match-suggestions');
    expect(suggestions.map((s: { scheduleId: string }) => s.scheduleId)).toEqual([
      'demo-schedule-donation',
    ]);
  });

  it('opens tidy: every transfer is linked, and one purchase waits for a category', () => {
    expect(listTransferSuggestions()).toEqual([]);
    const uncategorised = buildDemoBudget(today).transactions.filter(
      (t) =>
        !t.categoryId &&
        !t.transferTransactionId &&
        !t.isParent &&
        !t.isAdjustment &&
        ['demo-acct-checking', 'demo-acct-savings', 'demo-acct-holiday', 'demo-acct-card'].includes(
          t.accountId,
        ),
    );
    expect(uncategorised.map((t) => t.payeeName)).toEqual(['Parcel']);
  });

  it('has money ready to assign this month, not a shortfall', async () => {
    const summary = await get(`/budget/${format(today, 'yyyy-MM')}/summary`);
    expect(summary.toBeBudgeted).toBeGreaterThan(0);
  });

  it('leaves one subscription for "Find recurring" to spot', async () => {
    const { found } = await get('/schedules/discover');
    expect(found.map((f: { payeeId: string }) => f.payeeId)).toContain('demo-payee-tuneful');
  });
});
