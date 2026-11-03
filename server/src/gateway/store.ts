import Database from 'better-sqlite3';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

// The multi-user gateway's own database (docs/MULTI-USER-PLAN.md): who may sign in, their
// sessions and one-time codes. It holds no money data: each person's budget is its own
// database, run by its own process. Tokens and codes are stored only as SHA-256 hashes,
// so a copy of this file can't sign anyone in.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A code sent to someone's phone */
export const NOTIFIED_CODE_TTL_MS = 10 * 60 * 1000;
/** A code the administrator passes on (an invitation, or a reset printed in the Log) */
export const HANDED_CODE_TTL_MS = 24 * 60 * 60 * 1000;
/** Wrong tries before a code stops working */
export const MAX_CODE_TRIES = 5;

export type CodeKind = 'invite' | 'reset';

export interface Person {
  id: string;
  name: string;
  isAdmin: boolean;
  notifyService: string | null;
  dbPath: string;
  keyPath: string;
  disabled: boolean;
  hasPassword: boolean;
  createdAt: string;
}

interface PersonRow {
  id: string;
  name: string;
  is_admin: number;
  notify_service: string | null;
  db_path: string;
  key_path: string;
  disabled: number;
  password_hash: string | null;
  created_at: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
/** How names are compared: trimmed, case and spacing ignored */
export const nameKey = (name: string) =>
  name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
/** Shown instead of a session's stored hash, so nothing listed can be turned into a login */
const publicId = (hash: string) => digest(`public:${hash}`).slice(0, 12);

function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    isAdmin: r.is_admin === 1,
    notifyService: r.notify_service,
    dbPath: r.db_path,
    keyPath: r.key_path,
    disabled: r.disabled === 1,
    hasPassword: r.password_hash !== null,
    createdAt: r.created_at,
  };
}

/** A combined household: the inviter's group joined with the invitee's once accepted */
export interface HouseholdLink {
  id: string;
  inviterId: string;
  inviterGroup: string;
  /** The inviter's household person who is the invitee */
  inviterPartner: string;
  inviteeId: string;
  inviteeGroup: string | null;
  /** The invitee's household person who is the inviter */
  inviteePartner: string | null;
  acceptedAt: string | null;
}

export interface HouseholdNote {
  /** Whose entry: a person's id */
  ownerId: string;
  eventId: string;
  text: string;
  updatedBy: string;
  updatedAt: string;
}

interface LinkRow {
  id: string;
  inviter_id: string;
  inviter_group: string;
  inviter_partner: string;
  invitee_id: string;
  invitee_group: string | null;
  invitee_partner: string | null;
  accepted_at: string | null;
}

const toLink = (r: LinkRow): HouseholdLink => ({
  id: r.id,
  inviterId: r.inviter_id,
  inviterGroup: r.inviter_group,
  inviterPartner: r.inviter_partner,
  inviteeId: r.invitee_id,
  inviteeGroup: r.invitee_group,
  inviteePartner: r.invitee_partner,
  acceptedAt: r.accepted_at,
});

export class GatewayStore {
  readonly db: Database.Database;

  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      create table if not exists people (
        id text primary key,
        name text not null,
        name_key text not null unique,
        password_hash text,
        is_admin integer not null default 0,
        notify_service text,
        db_path text not null unique,
        key_path text not null,
        disabled integer not null default 0,
        -- A new password must revoke the person's access tokens; set until their budget confirms
        revoke_tokens integer not null default 0,
        created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      create table if not exists sessions (
        id text primary key,
        person_id text not null references people(id) on delete cascade,
        user_agent text,
        created_at text not null,
        expires_at text not null,
        last_used_at text
      );
      create table if not exists codes (
        person_id text not null references people(id) on delete cascade,
        kind text not null check (kind in ('invite', 'reset')),
        code_hash text not null,
        expires_at text not null,
        tries integer not null default 0,
        primary key (person_id, kind)
      );
      -- Combined households (gateway/sharing.ts): one person's household joined with another's.
      -- Each side names its group and which of its household people stands for the other.
      create table if not exists household_links (
        id text primary key,
        inviter_id text not null references people(id) on delete cascade,
        inviter_group text not null,
        inviter_partner text not null,
        invitee_id text not null references people(id) on delete cascade,
        invitee_group text,
        invitee_partner text,
        accepted_at text,
        created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      -- The one note on a shared entry that both people can edit
      create table if not exists household_notes (
        link_id text not null references household_links(id) on delete cascade,
        owner_id text not null,
        event_id text not null,
        text text not null,
        updated_by text not null,
        updated_at text not null,
        primary key (link_id, owner_id, event_id)
      );
    `);
  }

  close() {
    this.db.close();
  }

  // ─── Combined households ───────────────────────────────────────────────────

  /** Links this person is in, either side */
  householdLinks(personId: string): HouseholdLink[] {
    return (
      this.db
        .prepare(
          'select * from household_links where inviter_id = ? or invitee_id = ? order by created_at',
        )
        .all(personId, personId) as LinkRow[]
    ).map(toLink);
  }

  householdLink(id: string): HouseholdLink | undefined {
    const row = this.db.prepare('select * from household_links where id = ?').get(id) as
      LinkRow | undefined;
    return row && toLink(row);
  }

  addHouseholdLink(l: {
    inviterId: string;
    inviterGroup: string;
    inviterPartner: string;
    inviteeId: string;
  }): HouseholdLink {
    const id = randomBytes(8).toString('hex');
    this.db
      .prepare(
        'insert into household_links (id, inviter_id, inviter_group, inviter_partner, invitee_id) values (?, ?, ?, ?, ?)',
      )
      .run(id, l.inviterId, l.inviterGroup, l.inviterPartner, l.inviteeId);
    return this.householdLink(id)!;
  }

  acceptHouseholdLink(id: string, group: string, partner: string) {
    this.db
      .prepare(
        "update household_links set invitee_group = ?, invitee_partner = ?, accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ? and accepted_at is null",
      )
      .run(group, partner, id);
  }

  /** Ends a link (declined, cancelled or stopped); its notes go with it */
  removeHouseholdLink(id: string) {
    this.db.prepare('delete from household_links where id = ?').run(id);
  }

  householdNotes(linkId: string): HouseholdNote[] {
    return (
      this.db.prepare('select * from household_notes where link_id = ?').all(linkId) as {
        owner_id: string;
        event_id: string;
        text: string;
        updated_by: string;
        updated_at: string;
      }[]
    ).map((r) => ({
      ownerId: r.owner_id,
      eventId: r.event_id,
      text: r.text,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    }));
  }

  /** Empty text removes the note */
  setHouseholdNote(linkId: string, ownerId: string, eventId: string, text: string, by: string) {
    if (!text) {
      this.db
        .prepare('delete from household_notes where link_id = ? and owner_id = ? and event_id = ?')
        .run(linkId, ownerId, eventId);
      return;
    }
    this.db
      .prepare(
        `insert into household_notes (link_id, owner_id, event_id, text, updated_by, updated_at)
         values (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         on conflict (link_id, owner_id, event_id)
         do update set text = excluded.text, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .run(linkId, ownerId, eventId, text, by);
  }

  // ─── People ────────────────────────────────────────────────────────────────

  people(): Person[] {
    return (
      this.db
        .prepare('select * from people order by is_admin desc, created_at')
        .all() as PersonRow[]
    ).map(toPerson);
  }

  person(id: string): Person | undefined {
    const row = this.db.prepare('select * from people where id = ?').get(id) as
      PersonRow | undefined;
    return row && toPerson(row);
  }

  personByName(name: string): Person | undefined {
    const row = this.db.prepare('select * from people where name_key = ?').get(nameKey(name)) as
      PersonRow | undefined;
    return row && toPerson(row);
  }

  passwordHash(id: string): string | null {
    const row = this.db.prepare('select password_hash from people where id = ?').get(id) as
      { password_hash: string | null } | undefined;
    return row?.password_hash ?? null;
  }

  /** Adds a person. Throws if the name is taken (case and spacing ignored). */
  addPerson(p: { name: string; isAdmin: boolean; dbPath: string; keyPath: string }): Person {
    const id = randomBytes(6).toString('hex');
    this.db
      .prepare(
        'insert into people (id, name, name_key, is_admin, db_path, key_path) values (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        p.name.trim().replace(/\s+/g, ' '),
        nameKey(p.name),
        p.isAdmin ? 1 : 0,
        p.dbPath,
        p.keyPath,
      );
    return this.person(id)!;
  }

  /**
   * Sets the password and signs the person out everywhere except `keepToken`'s session. Their
   * access tokens are marked for revocation until their budget confirms it (tokensRevoked).
   */
  setPassword(id: string, hash: string, keepToken?: string) {
    const keep = keepToken ? digest(keepToken) : '';
    this.db.transaction(() => {
      this.db
        .prepare('update people set password_hash = ?, revoke_tokens = 1 where id = ?')
        .run(hash, id);
      this.db.prepare('delete from sessions where person_id = ? and id != ?').run(id, keep);
      this.db.prepare('delete from codes where person_id = ?').run(id);
    })();
  }

  /** People whose access tokens must still be revoked */
  pendingRevocations(): string[] {
    return (
      this.db.prepare('select id from people where revoke_tokens = 1').all() as { id: string }[]
    ).map((r) => r.id);
  }

  revocationPending(id: string): boolean {
    const row = this.db.prepare('select revoke_tokens from people where id = ?').get(id) as
      { revoke_tokens: number } | undefined;
    return row?.revoke_tokens === 1;
  }

  tokensRevoked(id: string) {
    this.db.prepare('update people set revoke_tokens = 0 where id = ?').run(id);
  }

  setNotifyService(id: string, service: string | null) {
    this.db.prepare('update people set notify_service = ? where id = ?').run(service, id);
  }

  /** A disabled person can't sign in and is signed out everywhere */
  setDisabled(id: string, disabled: boolean) {
    this.db.transaction(() => {
      this.db.prepare('update people set disabled = ? where id = ?').run(disabled ? 1 : 0, id);
      if (disabled) {
        this.db.prepare('delete from sessions where person_id = ?').run(id);
        this.db.prepare('delete from codes where person_id = ?').run(id);
      }
    })();
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  createSession(personId: string, userAgent: string | undefined): string {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    this.db
      .prepare(
        'insert into sessions (id, person_id, user_agent, created_at, expires_at, last_used_at) values (?, ?, ?, ?, ?, ?)',
      )
      .run(
        digest(token),
        personId,
        userAgent?.slice(0, 300) ?? null,
        now.toISOString(),
        new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
        now.toISOString(),
      );
    return token;
  }

  /** The signed-in person for a session token, if it's valid and they may still sign in */
  personForSession(token: string | undefined): Person | undefined {
    if (!token || token.length > 100) return undefined;
    const now = new Date();
    const row = this.db
      .prepare(
        `select p.*, s.id as session_id, s.last_used_at from sessions s join people p on p.id = s.person_id
         where s.id = ? and s.expires_at > ? and p.disabled = 0`,
      )
      .get(digest(token), now.toISOString()) as
      (PersonRow & { session_id: string; last_used_at: string | null }) | undefined;
    if (!row) return undefined;
    // At most every few minutes, so reading doesn't mean a write per request
    if (!row.last_used_at || now.getTime() - Date.parse(row.last_used_at) > 5 * 60 * 1000)
      this.db
        .prepare('update sessions set last_used_at = ? where id = ?')
        .run(now.toISOString(), row.session_id);
    return toPerson(row);
  }

  deleteSession(token: string | undefined) {
    if (token) this.db.prepare('delete from sessions where id = ?').run(digest(token));
  }

  listSessions(personId: string, currentToken: string | undefined) {
    const current = currentToken ? digest(currentToken) : '';
    const rows = this.db
      .prepare(
        'select * from sessions where person_id = ? and expires_at > ? order by coalesce(last_used_at, created_at) desc',
      )
      .all(personId, new Date().toISOString()) as {
      id: string;
      user_agent: string | null;
      created_at: string;
      expires_at: string;
      last_used_at: string | null;
    }[];
    return rows.map((s) => ({
      id: publicId(s.id),
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      lastUsedAt: s.last_used_at,
      userAgent: s.user_agent,
      current: s.id === current,
    }));
  }

  /** Signs out the person's other sessions; returns how many */
  deleteOtherSessions(personId: string, currentToken: string) {
    return this.db
      .prepare('delete from sessions where person_id = ? and id != ?')
      .run(personId, digest(currentToken)).changes;
  }

  /** Signs out one of the person's own sessions by its public id */
  deleteSessionByPublicId(personId: string, id: string) {
    const rows = this.db.prepare('select id from sessions where person_id = ?').all(personId) as {
      id: string;
    }[];
    const match = rows.find((r) => publicId(r.id) === id);
    if (!match) return false;
    this.db.prepare('delete from sessions where id = ?').run(match.id);
    return true;
  }

  deleteExpiredSessions() {
    this.db.prepare('delete from sessions where expires_at <= ?').run(new Date().toISOString());
    this.db.prepare('delete from codes where expires_at <= ?').run(new Date().toISOString());
  }

  // ─── One-time codes ────────────────────────────────────────────────────────

  /**
   * A new code for a person, replacing any earlier one of the same kind. Six digits for a code
   * sent to a phone (it expires in minutes and allows few tries); 16 letters and digits for one
   * an administrator passes on.
   */
  issueCode(personId: string, kind: CodeKind, ttlMs: number, digits = false): string {
    const code = digits
      ? String(randomInt(0, 1_000_000)).padStart(6, '0')
      : Array.from({ length: 16 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    this.db
      .prepare(
        `insert into codes (person_id, kind, code_hash, expires_at, tries) values (?, ?, ?, ?, 0)
         on conflict (person_id, kind) do update set code_hash = excluded.code_hash,
           expires_at = excluded.expires_at, tries = 0`,
      )
      .run(personId, kind, digest(normalizeCode(code)), new Date(Date.now() + ttlMs).toISOString());
    return digits ? code : formatCode(code);
  }

  /** Checks a code once. A right code is used up; wrong tries count towards the limit. */
  useCode(personId: string, kind: CodeKind, given: string): boolean {
    const row = this.db
      .prepare('select * from codes where person_id = ? and kind = ?')
      .get(personId, kind) as { code_hash: string; expires_at: string; tries: number } | undefined;
    if (!row || row.expires_at <= new Date().toISOString() || row.tries >= MAX_CODE_TRIES)
      return false;
    const a = Buffer.from(digest(normalizeCode(given)));
    const b = Buffer.from(row.code_hash);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      this.db.prepare('delete from codes where person_id = ? and kind = ?').run(personId, kind);
      return true;
    }
    this.db
      .prepare('update codes set tries = tries + 1 where person_id = ? and kind = ?')
      .run(personId, kind);
    return false;
  }
}

// No look-alikes (0/O, 1/I): 16 characters = 80 random bits
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalizeCode = (code: string) =>
  code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 64);
const formatCode = (code: string) => code.match(/.{1,4}/g)!.join('-');
