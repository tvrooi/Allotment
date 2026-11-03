import { describe, expect, it } from 'vitest';
import { combine, Relink, type Side } from './sharing.js';

// Two households, one in each person's budget, as one register (gateway/sharing.ts)

const event = (e: Partial<Side['data']['events'][number]> & { id: string }) => ({
  kind: 'expense',
  date: '2026-10-01',
  description: 'Groceries',
  amount: 10_000,
  payerId: null,
  recipientId: null,
  reversesId: null,
  reviewReason: null,
  fromBank: false,
  merchant: null,
  shares: [],
  ...e,
});

const tristan: Side = {
  person: { id: 'T', name: 'Tristan' },
  partnerPersonId: 't-partner',
  data: {
    group: { id: 'g1', name: 'Home', currency: 'AUD' },
    people: [
      { id: 't-self', name: 'Me', isSelf: true },
      { id: 't-partner', name: 'Partner', isSelf: false },
      { id: 't-sam', name: 'Sam', isSelf: false },
    ],
    events: [
      event({
        id: 'e1',
        payerId: 't-self',
        amount: 9_000,
        fromBank: true,
        merchant: { name: 'Woolworths', logo: null },
        shares: [
          { personId: 't-self', amount: 3_000 },
          { personId: 't-partner', amount: 3_000 },
          { personId: 't-sam', amount: 3_000 },
        ],
      }),
    ],
  },
};

const edward: Side = {
  person: { id: 'E', name: 'Edward' },
  partnerPersonId: 'e-tristan',
  data: {
    group: { id: 'g2', name: 'Our place', currency: 'AUD' },
    people: [
      { id: 'e-self', name: 'Edward', isSelf: true },
      { id: 'e-tristan', name: 'Tristan', isSelf: false },
    ],
    events: [
      event({
        id: 'e9',
        date: '2026-10-02',
        description: 'Electricity',
        payerId: 'e-self',
        amount: 20_000,
        shares: [
          { personId: 'e-self', amount: 10_000 },
          { personId: 'e-tristan', amount: 10_000 },
        ],
      }),
    ],
  },
};

describe('combine', () => {
  it("shows both people's entries with their splits, merchants and whose they are", () => {
    const r = combine('E', [tristan, edward], []);
    expect(r.entries.map((e) => [e.key, e.mine])).toEqual([
      ['E:e9', true],
      ['T:e1', false],
    ]);
    const groceries = r.entries.find((e) => e.key === 'T:e1')!;
    expect(groceries).toMatchObject({
      payer: 'T',
      merchant: { name: 'Woolworths', logo: null },
      fromBank: true,
      shares: [
        { person: 'T', amount: 3_000 },
        { person: 'E', amount: 3_000 },
        { person: 'T:t-sam', amount: 3_000 },
      ],
    });
  });

  it('makes the two linked people one person each, keeping everyone else separate', () => {
    const r = combine('T', [tristan, edward], []);
    expect(r.people.map((p) => [p.key, p.name, p.isMe, p.isPartner])).toEqual([
      ['T', 'Tristan', true, false],
      ['E', 'Edward', false, true],
      ['T:t-sam', 'Sam', false, false],
    ]);
  });

  it('adds both ledgers into one balance for each person', () => {
    const r = combine('T', [tristan, edward], []);
    const balance = Object.fromEntries(r.people.map((p) => [p.key, p.balance]));
    // Tristan paid $90 (his share $30) and owes Edward $100 of the $200 bill
    expect(balance).toEqual({
      T: 9_000 - 3_000 - 10_000,
      E: 20_000 - 10_000 - 3_000,
      'T:t-sam': -3_000,
    });
    expect(Object.values(balance).reduce((s, v) => s + v, 0)).toBe(0);
  });

  it('attaches the shared note to its entry, with who changed it last', () => {
    const r = combine(
      'E',
      [tristan, edward],
      [{ ownerId: 'T', eventId: 'e1', text: 'Dinner party', updatedBy: 'E', updatedAt: 'now' }],
    );
    expect(r.entries.find((e) => e.key === 'T:e1')!.note).toEqual({
      text: 'Dinner party',
      updatedBy: 'Edward',
      updatedAt: 'now',
    });
  });

  it('flags an expense both people recorded on the same day for the same amount', () => {
    const twice: Side = {
      ...edward,
      data: {
        ...edward.data,
        events: [event({ id: 'e5', payerId: 'e-self', amount: 9_000, shares: [] })],
      },
    };
    const r = combine('T', [tristan, twice], []);
    expect(r.entries.every((e) => e.possibleDuplicate)).toBe(true);
  });

  it('asks to combine again when a household no longer has the linked person', () => {
    const gone = { ...edward, partnerPersonId: 'deleted' };
    expect(() => combine('T', [tristan, gone], [])).toThrow(Relink);
  });
});
