import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GatewayStore, MAX_CODE_TRIES, nameKey } from './store.js';

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
});
