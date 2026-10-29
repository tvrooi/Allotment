import express, { Router, type Request, type Response } from 'express';
import http from 'http';
import { z } from 'zod';
import { householdLedger } from '../services/householdLedger.js';
import type { SharedExport } from '../services/householdService.js';
import type { Budgets } from './budgets.js';
import type { GatewayStore, HouseholdLink, HouseholdNote, Person } from './store.js';

// Combined households (docs/HOUSEHOLDS.md, "Combining with another person"). Two people who
// each keep a household in their own budget can join them: each sees the other's entries,
// their splits and merchants, and one note per entry that both can edit. Nothing is copied
// between budgets: the register is put together from both budgets' shared exports each time
// it's asked for, so stopping a link ends the other person's view at once. Only the gateway
// knows both people; each budget only answers for its own household.

/** As in gateway/app.ts and routes/auth.ts */
const GATEWAY_HEADER = 'x-flybudget-gateway';
const MAX_NOTE = 2000;
const id = z.string().min(1).max(64);

class Invalid extends Error {}
class Unavailable extends Error {}
/** A household changed under the link (a person removed): it must be combined again */
export class Relink extends Error {}

export type Side = {
  /** The person whose budget this is */
  person: { id: string; name: string };
  /** Their household person who stands for the other person */
  partnerPersonId: string;
  data: SharedExport;
};

export interface CombinedEntry {
  /** `${ownerId}:${eventId}` */
  key: string;
  ownerId: string;
  eventId: string;
  mine: boolean;
  kind: string;
  date: string;
  description: string;
  amount: number;
  /** A person key, or null when the owner's household pool paid */
  payer: string | null;
  recipient: string | null;
  merchant: { name: string; logo: string | null } | null;
  fromBank: boolean;
  reviewReason: string | null;
  /** The entry this one refunds */
  reverses: string | null;
  shares: { person: string; amount: number }[];
  note: { text: string; updatedBy: string; updatedAt: string } | null;
  /** The other person recorded an expense on the same day for the same amount */
  possibleDuplicate: boolean;
}

/**
 * The two households as one register, seen by `viewerId`. People who are the two linked
 * people in either household become one person each (their gateway id); everyone else keeps
 * their own household's entry (`${ownerId}:${householdPersonId}`). Balances add both ledgers.
 */
export function combine(viewerId: string, sides: [Side, Side], notes: HouseholdNote[]) {
  const people = new Map<
    string,
    { key: string; name: string; isMe: boolean; isPartner: boolean }
  >();
  const names = new Map(sides.map((s) => [s.person.id, s.person.name]));
  for (const s of sides)
    people.set(s.person.id, {
      key: s.person.id,
      name: s.person.name,
      isMe: s.person.id === viewerId,
      isPartner: s.person.id !== viewerId,
    });
  const keyOf = sides.map((s) => {
    const other = sides.find((o) => o !== s)!;
    const self = s.data.people.find((p) => p.isSelf);
    if (!self || !s.data.people.some((p) => p.id === s.partnerPersonId))
      throw new Relink(`${s.person.name}'s household has changed: combine it again`);
    const map = new Map<string, string>();
    for (const p of s.data.people) {
      if (p.id === self.id) map.set(p.id, s.person.id);
      else if (p.id === s.partnerPersonId) map.set(p.id, other.person.id);
      else {
        const key = `${s.person.id}:${p.id}`;
        map.set(p.id, key);
        people.set(key, { key, name: p.name, isMe: false, isPartner: false });
      }
    }
    return (personId: string | null) => (personId ? (map.get(personId) ?? null) : null);
  });
  const noteOf = new Map(notes.map((n) => [`${n.ownerId}:${n.eventId}`, n]));
  const entries: CombinedEntry[] = sides.flatMap((s, i) =>
    s.data.events.map((e) => {
      const key = `${s.person.id}:${e.id}`;
      const note = noteOf.get(key);
      return {
        key,
        ownerId: s.person.id,
        eventId: e.id,
        mine: s.person.id === viewerId,
        kind: e.kind,
        date: e.date,
        description: e.description,
        amount: e.amount,
        payer: keyOf[i](e.payerId),
        recipient: keyOf[i](e.recipientId),
        merchant: e.merchant,
        fromBank: e.fromBank,
        reviewReason: e.reviewReason,
        reverses: e.reversesId ? `${s.person.id}:${e.reversesId}` : null,
        shares: e.shares.map((sh) => ({ person: keyOf[i](sh.personId)!, amount: sh.amount })),
        note: note
          ? {
              text: note.text,
              updatedBy: names.get(note.updatedBy) ?? '',
              updatedAt: note.updatedAt,
            }
          : null,
        possibleDuplicate: false,
      };
    }),
  );
  // The same expense recorded by both: same day and amount, one on each side
  for (const e of entries)
    e.possibleDuplicate =
      e.kind === 'expense' &&
      entries.some(
        (o) =>
          o.ownerId !== e.ownerId &&
          o.kind === 'expense' &&
          o.date === e.date &&
          o.amount === e.amount,
      );
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  // Each side's pool stays its own: a pool payment moves no one's balance
  const { balances } = householdLedger(
    [...people.values()].map((p) => ({ id: p.key })),
    entries.map((e) => ({
      id: e.key,
      kind: e.kind,
      amount: e.amount,
      payerId: e.payer,
      recipientId: e.recipient,
    })),
    entries.flatMap((e) =>
      e.shares.map((s) => ({ eventId: e.key, personId: s.person, amount: s.amount })),
    ),
  );
  return {
    currency: sides[0].data.group.currency,
    households: sides.map((s) => ({ ownerId: s.person.id, name: s.data.group.name })),
    people: [...people.values()].map((p) => ({ ...p, balance: balances[p.key] ?? 0 })),
    entries,
  };
}

/** The routes under /api/shared-households, for a signed-in person */
export function sharingRouter(o: {
  store: GatewayStore;
  budgets: Budgets;
  signedIn: (req: Request) => Person | undefined;
  personChanged: (req: Request, res: Response, person: Person) => boolean;
}) {
  const { store, budgets } = o;
  const router = Router();
  router.use(express.json({ limit: '20kb' }));
  router.use((req, res, next) => {
    const person = o.signedIn(req);
    if (!person) return void res.status(401).json({ error: 'Login required' });
    if (o.personChanged(req, res, person)) return;
    res.locals.person = person;
    next();
  });

  /** A person's shared export of one household, from their own budget (started if needed) */
  async function exportOf(person: Person, groupId: string): Promise<SharedExport> {
    if (person.disabled) throw new Unavailable(`${person.name}'s budget isn't available`);
    try {
      await budgets.start(person);
    } catch {
      throw new Unavailable(`${person.name}'s budget isn't available right now`);
    }
    const port = budgets.port(person.id);
    if (!port) throw new Unavailable(`${person.name}'s budget isn't available right now`);
    const { status, body } = await get(
      port,
      `/api/households/${encodeURIComponent(groupId)}/shared-export`,
      budgets.secret,
    );
    if (status !== 200) throw new Unavailable('That household no longer exists');
    return body as SharedExport;
  }

  /** The household and its person who stands for `other`, checked against the budget */
  async function checkGroup(person: Person, groupId: string, partnerPersonId: string) {
    const data = await exportOf(person, groupId);
    const partner = data.people.find((p) => p.id === partnerPersonId);
    if (!partner || partner.isSelf) throw new Invalid('Choose who they are in your household');
    return data;
  }

  const inUse = (personId: string, groupId: string, except?: string) =>
    store
      .householdLinks(personId)
      .some(
        (l) =>
          l.id !== except &&
          ((l.inviterId === personId && l.inviterGroup === groupId) ||
            (l.inviteeId === personId && l.inviteeGroup === groupId)),
      );

  const describe = (l: HouseholdLink, me: Person) => {
    const mineIsInviter = l.inviterId === me.id;
    const other = store.person(mineIsInviter ? l.inviteeId : l.inviterId);
    return {
      id: l.id,
      role: mineIsInviter ? 'inviter' : 'invitee',
      status: l.acceptedAt ? 'active' : 'pending',
      partner: { id: other?.id ?? '', name: other?.name ?? '' },
      groupId: mineIsInviter ? l.inviterGroup : l.inviteeGroup,
      partnerPersonId: mineIsInviter ? l.inviterPartner : l.inviteePartner,
    };
  };

  /** The link, if this person is in it */
  function linkFor(req: Request, res: Response) {
    const me = res.locals.person as Person;
    const link = store.householdLink(String(req.params.id));
    if (!link || (link.inviterId !== me.id && link.inviteeId !== me.id)) {
      res.status(404).json({ error: 'Not found' });
      return undefined;
    }
    return link;
  }

  router.get('/', (_req, res) => {
    const me = res.locals.person as Person;
    res.json({
      people: store
        .people()
        .filter((p) => p.id !== me.id && !p.disabled && p.hasPassword)
        .map((p) => ({ id: p.id, name: p.name })),
      links: store.householdLinks(me.id).map((l) => describe(l, me)),
    });
  });

  // Ask someone to combine one of your households with one of theirs
  router.post('/', (req, res) =>
    handle(res, async () => {
      const me = res.locals.person as Person;
      const body = z.object({ partnerId: id, groupId: id, partnerPersonId: id }).parse(req.body);
      const partner = store.person(body.partnerId);
      if (!partner || partner.id === me.id || partner.disabled || !partner.hasPassword)
        throw new Invalid('Choose someone who uses FlyBudget on this server');
      if (inUse(me.id, body.groupId)) throw new Invalid('That household is already combined');
      await checkGroup(me, body.groupId, body.partnerPersonId);
      const link = store.addHouseholdLink({
        inviterId: me.id,
        inviterGroup: body.groupId,
        inviterPartner: body.partnerPersonId,
        inviteeId: partner.id,
      });
      return [201, describe(link, me)];
    }),
  );

  // The other person accepts with one of their own households
  router.post('/:id/accept', (req, res) =>
    handle(res, async () => {
      const me = res.locals.person as Person;
      const link = linkFor(req, res);
      if (!link) return;
      if (link.inviteeId !== me.id || link.acceptedAt) throw new Invalid('Nothing to accept');
      const body = z.object({ groupId: id, partnerPersonId: id }).parse(req.body);
      if (inUse(me.id, body.groupId, link.id))
        throw new Invalid('That household is already combined');
      const mine = await checkGroup(me, body.groupId, body.partnerPersonId);
      const inviter = store.person(link.inviterId);
      if (!inviter) throw new Invalid('Nothing to accept');
      const theirs = await exportOf(inviter, link.inviterGroup);
      if (theirs.group.currency !== mine.group.currency)
        throw new Invalid(`Both households must use ${theirs.group.currency}`);
      store.acceptHouseholdLink(link.id, body.groupId, body.partnerPersonId);
      return [200, describe(store.householdLink(link.id)!, me)];
    }),
  );

  // Declining, cancelling and stopping are the same: either person can, at any time
  router.delete('/:id', (req, res) => {
    const link = linkFor(req, res);
    if (!link) return;
    store.removeHouseholdLink(link.id);
    res.status(204).send();
  });

  /** Both sides of an active link, each from its owner's budget */
  async function sidesOf(link: HouseholdLink): Promise<[Side, Side]> {
    if (!link.acceptedAt || !link.inviteeGroup || !link.inviteePartner)
      throw new Invalid('Not combined yet');
    const inviter = store.person(link.inviterId);
    const invitee = store.person(link.inviteeId);
    if (!inviter || !invitee) throw new Unavailable('This household is no longer combined');
    const [a, b] = await Promise.all([
      exportOf(inviter, link.inviterGroup),
      exportOf(invitee, link.inviteeGroup),
    ]);
    return [
      {
        person: { id: inviter.id, name: inviter.name },
        partnerPersonId: link.inviterPartner,
        data: a,
      },
      {
        person: { id: invitee.id, name: invitee.name },
        partnerPersonId: link.inviteePartner,
        data: b,
      },
    ];
  }

  router.get('/:id/register', (req, res) =>
    handle(res, async () => {
      const me = res.locals.person as Person;
      const link = linkFor(req, res);
      if (!link) return;
      const sides = await sidesOf(link);
      return [
        200,
        { link: describe(link, me), ...combine(me.id, sides, store.householdNotes(link.id)) },
      ];
    }),
  );

  // The shared note on any entry in the combined register, by either person
  router.put('/:id/notes', (req, res) =>
    handle(res, async () => {
      const me = res.locals.person as Person;
      const link = linkFor(req, res);
      if (!link) return;
      const body = z
        .object({ ownerId: id, eventId: id, text: z.string().max(MAX_NOTE) })
        .parse(req.body);
      const sides = await sidesOf(link);
      const side = sides.find((s) => s.person.id === body.ownerId);
      if (!side || !side.data.events.some((e) => e.id === body.eventId))
        throw new Invalid('That entry is no longer in the household');
      store.setHouseholdNote(link.id, body.ownerId, body.eventId, body.text.trim(), me.id);
      return [204, undefined];
    }),
  );

  return router;
}

async function handle(res: Response, fn: () => Promise<[number, unknown] | undefined>) {
  try {
    const result = await fn();
    if (!result || res.headersSent) return;
    const [status, body] = result;
    if (body === undefined) res.status(status).send();
    else res.status(status).json(body);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof z.ZodError) res.status(400).json({ error: 'Invalid request' });
    else if (e instanceof Invalid) res.status(400).json({ error: e.message });
    else if (e instanceof Unavailable) res.status(503).json({ error: e.message });
    else if (e instanceof Relink) res.status(409).json({ error: e.message });
    else res.status(500).json({ error: 'Something went wrong' });
  }
}

/** A GET to a budget on loopback, with the gateway's secret */
function get(port: number, path: string, secret: string) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const call = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'GET',
        path,
        headers: { [GATEWAY_HEADER]: secret, accept: 'application/json' },
        timeout: 15_000,
      },
      (answer) => {
        const chunks: Buffer[] = [];
        answer.on('data', (c: Buffer) => chunks.push(c));
        answer.on('end', () => {
          try {
            resolve({
              status: answer.statusCode ?? 502,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'),
            });
          } catch {
            resolve({ status: 502, body: null });
          }
        });
      },
    );
    call.on('timeout', () => call.destroy(new Error('timeout')));
    call.on('error', () => reject(new Unavailable("A budget didn't answer")));
    call.end();
  });
}
