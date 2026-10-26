import { describe, expect, it } from 'vitest';
import { inBatches } from './batches';

describe('inBatches', () => {
  it('sends every item, in order, in batches no larger than the limit', async () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `t${i}`);
    const sent: string[][] = [];
    const out = await inBatches(ids, 500, async (batch) => {
      sent.push(batch);
      return batch.length;
    });
    expect(out).toEqual({ results: [500, 500, 201], sent: 1201, error: null });
    expect(sent.flat()).toEqual(ids);
  });

  it('keeps what earlier batches did when a later one fails, and stops there', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => i);
    let calls = 0;
    const out = await inBatches(ids, 500, async (batch) => {
      calls += 1;
      if (calls === 2) throw new Error('offline');
      return batch.length;
    });
    expect(calls).toBe(2);
    expect(out.results).toEqual([500]);
    expect(out.sent).toBe(500);
    expect(out.error?.message).toBe('offline');
  });

  it('sends nothing for nothing', async () => {
    expect(await inBatches([], 500, async () => 1)).toEqual({ results: [], sent: 0, error: null });
  });
});
