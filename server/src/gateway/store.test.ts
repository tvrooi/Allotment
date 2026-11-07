import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import {
  GatewayStore,
  MAX_CODE_TRIES,
  MAX_EMAILS_PER_DAY,
  NOTIFIED_CODE_TTL_MS,
  nameKey,
} from './store.js';

// The gateway's own records (docs/MULTI-USER-PLAN.md): made-up people only.

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-people-'));
let n = 0;
const fresh = () => new GatewayStore(path.join(dir, `people-${n++}.db`));
const person = (s: GatewayStore, name = 'Edward') =>
  s.addPerson({ name, isAdmin: false, dbPath: `/x/${name}${n}.db`, keyPath: '/x/key' });

afterEach(() => vi.useRealTimers());

describe('gateway store', () => {
  it('matches names ignoring case and spacing, and keeps them unique', () => {
    const s = fresh();
    const p = person(s, '  Edward   King ');
    expect(p.name).toBe('Edward King');
    expect(s.personByName('edward king')?.id).toBe(p.id);
    expect(nameKey('EDWARD  KING')).toBe('edward king');
    expect(() => person(s, 'edward king')).toThrow();
  });

  it('uses a code once, and stops it after too many wrong tries', () => {
    const s = fresh();
    const p = person(s);
    const code = s.issueCode(p.id, 'reset', 60_000, true);
    expect(code).toMatch(/^\d{6}$/);
    expect(s.useCode(p.id, 'reset', code)).toBe(true);
    expect(s.useCode(p.id, 'reset', code)).toBe(false);

    const again = s.issueCode(p.id, 'reset', 60_000, true);
    const wrong = again === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_CODE_TRIES; i++) expect(s.useCode(p.id, 'reset', wrong)).toBe(false);
    // Locked: even the right code no longer works
    expect(s.useCode(p.id, 'reset', again)).toBe(false);
  });

  it('expires codes and sessions, and never stores them as given', () => {
    const s = fresh();
    const p = person(s);
    const code = s.issueCode(p.id, 'invite', 60_000);
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    // Dashes, spaces and case don't matter
    const typed = s.issueCode(p.id, 'reset', 60_000);
    expect(s.useCode(p.id, 'reset', typed.toLowerCase().replace(/-/g, ' '))).toBe(true);
    const token = s.createSession(p.id, 'test');
    const raw = JSON.stringify([
      s.db.prepare('select * from codes').all(),
      s.db.prepare('select * from sessions').all(),
    ]);
    expect(raw).not.toContain(code.replace(/-/g, ''));
    expect(raw).not.toContain(token);
    expect(s.personForSession(token)?.id).toBe(p.id);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(s.personForSession(token)).toBeUndefined();
    expect(s.useCode(p.id, 'invite', code.toLowerCase().replace(/-/g, ' '))).toBe(false);
  });

  it('signs a person out everywhere on a new password, except the session that set it', () => {
    const s = fresh();
    const p = person(s);
    const a = s.createSession(p.id, 'a');
    const b = s.createSession(p.id, 'b');
    s.setPassword(p.id, 'scrypt$hash', a);
    expect(s.personForSession(a)?.id).toBe(p.id);
    expect(s.personForSession(b)).toBeUndefined();
    s.setDisabled(p.id, true);
    expect(s.personForSession(a)).toBeUndefined();
  });

  it('saves a phone or email address only once its code comes back, to that person', () => {
    const s = fresh();
    const p = person(s);
    const other = person(s, 'Sam');
    const code = s.issueDestinationCode(p.id, 'email', 'edward@example.com');
    expect(code).toMatch(/^\d{6}$/);
    // Nothing is saved yet, and the code is stored only as a hash
    expect(s.person(p.id)?.email).toBeNull();
    expect(JSON.stringify(s.db.prepare('select * from destination_codes').all())).not.toContain(
      code,
    );
    // Not someone else's, nor for the other kind of destination
    expect(s.confirmDestination(other.id, 'email', code)).toBeNull();
    expect(s.confirmDestination(p.id, 'phone', code)).toBeNull();
    expect(s.confirmDestination(p.id, 'email', code)).toBe('edward@example.com');
    expect(s.person(p.id)?.email).toBe('edward@example.com');
    expect(s.person(other.id)?.email).toBeNull();
    // Used up
    expect(s.confirmDestination(p.id, 'email', code)).toBeNull();

    // A new phone: the one saved stays until the new one is confirmed
    s.confirmDestination(p.id, 'phone', s.issueDestinationCode(p.id, 'phone', 'mobile_app_old'));
    const next = s.issueDestinationCode(p.id, 'phone', 'mobile_app_new');
    const wrong = next === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_CODE_TRIES; i++)
      expect(s.confirmDestination(p.id, 'phone', wrong)).toBeNull();
    expect(s.confirmDestination(p.id, 'phone', next)).toBeNull();
    expect(s.person(p.id)?.notifyService).toBe('mobile_app_old');

    // Expired
    const late = s.issueDestinationCode(p.id, 'phone', 'mobile_app_new');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + NOTIFIED_CODE_TTL_MS + 1000);
    expect(s.confirmDestination(p.id, 'phone', late)).toBeNull();
    vi.useRealTimers();

    s.removeDestination(p.id, 'email');
    expect(s.person(p.id)).toMatchObject({ email: null, notifyService: 'mobile_app_old' });
    s.setChannel(p.id, 'codes', 'phone');
    s.setChannel(p.id, 'reminders', 'email');
    expect(s.person(p.id)).toMatchObject({ codeChannel: 'phone', reminderChannel: 'email' });
  });

  it('sends at most one code a minute to each destination, and ten emails a day', () => {
    const s = fresh();
    const p = person(s);
    const t = Date.parse('2026-11-07T00:00:00Z');
    expect(s.takeCodeSends(p.id, 'reset', ['phone', 'email'], t)).toEqual(['phone', 'email']);
    // Within the minute: no new reset code at all, so the one sent still works
    expect(s.takeCodeSends(p.id, 'reset', ['phone'], t + 30_000)).toBeNull();
    expect(s.takeCodeSends(p.id, 'reset', ['email', 'log'], t + 30_000)).toBeNull();
    expect(s.takeCodeSends(p.id, 'reset', ['log'], t + 30_000)).toEqual(['log']);
    // Confirming an address is its own code
    expect(s.takeCodeSends(p.id, 'confirm', ['email'], t + 30_000)).toEqual(['email']);
    expect(s.takeCodeSends(p.id, 'confirm', ['email'], t + 40_000)).toBeNull();
    // Ten emails a day across both: 2 so far
    for (let i = 3; i <= MAX_EMAILS_PER_DAY; i++)
      expect(s.takeCodeSends(p.id, 'reset', ['email'], t + i * 61_000)).toEqual(['email']);
    // The day's emails are used: a phone still gets its code, an email alone is refused
    const later = t + (MAX_EMAILS_PER_DAY + 1) * 61_000;
    expect(s.takeCodeSends(p.id, 'confirm', ['email'], later)).toBeNull();
    expect(s.takeCodeSends(p.id, 'reset', ['phone', 'email'], later)).toEqual(['phone']);
    // Another person has limits of their own
    expect(s.takeCodeSends(person(s, 'Sam').id, 'reset', ['email'], later)).toEqual(['email']);
    // A day after the first, emails can go again
    expect(s.takeCodeSends(p.id, 'reset', ['email'], t + 24 * 60 * 60 * 1000 + 1)).toEqual([
      'email',
    ]);
  });

  it('upgrades a people.db from before email codes, keeping every row, and only once', () => {
    const file = path.join(dir, `people-${n++}.db`);
    // The tables as up.127 made them, with a person, a session and a code
    const old = new Database(file);
    old.exec(`
      create table people (
        id text primary key, name text not null, name_key text not null unique,
        password_hash text, is_admin integer not null default 0, notify_service text,
        db_path text not null unique, key_path text not null,
        disabled integer not null default 0, revoke_tokens integer not null default 0,
        created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      create table sessions (
        id text primary key, person_id text not null references people(id) on delete cascade,
        user_agent text, created_at text not null, expires_at text not null, last_used_at text
      );
      create table codes (
        person_id text not null references people(id) on delete cascade,
        kind text not null check (kind in ('invite', 'reset')), code_hash text not null,
        expires_at text not null, tries integer not null default 0,
        primary key (person_id, kind)
      );
      insert into people (id, name, name_key, password_hash, is_admin, notify_service, db_path, key_path)
        values ('aaaaaaaaaaaa', 'Edward', 'edward', 'scrypt$x', 1, 'mobile_app_edward', '/x/a.db', '/x/a.key');
      insert into sessions values ('h', 'aaaaaaaaaaaa', 'ua', '2026-11-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', null);
      insert into codes values ('aaaaaaaaaaaa', 'reset', 'hash', '2099-01-01T00:00:00.000Z', 2);
    `);
    old.close();
    const rows = (db: Database.Database) =>
      ['people', 'sessions', 'codes'].map((t) => db.prepare(`select * from ${t}`).all());

    const s = new GatewayStore(file);
    expect(s.person('aaaaaaaaaaaa')).toMatchObject({
      name: 'Edward',
      isAdmin: true,
      notifyService: 'mobile_app_edward',
      email: null,
      codeChannel: null,
      reminderChannel: null,
      hasPassword: true,
    });
    const [people, sessions, codes] = rows(s.db);
    expect(sessions).toHaveLength(1);
    expect(codes).toEqual([
      expect.objectContaining({ kind: 'reset', code_hash: 'hash', tries: 2 }),
    ]);
    expect(s.db.pragma('foreign_key_check')).toEqual([]);
    const schema = s.db.prepare('select sql from sqlite_master order by name').all();
    s.close();

    // A second start changes nothing
    const again = new GatewayStore(file);
    expect(rows(again.db)).toEqual([people, sessions, codes]);
    expect(again.db.prepare('select sql from sqlite_master order by name').all()).toEqual(schema);
    // The new columns keep their rules
    for (const column of ['code_channel', 'reminder_channel'])
      expect(() => again.db.prepare(`update people set ${column} = 'pigeon'`).run()).toThrow(
        /CHECK/,
      );
    again.close();
  });
});
