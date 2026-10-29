import { z } from 'zod';

const bankId = z.string().min(1).max(256);
const money = z.object({
  currencyCode: z.literal('AUD'),
  valueInBaseUnits: z.number().int().min(-1e13).max(1e13),
});
const timestamp = z.string().datetime({ offset: true });
export const upAccountSchema = z.object({
  id: bankId,
  attributes: z.object({
    displayName: z.string().max(1_000),
    accountType: z.enum(['SAVER', 'TRANSACTIONAL', 'HOME_LOAN']),
    ownershipType: z.enum(['INDIVIDUAL', 'JOINT']),
    balance: money,
  }),
});
export const upTransactionSchema = z.object({
  id: bankId,
  attributes: z.object({
    status: z.enum(['HELD', 'SETTLED']),
    description: z.string().max(10_000),
    message: z.string().max(10_000).nullable(),
    amount: money,
    createdAt: timestamp,
    settledAt: timestamp.nullable(),
    note: z
      .object({ text: z.string().max(10_000) })
      .nullable()
      .optional(),
    roundUp: z.object({ amount: money, boostPortion: money.nullable() }).nullable().optional(),
    cashback: z
      .object({ description: z.string().max(10_000), amount: money })
      .nullable()
      .optional(),
  }),
  relationships: z.object({
    account: z.object({ data: z.object({ id: bankId }) }),
    transferAccount: z.object({ data: z.object({ id: bankId }).nullable() }),
    // Up's own category (a slug such as `groceries`). Both are optional and the slug is any
    // string, so a category Up adds later is tolerated rather than failing the whole sync.
    category: z.object({ data: z.object({ id: z.string().max(200) }).nullable() }).optional(),
    parentCategory: z.object({ data: z.object({ id: z.string().max(200) }).nullable() }).optional(),
  }),
});
export type UpAccount = z.infer<typeof upAccountSchema>;
export type UpTransaction = z.infer<typeof upTransactionSchema>;

export const upObservationSchema = z
  .object({
    status: z.enum(['HELD', 'SETTLED']),
    amount: money.shape.valueInBaseUnits,
    createdAt: timestamp,
    settledAt: timestamp.nullable(),
    description: z.string().max(200),
    notes: z.string().max(5000),
    roundUpAmount: money.shape.valueInBaseUnits.nullable(),
    boostAmount: money.shape.valueInBaseUnits.nullable(),
    cashbackAmount: money.shape.valueInBaseUnits.nullable(),
    cashbackDescription: z.string().max(200).nullable(),
    transferAccountId: bankId.nullable(),
  })
  .strict();

export class UpError extends Error {}
export const upErrorMessage = (err: unknown) =>
  err instanceof UpError ? err.message : 'Could not reach Up. Try again later.';
export const cleanUpText = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

/** Dates follow the timestamp's Australian bank offset, never the server's timezone. */
export function upImportRows(tx: UpTransaction, upAccountId: string) {
  if (tx.relationships.account.data.id !== upAccountId)
    throw new UpError('Up returned a transaction for a different account.');
  if (tx.attributes.status !== 'SETTLED') return [];
  const a = tx.attributes;
  const notes = [a.message, a.note?.text].filter(Boolean).map((s) => cleanUpText(s!));
  if (tx.relationships.transferAccount.data)
    notes.push('Up internal transfer: review the transfer suggestions in the register.');
  const base = {
    date: a.createdAt.slice(0, 10),
    amount: a.amount.valueInBaseUnits,
    payeeName: cleanUpText(a.description).slice(0, 200) || 'Unknown',
    notes: notes.join(' · ').slice(0, 5_000) || null,
    importedId: `up:${upAccountId}:${tx.id}`,
    // Only a hint for new rows (upCategoryMap.ts); transfers are never categorised from it.
    upCategory: tx.relationships.transferAccount.data
      ? null
      : (tx.relationships.category?.data?.id ?? null),
  };
  // Round-up metadata alone does not identify another bank posting or destination.
  // Keep the purchase amount and bank ID; never add the boost twice or invent transfer legs.
  // Cashback is additional money received, not a reduction in the purchase amount.
  return a.cashback
    ? [
        base,
        {
          ...base,
          amount: a.cashback.amount.valueInBaseUnits,
          payeeName: cleanUpText(a.cashback.description).slice(0, 200) || 'Up cashback',
          importedId: base.importedId + ':cashback',
          upCategory: null,
        },
      ]
    : [base];
}

/** Up reports available balance. Remove the effect of holds for a settled-only register. */
export function upSettledBalance(account: UpAccount, history: UpTransaction[]): number {
  const held = history
    .filter((t) => t.attributes.status === 'HELD')
    .reduce(
      (sum, t) =>
        sum +
        t.attributes.amount.valueInBaseUnits +
        (t.attributes.cashback?.amount.valueInBaseUnits ?? 0) +
        // Up takes a pending purchase's round-up out of the balance too (to the Saver)
        (t.attributes.roundUp?.amount.valueInBaseUnits ?? 0),
      0,
    );
  const balance = account.attributes.balance.valueInBaseUnits - held;
  if (!Number.isSafeInteger(balance))
    throw new UpError('Up returned a balance outside the supported range.');
  return balance;
}
