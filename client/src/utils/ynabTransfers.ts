import type { ImportRow } from '../api/transactions';

export interface TransferPair {
  /** YNAB account names, as in the file */
  account: string;
  importedId: string;
  otherAccount: string;
  otherImportedId: string;
}

const TRANSFER = /^transfer\s*:\s*(.+)$/i;
const norm = (name: string) => name.trim().toLowerCase();

/**
 * YNAB writes a transfer as two rows: "Transfer : Savings" in Everyday and "Transfer : Everyday"
 * in Savings. Pairs the rows whose two legs are both in this file: the payee names the other
 * account, the day is the same and the amounts mirror each other. A row is used once, and
 * anything that doesn't pair exactly is left as an ordinary row (never guessed).
 */
export function pairYnabTransfers(byAccount: Map<string, ImportRow[]>): TransferPair[] {
  const accounts = new Map([...byAccount.keys()].map((name) => [norm(name), name]));
  const taken = new Set<string>();
  const pairs: TransferPair[] = [];
  for (const [account, rows] of byAccount) {
    for (const row of rows) {
      const target = TRANSFER.exec(row.payeeName ?? '')?.[1];
      const otherAccount = target ? accounts.get(norm(target)) : undefined;
      if (!otherAccount || otherAccount === account || taken.has(row.importedId)) continue;
      const mirror = byAccount
        .get(otherAccount)!
        .find(
          (o) =>
            !taken.has(o.importedId) &&
            o.date === row.date &&
            o.amount === -row.amount &&
            norm(TRANSFER.exec(o.payeeName ?? '')?.[1] ?? '') === norm(account),
        );
      if (!mirror) continue;
      taken.add(row.importedId).add(mirror.importedId);
      pairs.push({
        account,
        importedId: row.importedId,
        otherAccount,
        otherImportedId: mirror.importedId,
      });
    }
  }
  return pairs;
}
