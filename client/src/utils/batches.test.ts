import { describe, expect, it } from 'vitest';
import { inBatches } from './batches';

describe('inBatches', () => {
  it('sends every item, in order, in batches no larger than the limit', async () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `t${i}`);
    const sent: string[][] = [];
    const results = await inBatches(ids, 500, async (batch) => {
      sent.push(batch);
      return batch.length;
    });
    expect(results).toEqual([500, 500, 201]);
    expect(sent.flat()).toEqual(ids);
  });

  it('sends nothing for nothing', async () => {
    expect(await inBatches([], 500, async () => 1)).toEqual([]);
  });
});
