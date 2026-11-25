import { describe, expect, it } from 'vitest';
import { balanceHeadline, householdToShow, unsharedPayments } from './balanceHeadline';

const people = [
  { id: 'me', isSelf: 1 },
  { id: 'alex', isSelf: 0 },
];

describe('balanceHeadline', () => {
  it('says what the owner is owed or owes, as a positive amount', () => {
    expect(balanceHeadline(people, { me: 2_500, alex: -2_500 }, 0)).toEqual({
      text: 'You’re owed',
      amount: 2_500,
      sign: 1,
    });
    expect(balanceHeadline(people, { me: -1_000, alex: 1_000 }, 0)).toEqual({
      text: 'You owe',
      amount: 1_000,
      sign: -1,
    });
  });

  it('is square when nobody owes, but only on what is shared when payments are not yet', () => {
    expect(balanceHeadline(people, {}, 0)).toEqual({ text: 'All square', sign: 0 });
    expect(balanceHeadline(people, { me: 0, alex: 0 }, 2)).toEqual({
      text: 'Square on what’s shared',
      sign: 0,
    });
  });

  it('is square for the owner while others are out of balance', () => {
    const three = [...people, { id: 'juno', isSelf: false }];
    expect(balanceHeadline(three, { me: 0, alex: -500, juno: 500 }, 0)).toEqual({
      text: 'You’re square',
      sign: 0,
    });
  });
});

describe('unsharedPayments', () => {
  const bills = [
    { name: 'Power', payments: [{ shared: false }, { shared: true }, { shared: false }] },
    { name: 'Water', payments: [{ shared: true }] },
  ];
  it('counts payments of bills not shared yet, and names their bills', () => {
    expect(unsharedPayments(bills, true)).toEqual({ count: 2, bills: ['Power'] });
  });
  it('counts none for a household without bills', () => {
    expect(unsharedPayments(bills, false)).toEqual({ count: 0, bills: [] });
  });
});

describe('householdToShow', () => {
  const flat = { id: 'flat', isDefault: 0 };
  const home = { id: 'home', isDefault: 1 };
  it('is the household the Household page opens on: the default, else the first', () => {
    expect(householdToShow([flat, home], true)).toBe(home);
    expect(householdToShow([flat], true)).toBe(flat);
    const other = { id: 'other', isDefault: 0 };
    expect(householdToShow([flat, other], true)).toBe(flat);
  });
  it('is none without a household, or when the feature is hidden', () => {
    expect(householdToShow([], true)).toBeNull();
    expect(householdToShow([home], false)).toBeNull();
  });
});
