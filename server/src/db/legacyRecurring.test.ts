import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Migration 0078 drops the legacy recurring_transactions table and
// transactions.recurring_transaction_id, which 0011 copied into schedules and kept. On a database
// that still has rows in both, every transaction and schedule stays. Mock data only.

const MIGRATIONS = 'src/db/migrations';

/** A migrations folder holding every migration before 0078, and the full journal to restore */
function before0078() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-recurring-'));
  fs.cpSync(MIGRATIONS, folder, { recursive: true });
  const journalPath = path.join(folder, 'meta', '_journal.json');
  const full = fs.readFileSync(journalPath, 'utf8');
  const journal = JSON.parse(full);
  journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0078');
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return { folder, applyAll: () => fs.writeFileSync(journalPath, full) };
}

const has = (sqlite: Database.Database, name: string) =>
  sqlite.prepare('SELECT 1 FROM sqlite_master WHERE name = ?').get(name) !== undefined;
const columns = (sqlite: Database.Database) =>
  (sqlite.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]).map(
    (c) => c.name,
  );

describe('migration 0078 drop legacy recurring', () => {
  it('drops the table and column on a populated database and keeps every transaction', () => {
    const { folder, applyAll } = before0078();
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const old = drizzle(sqlite);
    migrate(old, { migrationsFolder: folder });
    expect(has(sqlite, 'recurring_transactions')).toBe(true);
    expect(columns(sqlite)).toContain('recurring_transaction_id');

    // As an install from before 0011 has it: a legacy item, its copy in schedules, a transaction
    // pointing at both, and one pointing at neither
    sqlite
      .prepare(
        "INSERT INTO accounts (id, name, type, starting_balance) VALUES ('a', 'Everyday', 'checking', 0)",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO recurring_transactions (id, title, amount, frequency, start_date, account_id) VALUES ('r', 'Rent', -50000, 'monthly', '2026-01-01', 'a')",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO schedules (id, name, amount, recurrence_type, start_date, account_id) VALUES ('r', 'Rent', -50000, 'monthly', '2026-01-01', 'a')",
      )
      .run();
    const insertTx = sqlite.prepare(
      "INSERT INTO transactions (id, account_id, date, amount, payee_name, recurring_transaction_id, schedule_id) VALUES (?, 'a', ?, ?, ?, ?, ?)",
    );
    insertTx.run('t1', '2026-10-01', -50000, 'Landlord', 'r', 'r');
    insertTx.run('t2', '2026-10-02', -1250, 'Cafe', null, null);
    const kept = (cols: string) =>
      sqlite.prepare(`SELECT ${cols} FROM transactions ORDER BY id`).all();
    const transactionsBefore = kept('id, account_id, date, amount, payee_name, schedule_id');
    const schedulesBefore = sqlite.prepare('SELECT * FROM schedules').all();

    applyAll();
    migrate(old, { migrationsFolder: folder });
    expect(has(sqlite, 'recurring_transactions')).toBe(false);
    expect(has(sqlite, 'transactions_recurring_idx')).toBe(false);
    expect(columns(sqlite)).not.toContain('recurring_transaction_id');
    expect(kept('id, account_id, date, amount, payee_name, schedule_id')).toEqual(
      transactionsBefore,
    );
    // Every value kept; later additive migrations may add columns to schedules
    expect(sqlite.prepare('SELECT * FROM schedules').all()).toMatchObject(schedulesBefore);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    // The other indexes on transactions are untouched
    expect(has(sqlite, 'idx_transactions_schedule')).toBe(true);

    // Applying the migrations again changes nothing
    migrate(old, { migrationsFolder: folder });
    expect(kept('id, schedule_id')).toEqual([
      { id: 't1', schedule_id: 'r' },
      { id: 't2', schedule_id: null },
    ]);
    // Transactions still save, and schedules still link to them
    sqlite
      .prepare(
        "INSERT INTO transactions (id, account_id, date, amount, payee_name, schedule_id) VALUES ('t3', 'a', '2026-11-01', -50000, 'Landlord', 'r')",
      )
      .run();
    expect(sqlite.prepare("SELECT schedule_id FROM transactions WHERE id = 't3'").get()).toEqual({
      schedule_id: 'r',
    });
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('runs on a new database', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS });
    expect(has(sqlite, 'recurring_transactions')).toBe(false);
    expect(columns(sqlite)).not.toContain('recurring_transaction_id');
  });
});
