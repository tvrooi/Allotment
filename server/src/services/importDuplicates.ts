// File-import duplicates (SEC-01). A statement file can cover days the account already has: rows
// typed by hand, rows a bank sync brought in, rows a schedule posted, or an earlier import of
// the same period in another format. Those have no import id the file's rows could match, so
// they used to arrive a second time and double the spending.
//
// This finds them. A file row *may* already be in the account when an existing row has the same
// amount, is dated within 3 days, and has a payee that does not contradict it. Each existing row
// is claimed by at most one file row, nearest day first, so a statement with two identical
// purchases against one typed entry flags one and leaves the other to import.
//
// It only flags. Nothing is skipped: the preview unticks the row and says what it matches, and
// the person decides (the same rule as transfer suggestions: review, never silently guess).
import { and, eq, gte, inArray, lte, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions } from '../db/schema.js';
import { addDaysIso, isIsoDay } from '../utils/date.js';

/** How many days apart a statement date and a typed date can be and still be the same purchase */
export const DUPLICATE_WINDOW_DAYS = 3;

export interface FileRow {
  date: string;
  amount: number;
  payeeName?: string | null;
  importedId: string;
}

export interface ExistingRow {
  id: string;
  date: string;
  amount: number;
  payeeName: string | null;
  importedPayee: string | null;
  importedId: string | null;
}

/** Where the matching row came from: typed by hand, a bank sync, a schedule or an earlier file */
export type ExistingSource = 'manual' | 'synced' | 'scheduled' | 'file';

export interface PossibleDuplicate {
  transactionId: string;
  date: string;
  payeeName: string | null;
  source: ExistingSource;
}

/** Words that appear on statements and say nothing about who was paid */
const NOISE = new Set([
  'card',
  'visa',
  'debit',
  'credit',
  'eftpos',
  'purchase',
  'payment',
  'pty',
  'ltd',
  'the',
  'and',
  'for',
  'pos',
  'aus',
  'australia',
  'value',
  'date',
  'transfer',
  'direct',
]);

function tokens(...texts: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const text of texts) {
    for (const word of (text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length < 3 || /^\d+$/.test(word) || NOISE.has(word)) continue;
      out.add(word);
    }
  }
  return [...out];
}

/** 0 = the same words, 1 = they share a word, 2 = one side says nothing, null = they differ */
function payeeScore(file: string[], existing: string[]): 0 | 1 | 2 | null {
  if (!file.length || !existing.length) return 2;
  const same = file.length === existing.length && file.every((t) => existing.includes(t));
  if (same) return 0;
  for (const a of file)
    for (const b of existing) {
      if (a === b) return 1;
      // "woolworths" and "woolworthsmetro": one word starts the other
      if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return 1;
    }
  return null;
}

export function sourceOf(importedId: string | null): ExistingSource {
  if (!importedId) return 'manual';
  if (importedId.startsWith('schedule:')) return 'scheduled';
  if (/^(up|eb|plaid|simplefin):/.test(importedId)) return 'synced';
  return 'file';
}

/**
 * For each file row, the existing row it may duplicate, or null. `exact` holds the imported ids
 * the account already has (those rows are plain duplicates, handled by id); they claim nothing.
 */
export function matchExistingRows(
  fileRows: readonly FileRow[],
  existing: readonly ExistingRow[],
  exact: ReadonlySet<string> = new Set(),
): Array<PossibleDuplicate | null> {
  const fileIds = new Set(fileRows.map((r) => r.importedId));
  // Existing rows by amount and day, so a file row looks only at the days it could match
  const byAmountDay = new Map<string, ExistingRow[]>();
  for (const e of existing) {
    // A row carrying one of the file's own ids is that row's exact duplicate, not a lookalike
    if (e.importedId && fileIds.has(e.importedId)) continue;
    if (!isIsoDay(e.date)) continue;
    const key = `${e.amount}|${e.date}`;
    const list = byAmountDay.get(key);
    if (list) list.push(e);
    else byAmountDay.set(key, [e]);
  }

  // Nearest day first, then the closest payee, then file order: a stable, explainable pairing.
  // Done as passes over (days apart, payee score) rather than by listing every possible pair and
  // sorting them, which grows with rows x rows when a statement is full of equal amounts. A
  // claimed row leaves its bucket, so each file row only ever scans rows still free.
  const wanted = fileRows.map((r) => tokens(r.payeeName));
  const theirs = new Map<string, string[]>();
  const result: Array<PossibleDuplicate | null> = fileRows.map(() => null);
  for (let distance = 0; distance <= DUPLICATE_WINDOW_DAYS; distance++) {
    const offsets = distance === 0 ? [0] : [-distance, distance];
    for (const score of [0, 1, 2]) {
      fileRows.forEach((row, i) => {
        if (result[i] || exact.has(row.importedId)) return;
        for (const offset of offsets) {
          const bucket = byAmountDay.get(`${row.amount}|${addDaysIso(row.date, offset)}`);
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const e = bucket[k];
            let tokensOf = theirs.get(e.id);
            if (!tokensOf) theirs.set(e.id, (tokensOf = tokens(e.payeeName, e.importedPayee)));
            if (payeeScore(wanted[i], tokensOf) !== score) continue;
            bucket.splice(k, 1);
            result[i] = {
              transactionId: e.id,
              date: e.date,
              payeeName: e.payeeName ?? e.importedPayee,
              source: sourceOf(e.importedId),
            };
            return;
          }
        }
      });
    }
  }
  return result;
}

/**
 * The rows of one account a file could repeat: everything dated near the file's days, except
 * the parts of a split (the parent carries the amount the bank shows) and balance corrections.
 */
export function existingRowsNear(
  accountId: string,
  fileRows: readonly Pick<FileRow, 'date'>[],
): ExistingRow[] {
  if (!fileRows.length) return [];
  let first = fileRows[0].date;
  let last = fileRows[0].date;
  for (const r of fileRows) {
    if (r.date < first) first = r.date;
    if (r.date > last) last = r.date;
  }
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      payeeName: transactions.payeeName,
      importedPayee: transactions.importedPayee,
      importedId: transactions.importedId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        gte(transactions.date, addDaysIso(first, -DUPLICATE_WINDOW_DAYS)),
        lte(transactions.date, addDaysIso(last, DUPLICATE_WINDOW_DAYS)),
        isNull(transactions.parentTransactionId),
        eq(transactions.isAdjustment, 0),
      ),
    )
    .all();
}

/** Which of these imported ids the account already has (in chunks: a file can hold 100,000 rows) */
export function takenImportedIds(accountId: string, importedIds: readonly string[]): Set<string> {
  const taken = new Set<string>();
  for (let i = 0; i < importedIds.length; i += 500) {
    for (const row of db
      .select({ importedId: transactions.importedId })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          inArray(transactions.importedId, importedIds.slice(i, i + 500) as string[]),
        ),
      )
      .all())
      if (row.importedId) taken.add(row.importedId);
  }
  return taken;
}
