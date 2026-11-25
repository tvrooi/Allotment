import { describe, expect, it } from 'vitest';
import { splitLabel } from './splitLabel';

const two = [
  { id: 'a', name: 'Tristan' },
  { id: 'b', name: 'Edward' },
];

describe('splitLabel', () => {
  it('calls an equal split between two people 50/50', () => {
    expect(splitLabel(null, two)).toBe('50/50');
    expect(splitLabel({ mode: 'equal', shares: [] }, two)).toBe('50/50');
  });

  it('says equally between everyone for more than two', () => {
    expect(splitLabel(null, [...two, { id: 'c', name: 'Juno' }])).toBe('equally between all 3');
  });

  it('describes an unequal split in words', () => {
    const split = {
      mode: 'percentage' as const,
      shares: [
        { personId: 'a', value: 6000 },
        { personId: 'b', value: 4000 },
      ],
    };
    expect(splitLabel(split, two)).toBe('Tristan 60%, Edward 40%');
  });
});
