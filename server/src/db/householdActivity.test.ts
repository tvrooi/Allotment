import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Migration 0074 (SPL-04) on a database that already holds a household: additive, so the rows
// stay and the log starts empty. Mock data only.

const MIGRATIONS = 'src/db/migrations';

describe('migration 0074 household_activity', () => {
  it('adds the log to a populated database without touching the household', () => {
    // Everything before 0074, as an existing install has it
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'activity-migrations-'));
    fs.cpSync(MIGRATIONS, folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const full = structuredClone(journal);
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0074');
    fs.writeFileSync(journalPath, JSON.stringify(journal));

    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const old = drizzle(sqlite);
    migrate(old, { migrationsFolder: folder });
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'household_activity'").all(),
    ).toEqual([]);
    sqlite
      .prepare("INSERT INTO household_groups (id, name, currency) VALUES ('g', 'Flat', 'AUD')")
      .run();
    sqlite
      .prepare(
        "INSERT INTO household_people (id, group_id, name, is_self) VALUES ('p', 'g', 'Me', 1)",
      )
      .run();

    fs.writeFileSync(journalPath, JSON.stringify(full));
    migrate(old, { migrationsFolder: folder });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM household_groups').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM household_people').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM household_activity').get()).toEqual({ n: 0 });

    // The log goes with its household, and a line outlives the entry it names
    sqlite
      .prepare(
        "INSERT INTO household_activity (id, group_id, time, kind, event_id, summary) VALUES ('a', 'g', '2026-11-05T00:00:00.000Z', 'removed', 'gone', 'Removed')",
      )
      .run();
    expect(sqlite.prepare('SELECT source FROM household_activity').get()).toEqual({
      source: 'owner',
    });
    sqlite.prepare("DELETE FROM household_groups WHERE id = 'g'").run();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM household_activity').get()).toEqual({ n: 0 });
    fs.rmSync(folder, { recursive: true, force: true });
  });
});
