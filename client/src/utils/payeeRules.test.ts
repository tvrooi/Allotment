import { describe, expect, it } from 'vitest';
import { payeeCondition, ruleMentionsPayee } from './ruleFormat';
import type { Rule, RuleCondition } from '../types';

const rule = (conditions: RuleCondition[]): Rule => ({
  id: 'r1',
  conditionsOp: 'and',
  conditions,
  actions: [{ type: 'set_category', value: 'c1' }],
  enabled: true,
  sortOrder: 0,
  createdAt: '2026-01-01',
});
const payee = { id: 'p1', name: 'Mock Grocer' };

describe('rules for a payee (#235)', () => {
  it('a new rule matches the payee by its record, else by the name shown', () => {
    expect(payeeCondition({ payeeId: 'p1', payeeName: 'Mock Grocer' })).toEqual({
      field: 'payee',
      op: 'is',
      value: 'p1',
    });
    expect(payeeCondition({ payeeId: null, payeeName: 'Mock Grocer' })).toEqual({
      field: 'payee_name',
      op: 'is',
      value: 'Mock Grocer',
    });
  });

  it('finds rules whose conditions name this payee, by record or by name', () => {
    expect(
      ruleMentionsPayee(rule([payeeCondition({ payeeId: 'p1', payeeName: null })]), payee),
    ).toBe(true);
    expect(
      ruleMentionsPayee(rule([{ field: 'payee', op: 'one_of', value: ['p2', 'p1'] }]), payee),
    ).toBe(true);
    expect(
      ruleMentionsPayee(rule([{ field: 'payee_name', op: 'is', value: 'mock grocer' }]), payee),
    ).toBe(true);
    expect(
      ruleMentionsPayee(
        rule([{ field: 'payee_name', op: 'one_of', value: ['Mock Grocer'] }]),
        payee,
      ),
    ).toBe(true);
  });

  it('leaves out rules about other payees or other fields', () => {
    expect(ruleMentionsPayee(rule([{ field: 'payee', op: 'is', value: 'p2' }]), payee)).toBe(false);
    expect(
      ruleMentionsPayee(rule([{ field: 'payee_name', op: 'contains', value: 'Mock' }]), payee),
    ).toBe(false);
    expect(
      ruleMentionsPayee(rule([{ field: 'notes', op: 'is', value: 'Mock Grocer' }]), payee),
    ).toBe(false);
    expect(ruleMentionsPayee(rule([{ field: 'payee', op: 'is_empty' }]), payee)).toBe(false);
  });
});
