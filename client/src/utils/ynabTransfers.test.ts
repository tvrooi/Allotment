import { describe, expect, it } from 'vitest';
import { pairYnabTransfers } from './ynabTransfers';
import type { ImportRow } from '../api/transactions';

const r = (id: string, date: string, amount: number, payeeName: string): ImportRow =>
  ({
    id,
    importedId: id,
    date,
    amount,
    payeeName,
  }) as ImportRow;

describe('pairYnabTransfers', () => {
  it('pairs mirrored legs across the accounts of one file, each row once', () => {
    const pairs = pairYnabTransfers(
      new Map([
        [
          'Everyday',
          [
            r('e1', '2026-09-12', -20000, 'Transfer : Savings'),
            r('e2', '2026-09-12', -20000, 'Transfer : Savings'),
          ],
        ],
        ['Savings', [r('s1', '2026-09-12', 20000, 'Transfer : Everyday')]],
      ]),
    );
    expect(pairs).toEqual([
      { account: 'Everyday', importedId: 'e1', otherAccount: 'Savings', otherImportedId: 's1' },
    ]);
  });
  it('leaves rows alone when the day or amount differs, the other leg is missing, or the account is not in the file', () => {
    expect(
      pairYnabTransfers(
        new Map([
          [
            'Everyday',
            [
              r('e1', '2026-09-12', -20000, 'Transfer : Savings'),
              r('e2', '2026-09-13', -500, 'Transfer : Savings'),
              r('e3', '2026-09-14', -500, 'Transfer : Cash'),
            ],
          ],
          [
            'Savings',
            [
              r('s1', '2026-09-13', 20000, 'Transfer : Everyday'),
              r('s2', '2026-09-13', 499, 'Transfer : Everyday'),
            ],
          ],
        ]),
      ),
    ).toEqual([]);
  });
});
