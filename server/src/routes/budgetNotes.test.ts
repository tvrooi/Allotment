import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  budgetMonthNotes,
  budgetMonths,
  categories,
  categoryGroups,
  categoryNotes,
} from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { fundingRevision } from '../services/budgetService.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';
import { budgetRouter } from './budget.js';

// BUD-10: notes on a month and on a category (docs/ENVELOPE-FUNDING.md, "Notes")

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/budget', budgetRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
type Group = { categories: { id: string; note: string }[] };
const noteOf = async (month: string, categoryId: string) =>
  ((await call('GET', `/budget/${month}`)).body as Group[])
    .flatMap((g) => g.categories)
    .find((c) => c.id === categoryId)?.note;

beforeEach(() => {
  for (const table of [budgetMonthNotes, categoryNotes, budgetMonths, categories, categoryGroups])
    db.delete(table).run();
  db.insert(categoryGroups).values({ id: 'expense', name: 'Expenses' }).run();
  db.insert(categories)
    .values([
      { id: 'food', name: 'Food', groupId: 'expense' },
      { id: 'fuel', name: 'Fuel', groupId: 'expense' },
    ])
    .run();
});

describe('budget notes', () => {
  it('saves a month note, keeps Unicode, and clears it when emptied', async () => {
    expect((await call('GET', '/budget/2026-11/note')).body).toEqual({
      month: '2026-11',
      note: '',
    });
    const text = '  Christmas 🎄 — dîner chez Zoë, 東京  ';
    const saved = await call('PUT', '/budget/2026-11/note', { note: text });
    expect(saved.status).toBe(200);
    expect(saved.body.note).toBe(text.trim());
    expect((await call('GET', '/budget/2026-11/note')).body.note).toBe(text.trim());
    // Another month has its own
    expect((await call('GET', '/budget/2026-12/note')).body.note).toBe('');
    await call('PUT', '/budget/2026-11/note', { note: '   ' });
    expect(db.select().from(budgetMonthNotes).all()).toHaveLength(0);
  });

  it('keeps a category note from month to month, beside the budget figures', async () => {
    expect(
      (await call('PUT', '/budget/category/food/note', { note: 'Costco run 🛒' })).status,
    ).toBe(200);
    expect(await noteOf('2026-11', 'food')).toBe('Costco run 🛒');
    expect(await noteOf('2027-03', 'food')).toBe('Costco run 🛒');
    expect(await noteOf('2026-11', 'fuel')).toBe('');
  });

  it('refuses an unknown category, a note too long, and a body without a note', async () => {
    expect((await call('PUT', '/budget/category/nope/note', { note: 'x' })).status).toBe(404);
    expect((await call('PUT', '/budget/2026-11/note', { note: 'x'.repeat(2001) })).status).toBe(
      400,
    );
    expect(
      (await call('PUT', '/budget/category/food/note', { note: 'x'.repeat(2001) })).status,
    ).toBe(400);
    expect((await call('PUT', '/budget/2026-11/note', {})).status).toBe(400);
    expect((await call('PUT', '/budget/2026-13/note', { note: 'x' })).status).toBe(400);
    expect(db.select().from(budgetMonthNotes).all()).toHaveLength(0);
    expect(db.select().from(categoryNotes).all()).toHaveLength(0);
  });

  it('moves no money: no assignment is written and the funding revision stays', async () => {
    const before = fundingRevision();
    await call('PUT', '/budget/2026-11/note', { note: 'Pay day moved' });
    await call('PUT', '/budget/category/food/note', { note: 'Shared with Sam' });
    expect(fundingRevision()).toBe(before);
    expect(db.select().from(budgetMonths).all()).toHaveLength(0);
  });

  it('goes with its category when the category is deleted', async () => {
    await call('PUT', '/budget/category/food/note', { note: 'Gone soon' });
    db.delete(categories).where(eq(categories.id, 'food')).run();
    expect(db.select().from(categoryNotes).all()).toHaveLength(0);
  });

  it('survives a backup and restore, and an older backup restores with none', async () => {
    await call('PUT', '/budget/2026-11/note', { note: 'Month 📝' });
    await call('PUT', '/budget/category/food/note', { note: 'Envelope 📝' });
    const backup = JSON.parse(JSON.stringify(createBackup()));
    expect(backup.budgetMonthNotes).toHaveLength(1);
    expect(backup.categoryNotes).toHaveLength(1);
    await call('PUT', '/budget/2026-11/note', { note: '' });
    await call('PUT', '/budget/category/food/note', { note: '' });
    restoreBackup(parseBackup(backup));
    expect((await call('GET', '/budget/2026-11/note')).body.note).toBe('Month 📝');
    expect(await noteOf('2026-11', 'food')).toBe('Envelope 📝');
    delete backup.budgetMonthNotes;
    delete backup.categoryNotes;
    backup.version = 28;
    restoreBackup(parseBackup(backup));
    expect((await call('GET', '/budget/2026-11/note')).body.note).toBe('');
    expect(await noteOf('2026-11', 'food')).toBe('');
  });
});
