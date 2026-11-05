import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateLedgerViews } from './ledgerViews';

describe('invalidateLedgerViews', () => {
  it("also refreshes a household's breakdown, which follows its payments' categories", async () => {
    const qc = new QueryClient();
    const key = ['households', 'g1', 'statement', '', ''];
    qc.setQueryData(key, { byCategory: [] });
    await invalidateLedgerViews(qc);
    expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
