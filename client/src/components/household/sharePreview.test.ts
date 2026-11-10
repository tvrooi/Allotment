import { describe, expect, it } from 'vitest';
import { summarisePreview } from './sharePreview';

const people = [
  { id: 'me', isSelf: 1 },
  { id: 'juno', isSelf: 0 },
  { id: 'zeph', isSelf: 0 },
];
const ok = (id: string, amount: number, shares: number[]) => ({
  transactionId: id,
  ok: true as const,
  amount,
  shares: people.map((p, i) => ({ personId: p.id, amount: shares[i] })),
});

describe('summarisePreview', () => {
  const preview = {
    results: [
      ok('a', 1150, [150, 600, 400]),
      ok('b', 1150, [150, 600, 400]),
      { transactionId: 'c', ok: false as const, error: 'Fixed amounts differ' },
    ],
  };

  it('adds up what the others would owe you, leaving your own part out', () => {
    const s = summarisePreview(preview, people, false);
    expect(s.count).toBe(2);
    expect(s.total).toBe(2300);
    expect(s.lines).toEqual([
      { personId: 'juno', amount: 1200 },
      { personId: 'zeph', amount: 800 },
    ]);
    expect(s.refused).toEqual(['Fixed amounts differ']);
  });

  it('counts everyone, you included, when the household account paid', () => {
    const s = summarisePreview(preview, people, true);
    expect(s.lines.map((l) => l.personId)).toEqual(['me', 'juno', 'zeph']);
    expect(s.lines[0].amount).toBe(300);
  });

  it('omits people with no part', () => {
    const s = summarisePreview({ results: [ok('a', 1000, [0, 1000, 0])] }, people, false);
    expect(s.lines).toEqual([{ personId: 'juno', amount: 1000 }]);
  });
});
