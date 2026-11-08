import type { Transaction } from '../../types';

// Which way a linked transfer went (owner-requested 8 November 2026): "Transfer: Spending" didn't
// say whether money came from Spending or went to it. A pair listed as one row (server
// transactionSelection.ts, transfer_pairs) reads "Transfer from Spending to 2Up Essentials".

export interface TransferSides {
  from: string;
  to: string;
}

/** The accounts a linked transfer left and entered; null for anything else */
export function transferSides(
  tx: Pick<Transaction, 'accountId' | 'amount' | 'transferTransactionId' | 'transferAccountId'>,
  accountName: (id: string) => string | undefined,
): TransferSides | null {
  if (!tx.transferTransactionId || !tx.transferAccountId) return null;
  const own = accountName(tx.accountId) ?? 'this account';
  const other = accountName(tx.transferAccountId) ?? 'another account';
  return tx.amount < 0 ? { from: own, to: other } : { from: other, to: own };
}

/**
 * What a list shows as the transfer's name. Only the name the link gave it ("Transfer: …" or
 * none) is replaced; a name you typed is kept. Null = use the payee name.
 */
export function transferLabel(
  tx: Pick<
    Transaction,
    | 'accountId'
    | 'amount'
    | 'transferTransactionId'
    | 'transferAccountId'
    | 'transferPair'
    | 'payeeName'
  >,
  accountName: (id: string) => string | undefined,
): string | null {
  if (tx.payeeName && !/^Transfer\b/.test(tx.payeeName)) return null;
  const sides = transferSides(tx, accountName);
  if (!sides) return null;
  if (tx.transferPair) return `Transfer from ${sides.from} to ${sides.to}`;
  return tx.amount < 0 ? `Transfer to ${sides.to}` : `Transfer from ${sides.from}`;
}
