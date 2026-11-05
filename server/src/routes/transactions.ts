import { deletedSyncedImports } from '../services/transactionHelpers.js';
import { restoreDeletedImport } from '../services/deletedImportRestore.js';
import { householdEvents } from '../db/schema.js';
import { Router, type Response } from 'express';
import { db } from '../db/index.js';
import {
  transactions,
  payees,
  accounts,
  categories,
  categoryGroups,
  cardFunding,
} from '../db/schema.js';
import { eq, and, sql, inArray, getTableColumns } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  deleteTransactionByOwner,
  isUpImport,
  resolvePayee,
} from '../services/transactionHelpers.js';
import { buildRuleContext, insertNewTransaction, loadRules } from '../services/ruleService.js';
import {
  TransferError,
  dismissPair,
  linkTransfer,
  listTransferSuggestions,
  newTransferRow,
  transferToAccount,
  unlinkTransfer,
} from '../services/transferService.js';
import { isoDate } from '../utils/validation.js';
import {
  parseSelection,
  registerCondition,
  summarizeSelection,
} from '../services/transactionSelection.js';
import {
  MarkError,
  restoreReview,
  reviewSelection,
  setFlags,
  setTransactionTags,
  tagsByTransaction,
} from '../services/transactionMarks.js';
import { ReconciliationError, unlockTransaction } from '../services/reconciliationService.js';
import {
  bulkEdit,
  bulkDelete,
  previewBulkDelete,
  previewBulkEdit,
  restoreBulkEdit,
  splitTransaction,
} from '../services/transactionEdits.js';
import { accountTransactionSum, isBudgetBoundary } from '../services/balances.js';
import { hasBankFeed } from '../services/accountIntegrity.js';
import {
  accountCurrency,
  convertAmount,
  currencyContext,
  refreshMainAmounts,
} from '../services/mainAmountService.js';
import { isForeign } from '../utils/currencies.js';
import {
  existingRowsNear,
  matchExistingRows,
  takenImportedIds,
} from '../services/importDuplicates.js';
import {
  ImportBatchError,
  createImportBatch,
  finishImportBatch,
  listImportBatches,
  undoImportBatch,
} from '../services/importBatches.js';

export const transactionsRouter = Router();
transactionsRouter.use((req, res, next) => {
  if (req.method === 'GET') return next();
  const body = req.body;
  const rows = [
    body,
    ...(Array.isArray(body?.splits) ? body.splits : []),
    ...(Array.isArray(body?.rows) ? body.rows : []),
  ];
  const ids = new Set(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((m) => m.categoryId),
  );
  if (rows.some((row) => row && ids.has(row.categoryId)))
    return res.status(400).json({
      error: 'Payment envelopes hold funding; record card repayments as linked transfers',
    });
  next();
});

transactionsRouter.param('id', (req, res, next, id) => {
  const counterpartId = db
    .select({ id: transactions.transferTransactionId })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get()?.id;
  const linked = db
    .select()
    .from(householdEvents)
    .where(
      counterpartId
        ? inArray(householdEvents.transactionId, [id, counterpartId])
        : eq(householdEvents.transactionId, id),
    )
    .get();
  if (linked && req.method !== 'GET') {
    const safeEdit =
      (req.method === 'POST' && req.path.endsWith('/unlock')) ||
      (req.method === 'PUT' &&
        Object.keys(req.body ?? {}).every((k) =>
          ['categoryId', 'notes', 'payeeId', 'payeeName', 'reconciled'].includes(k),
        ));
    if (!safeEdit)
      return res.status(409).json({
        error:
          'Remove the linked household entry before changing the payment amount, date or account',
      });
    if ((linked.kind === 'settlement' || linked.kind === 'refund') && req.body.categoryId) {
      const category = db
        .select({ income: categoryGroups.isIncome })
        .from(categories)
        .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
        .where(eq(categories.id, req.body.categoryId))
        .get();
      if (category?.income)
        return res.status(400).json({
          error:
            'Household repayments and refunds belong in the original expense category, not income',
        });
    }
  }
  next();
});

const id = z.string().min(1).max(64);
// Amounts are integer cents; the cap keeps sums far inside Number.MAX_SAFE_INTEGER
const cents = z.number().int().min(-1e13).max(1e13);

// A transaction saved on a device while offline carries its own random id. Sending it again
// (the connection dropped before the answer arrived, or two tabs sent it) returns the saved one
// instead of creating a duplicate.
const clientId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

const createSchema = z.object({
  id: clientId.optional(),
  accountId: id,
  date: isoDate,
  amount: cents,
  payeeId: id.nullable().optional(),
  payeeName: z.string().max(500).nullable().optional(),
  categoryId: id.nullable().optional(),
  notes: z.string().max(5_000).nullable().optional(),
  /** A balance correction (reconciliation, "Update value"), left out of income and spending */
  adjustment: z.boolean().optional(),
  splits: z
    .array(
      z.object({
        categoryId: id.nullable(),
        amount: cents,
        notes: z.string().max(5_000).nullable().optional(),
      }),
    )
    .max(100)
    .optional(),
});

const updateSchema = createSchema
  .omit({ id: true, splits: true, adjustment: true })
  .extend({
    /**
     * What it cost in the budget's currency, typed in (from the card statement), for a
     * transaction in an account with another currency. Null goes back to the day's rate.
     */
    mainAmount: cents.nullable(),
  })
  .partial();

const transferSchema = z
  .object({
    id: clientId.optional(),
    fromAccountId: id,
    toAccountId: id,
    date: isoDate,
    amount: cents.positive(),
    /** What arrived, when the two accounts have different currencies (in the receiving one's) */
    toAmount: cents.positive().optional(),
    notes: z.string().max(5_000).nullable().optional(),
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, 'Choose two different accounts');

// Imported files are untrusted: validate dates and cap sizes
const importRowSchema = z.object({
  date: isoDate,
  amount: cents,
  payeeName: z.string().max(500).nullable().optional(),
  notes: z.string().max(5_000).nullable().optional(),
  importedId: z.string().max(500),
  /** From the file's category column, matched or created by the person importing */
  categoryId: z.string().max(64).nullable().optional(),
});
const importRowsSchema = z.array(importRowSchema).max(100_000);

// GET /transactions — excludes split children; attaches children array to parents.
// The selection is shared with the summary and the filtered export (services/transactionSelection.ts).
// GET /transactions/summary — count, money in/out and date span of the same selection. Reads only.
// Audit F-14: synced bank rows the owner deleted (other than Up's, which Up review lists), and
// forgetting one so the next sync imports it again
transactionsRouter.get('/deleted-imports', (_req, res) => res.json(deletedSyncedImports()));
transactionsRouter.post('/deleted-imports/restore', (req, res) => {
  const parsed = z
    .object({ accountId: z.string().min(1).max(64), importedId: z.string().min(1).max(300) })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a deleted transaction' });
  const restored = restoreDeletedImport(parsed.data.accountId, parsed.data.importedId);
  if (!restored) return res.status(404).json({ error: 'That transaction is not deleted' });
  res.json({ restored: true, ...restored });
});

transactionsRouter.get('/summary', (req, res) => {
  const selection = parseSelection(req.query as Record<string, unknown>);
  if (!selection.success) return res.status(400).json({ error: selection.error.flatten() });
  res.json(summarizeSelection(selection.data));
});

// ─── Phase 9: review, visibility in reports, tags ─────────────────────────────

function sendMarkError(res: Response, error: unknown) {
  if (error instanceof MarkError) return res.status(error.status).json({ error: error.message });
  throw error;
}

const reviewChangeSchema = z.object({ id, previous: z.string().max(40).nullable() });
const reviewSchema = z.union([
  z.object({
    // The register's selection, as its query parameters
    selection: z.record(z.string(), z.string().max(20_000)),
    reviewed: z.boolean(),
    expectedCount: z.number().int().min(0).max(1_000_000),
  }),
  // Undo: put these rows' previous states back
  z.object({ restore: z.array(reviewChangeSchema).max(1_000_000) }),
]);

// POST /transactions/review — mark the selection reviewed, guarded by the confirmed count
transactionsRouter.post('/review', (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if ('restore' in parsed.data) return res.json(restoreReview(parsed.data.restore));
  const selection = parseSelection(parsed.data.selection);
  if (!selection.success) return res.status(400).json({ error: selection.error.flatten() });
  try {
    res.json(reviewSelection(selection.data, parsed.data.reviewed, parsed.data.expectedCount));
  } catch (error) {
    sendMarkError(res, error);
  }
});

// ─── Splitting after the fact and editing many at once ────────────────────────

const bulkChangesSchema = z
  .object({
    categoryId: id.nullable(),
    payeeName: z.string().trim().min(1).max(500),
    notes: z.string().max(5_000).nullable(),
    hiddenFromReports: z.boolean(),
    reviewed: z.boolean(),
    addTagIds: z.array(id).max(100),
    removeTagIds: z.array(id).max(100),
  })
  .partial()
  .strict()
  .refine((c) => Object.values(c).some((v) => v !== undefined), 'Choose at least one change');
const bulkIds = z.array(id).max(100_000);
const bulkTargetSchema = z.object({
  // The register's selection, as its query parameters
  selection: z.record(z.string(), z.string().max(20_000)),
  ids: bulkIds.optional(),
  excludeIds: bulkIds.optional(),
});
const bulkRestoreSchema = z
  .object({
    id,
    categoryId: id.nullable(),
    payeeId: id.nullable(),
    payeeName: z.string().max(500).nullable(),
    notes: z.string().max(5_000).nullable(),
    hiddenFromReports: z.union([z.literal(0), z.literal(1)]),
    reviewedAt: z.string().max(40).nullable(),
    tagIds: z.array(id).max(100),
  })
  .partial()
  .required({ id: true });
const bulkSchema = z.union([
  // Preview: what would change, for the confirmation; writes nothing
  bulkTargetSchema.extend({ changes: bulkChangesSchema, preview: z.literal(true) }),
  bulkTargetSchema.extend({
    changes: bulkChangesSchema,
    expectedCount: z.number().int().min(0).max(1_000_000),
  }),
  // Undo: put these rows' previous values back
  z.object({ restore: z.array(bulkRestoreSchema).max(1_000_000) }),
]);

// POST /transactions/bulk — preview, apply or undo a change to many transactions at once
transactionsRouter.post('/bulk', (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  if ('restore' in body) return res.json(restoreBulkEdit(body.restore));
  const selection = parseSelection(body.selection);
  if (!selection.success) return res.status(400).json({ error: selection.error.flatten() });
  const target = { selection: selection.data, ids: body.ids, excludeIds: body.excludeIds };
  try {
    if ('preview' in body) return res.json(previewBulkEdit(target, body.changes));
    res.json(bulkEdit(target, body.changes, body.expectedCount));
  } catch (error) {
    sendMarkError(res, error);
  }
});

const bulkDeleteSchema = z.union([
  bulkTargetSchema.extend({ preview: z.literal(true) }),
  bulkTargetSchema.extend({ expectedCount: z.number().int().min(1).max(1_000_000) }),
]);

// POST /transactions/bulk-delete — preview what a delete would remove, or delete the selection
// (reconciled and household-linked rows are skipped and counted). The caller confirms the count.
transactionsRouter.post('/bulk-delete', (req, res) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  const selection = parseSelection(body.selection);
  if (!selection.success) return res.status(400).json({ error: selection.error.flatten() });
  const target = { selection: selection.data, ids: body.ids, excludeIds: body.excludeIds };
  try {
    if ('preview' in body) return res.json(previewBulkDelete(target));
    res.json(bulkDelete(target, body.expectedCount));
  } catch (error) {
    sendMarkError(res, error);
  }
});

// PUT /transactions/:id/split — split it into parts, change the parts, or (no parts) unsplit
transactionsRouter.put('/:id/split', (req, res) => {
  const parsed = z
    .object({
      splits: z
        .array(
          z.object({
            categoryId: id.nullable(),
            amount: cents,
            notes: z.string().max(5_000).nullable().optional(),
          }),
        )
        .max(100),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(splitTransaction(req.params.id, parsed.data.splits));
  } catch (error) {
    sendMarkError(res, error);
  }
});

// PATCH /transactions/:id/flags — the detail panel's Reviewed and Hide from reports toggles
transactionsRouter.patch('/:id/flags', (req, res) => {
  const parsed = z
    .object({ reviewed: z.boolean().optional(), hiddenFromReports: z.boolean().optional() })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(setFlags(req.params.id, parsed.data));
  } catch (error) {
    sendMarkError(res, error);
  }
});

// PUT /transactions/:id/tags — replace the transaction's tags
transactionsRouter.put('/:id/tags', (req, res) => {
  const parsed = z.object({ tagIds: z.array(id).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json({ tagIds: setTransactionTags(req.params.id, parsed.data.tagIds) });
  } catch (error) {
    sendMarkError(res, error);
  }
});

transactionsRouter.get('/', (req, res) => {
  const selection = parseSelection(req.query as Record<string, unknown>);
  if (!selection.success) return res.status(400).json({ error: selection.error.flatten() });

  // A payment is linked to at most one household entry (transaction_id is unique there)
  const query = db
    .select({
      ...getTableColumns(transactions),
      isBudgetBoundary: isBudgetBoundary.mapWith(Boolean),
      householdGroupId: householdEvents.groupId,
      householdEventId: householdEvents.id,
      householdEventKind: householdEvents.kind,
    })
    .from(transactions)
    .leftJoin(householdEvents, eq(householdEvents.transactionId, transactions.id))
    .where(registerCondition(selection.data))
    .$dynamic();

  // No limit unless asked for: the register, reconcile and category views need every match
  // (a hidden cap cut off older transactions and broke the reconciled balance)
  const page = z
    .object({
      limit: z.coerce.number().int().min(1).max(1000).optional(),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({ limit: req.query.limit, offset: req.query.offset });
  if (!page.success) return res.status(400).json({ error: page.error.flatten() });
  const { limit, offset } = page.data;

  const rows = query
    .orderBy(sql`${transactions.date} desc`)
    // SQLite reads a negative LIMIT as "no limit"
    .limit(limit ?? -1)
    .offset(offset)
    .all();

  const parentIds = rows.filter((r) => r.isParent === 1).map((r) => r.id);
  const childrenMap = new Map<string, (typeof transactions.$inferSelect)[]>();
  if (parentIds.length) {
    const children = db
      .select()
      .from(transactions)
      .where(inArray(transactions.parentTransactionId, parentIds))
      .all();
    for (const child of children) {
      const pid = child.parentTransactionId!;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(child);
    }
  }

  const tagMap = tagsByTransaction(rows.map((r) => r.id));
  const result = rows.map(({ householdGroupId, householdEventId, householdEventKind, ...r }) => ({
    ...r,
    // The household this payment is linked to, its entry there and the entry's kind (an
    // expense when it was shared); null = not linked
    household:
      householdGroupId && householdEventId
        ? { id: householdGroupId, eventId: householdEventId, kind: householdEventKind }
        : null,
    tagIds: tagMap.get(r.id) ?? [],
    ...(r.isParent === 1 ? { children: childrenMap.get(r.id) ?? [] } : {}),
  }));

  res.json(result);
});

/** A transaction created earlier with this id, shaped like the create response (null if none) */
function alreadyCreated(txId: string) {
  const row = db.select().from(transactions).where(eq(transactions.id, txId)).get();
  if (!row) return null;
  if (row.transferTransactionId) {
    const other = db
      .select()
      .from(transactions)
      .where(eq(transactions.id, row.transferTransactionId))
      .get();
    return other ? [row, other] : [row];
  }
  const children = db
    .select()
    .from(transactions)
    .where(eq(transactions.parentTransactionId, txId))
    .all();
  return children.length ? { ...row, children } : row;
}

// POST /transactions — supports optional splits array
transactionsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { id: txId, payeeName, payeeId, splits, adjustment, ...rest } = parsed.data;
  const existing = txId && alreadyCreated(txId);
  if (existing) return res.status(200).json(existing);

  if (splits && splits.length > 0) {
    const payee = resolvePayee(payeeName, payeeId);
    const finalPayeeId = payee.payeeId;
    const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
    if (splitSum !== rest.amount) {
      return res.status(400).json({ error: 'Split amounts must equal transaction total' });
    }

    const parentId = txId ?? nanoid();
    const parent = {
      id: parentId,
      ...rest,
      categoryId: null,
      payeeId: finalPayeeId,
      payeeName: payee.payeeName,
      reconciled: 0,
      isParent: 1,
      transferTransactionId: null,
      parentTransactionId: null,
      importedId: null,
      createdAt: new Date().toISOString(),
    };
    const childRows = splits.map((s) => ({
      id: nanoid(),
      accountId: rest.accountId,
      date: rest.date,
      amount: s.amount,
      payeeId: finalPayeeId,
      payeeName: payee.payeeName,
      categoryId: s.categoryId,
      notes: s.notes ?? null,
      reconciled: 0,
      isParent: 0,
      transferTransactionId: null,
      parentTransactionId: parentId,
      importedId: null,
      createdAt: new Date().toISOString(),
    }));
    db.transaction((tx) => {
      tx.insert(transactions).values(parent).run();
      for (const child of childRows) tx.insert(transactions).values(child).run();
    });
    refreshMainAmounts([parentId]);

    return res.status(201).json(alreadyCreated(parentId));
  }

  // Rules run on manual entries too, but never replace a category or notes the user entered
  const name =
    payeeName ??
    (payeeId ? (db.select().from(payees).where(eq(payees.id, payeeId)).get()?.name ?? null) : null);
  const { transaction, children } = insertNewTransaction(
    {
      accountId: rest.accountId,
      date: rest.date,
      amount: rest.amount,
      payeeId: payeeId ?? null,
      payeeName: name,
      importedPayee: null,
      notes: rest.notes ?? null,
      categoryId: rest.categoryId ?? null,
      importedId: null,
      id: txId,
      isAdjustment: adjustment,
    },
    { keepUserCategory: true, keepUserNotes: true },
  );
  res.status(201).json(children.length ? { ...transaction, children } : transaction);
});

// POST /transactions/transfer — creates linked pair in two accounts
transactionsRouter.post('/transfer', (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { id: txId, fromAccountId, toAccountId, date, amount, toAmount, notes } = parsed.data;
  const existing = txId && alreadyCreated(txId);
  if (existing) return res.status(200).json(existing);
  const fromAcct = db.select().from(accounts).where(eq(accounts.id, fromAccountId)).get();
  const toAcct = db.select().from(accounts).where(eq(accounts.id, toAccountId)).get();
  if (!fromAcct || !toAcct) return res.status(404).json({ error: 'Account not found' });
  // Between currencies: what left and what arrived (at the day's rate when it isn't given);
  // within one currency, one amount
  const ctx = currencyContext();
  const fromCurrency = accountCurrency(fromAccountId, ctx);
  const toCurrency = accountCurrency(toAccountId, ctx);
  const crossCurrency = fromCurrency !== toCurrency;
  if (!crossCurrency && toAmount !== undefined && toAmount !== amount) {
    return res.status(400).json({ error: 'Both accounts have the same currency: use one amount' });
  }
  const arrived = crossCurrency
    ? (toAmount ?? convertAmount(amount, fromCurrency, toCurrency, date, ctx))
    : amount;
  if (arrived === null || arrived <= 0) {
    return res.status(422).json({ error: `Enter the amount that arrived in ${toCurrency}` });
  }

  const fromId = txId ?? nanoid();
  const toId = nanoid();
  const shared = { date, notes: notes ?? null };
  const fromTx = newTransferRow({
    ...shared,
    id: fromId,
    accountId: fromAccountId,
    amount: -amount,
    otherAccountName: toAcct.name,
    otherId: toId,
  });
  const toTx = newTransferRow({
    ...shared,
    id: toId,
    accountId: toAccountId,
    amount: arrived,
    otherAccountName: fromAcct.name,
    otherId: fromId,
  });

  db.transaction((tx) => {
    tx.insert(transactions).values(fromTx).run();
    tx.insert(transactions).values(toTx).run();
  });
  refreshMainAmounts([fromId]);
  res.status(201).json(alreadyCreated(fromId));
});

// Existing transactions as transfers: suggestions (an outflow and the same amount arriving
// in another account within a few days), linking two, "Transfer: account" on one, and
// "Not a transfer". The logic is in services/transferService.ts.
const pairSchema = z.object({ transactionId: id, otherTransactionId: id });

/** Runs a transfer change, answering its TransferError as a JSON error */
function transferAction(res: Response, action: () => unknown) {
  try {
    res.json(action());
  } catch (err) {
    if (!(err instanceof TransferError)) throw err;
    res.status(err.status).json({ error: err.message });
  }
}

// GET /transactions/transfers/suggestions?account_id=
transactionsRouter.get('/transfers/suggestions', (req, res) => {
  const accountId = z.string().max(64).optional().safeParse(req.query.account_id);
  if (!accountId.success) return res.status(400).json({ error: accountId.error.flatten() });
  res.json(listTransferSuggestions(accountId.data || undefined));
});

// POST /transactions/transfers/link — two existing transactions become one transfer
transactionsRouter.post('/transfers/link', (req, res) => {
  const parsed = pairSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  transferAction(res, () =>
    linkTransfer(parsed.data.transactionId, parsed.data.otherTransactionId),
  );
});

// POST /transactions/transfers/dismiss — never suggest this pair again
transactionsRouter.post('/transfers/dismiss', (req, res) => {
  const parsed = pairSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  transferAction(res, () => {
    dismissPair(parsed.data.transactionId, parsed.data.otherTransactionId);
    return { ok: true };
  });
});

// POST /transactions/:id/transfer — "Transfer: account" on an existing transaction
transactionsRouter.post('/:id/transfer', (req, res) => {
  const parsed = z
    .object({ accountId: id, otherAmount: cents.positive().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  transferAction(res, () =>
    transferToAccount(req.params.id, parsed.data.accountId, {
      otherAmount: parsed.data.otherAmount,
    }),
  );
});

// POST /transactions/:id/unlink-transfer — "Not a transfer"
// Unlock a reconciled transaction so its amount, date or account can change (or it can be deleted).
// The balance it was reconciled to no longer holds until it is reconciled again.
transactionsRouter.post('/:id/unlock', (req, res) => {
  try {
    res.json(unlockTransaction(req.params.id));
  } catch (error) {
    if (error instanceof ReconciliationError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

transactionsRouter.post('/:id/unlink-transfer', (req, res) => {
  // Undo sends `dismiss: false`, so the pair is suggested again
  const parsed = z.object({ dismiss: z.boolean().optional() }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  transferAction(res, () => unlinkTransfer(req.params.id, parsed.data));
});

// POST /transactions/import/preview — check for duplicates before importing
transactionsRouter.post('/import/preview', (req, res) => {
  const parsed = z
    .object({ accountId: z.string().max(64), rows: importRowsSchema })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { accountId, rows } = parsed.data;
  const existingSet = takenImportedIds(
    accountId,
    rows.map((r) => r.importedId),
  );

  // SEC-01: rows with a different id that look like ones the account already has (typed by hand,
  // synced, scheduled, or an earlier file). Flagged for the person to untick, never skipped.
  const similar = matchExistingRows(rows, existingRowsNear(accountId, rows), existingSet);
  res.json(
    rows.map((row, i) => ({
      ...row,
      isDuplicate: existingSet.has(row.importedId),
      possibleDuplicate: existingSet.has(row.importedId) ? null : similar[i],
    })),
  );
});

// POST /transactions/import/confirm — insert non-duplicate rows
transactionsRouter.post('/import/confirm', (req, res) => {
  const parsed = z
    .object({
      accountId: z.string().max(64),
      rows: importRowsSchema,
      // Shown in the import history; the name of the file the person chose
      fileName: z.string().trim().max(200).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { accountId, rows, fileName } = parsed.data;
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }
  const wanted = [...new Set(rows.map((r) => r.categoryId).filter((c): c is string => !!c))];
  if (
    wanted.length &&
    db.select({ id: categories.id }).from(categories).where(inArray(categories.id, wanted)).all()
      .length !== wanted.length
  )
    return res.status(400).json({ error: 'A category in this import no longer exists' });
  const ruleOpts = {
    rules: loadRules(),
    ctx: buildRuleContext(),
    currencies: currencyContext(),
    // The file's own categories win over rules; rules still fill in the rest
    keepUserCategory: true,
  };

  // One transaction: all rows or none, and far faster than a commit per row
  const outcome = db.transaction(() => {
    let imported = 0;
    let historical = 0;
    const balanceBefore = account.startingBalance + accountTransactionSum(accountId);
    // SEC-01: counted before anything is inserted, so the rows of this file can't match each
    // other. The rows still import; the answer tells the person how many to look at.
    const taken = takenImportedIds(
      accountId,
      rows.map((r) => r.importedId),
    );
    const possibleDuplicates = matchExistingRows(
      rows,
      existingRowsNear(accountId, rows),
      taken,
    ).filter(Boolean).length;
    // Typed as "today's balance": older rows must not change it. Not for a bank-fed account
    // (the bank decides) or one with reconciled rows (those were agreed with a statement).
    const keepsBalance =
      !!account.balanceAsOf &&
      !hasBankFeed(accountId) &&
      !db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.accountId, accountId), eq(transactions.reconciled, 1)))
        .get();
    const batchId = createImportBatch(accountId, fileName || null);
    for (const row of rows) {
      const dup = db
        .select()
        .from(transactions)
        .where(
          and(eq(transactions.accountId, accountId), eq(transactions.importedId, row.importedId)),
        )
        .get();
      if (dup) continue;

      insertNewTransaction(
        {
          accountId,
          date: row.date,
          amount: row.amount,
          payeeId: null,
          payeeName: row.payeeName || null,
          importedPayee: row.payeeName || null,
          notes: row.notes ?? null,
          categoryId: row.categoryId ?? null,
          importedId: row.importedId,
          importBatchId: batchId,
        },
        ruleOpts,
      );
      imported++;
      if (keepsBalance && row.date <= account.balanceAsOf!) historical += row.amount;
    }
    if (historical !== 0)
      db.update(accounts)
        .set({ startingBalance: account.startingBalance - historical })
        .where(eq(accounts.id, accountId))
        .run();
    // The cutoff is kept whenever this import was holding the balance, even if the older rows
    // happened to sum to zero: undoing only some of them (the rest were worked on) still needs it
    finishImportBatch(batchId, imported, keepsBalance ? account.balanceAsOf : null);
    return {
      imported,
      importBatchId: imported > 0 ? batchId : null,
      possibleDuplicates,
      balanceBefore,
      startingBalanceAdjusted: historical !== 0,
      balance: account.startingBalance - historical + accountTransactionSum(accountId),
    };
  });

  res.json({ ...outcome, skipped: rows.length - outcome.imported });
});

// GET /transactions/import/batches — file imports that still have rows in their account (SEC-01)
transactionsRouter.get('/import/batches', (req, res) => {
  const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined;
  res.json(listImportBatches(accountId));
});

// DELETE /transactions/import/batches/:id — "undo this file": removes the rows that import added,
// except those the person has worked on (reconciled, reviewed, transfers, hand splits, household
// shares, attached files). The answer lists what was kept and why, and carries the removed rows in
// the import's own shape so the client's Undo can bring them back through /import/confirm.
transactionsRouter.delete('/import/batches/:id', (req, res) => {
  try {
    res.json(undoImportBatch(req.params.id));
  } catch (err) {
    if (err instanceof ImportBatchError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// POST /transactions/import/link-transfers — after a multi-account import (YNAB), link the two
// legs of each transfer that arrived in the same file. Only exact mirrors (same day, opposite
// amounts, different accounts, neither reconciled nor already a transfer) are linked.
transactionsRouter.post('/import/link-transfers', (req, res) => {
  const parsed = z
    .object({
      pairs: z
        .array(
          z.object({
            accountId: z.string().max(64),
            importedId: z.string().max(500),
            otherAccountId: z.string().max(64),
            otherImportedId: z.string().max(500),
          }),
        )
        .max(20_000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const find = (accountId: string, importedId: string) =>
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.accountId, accountId), eq(transactions.importedId, importedId)))
      .get();
  let linked = 0;
  let skipped = 0;
  for (const p of parsed.data.pairs) {
    const a = find(p.accountId, p.importedId);
    const b = find(p.otherAccountId, p.otherImportedId);
    if (!a || !b || a.date !== b.date || a.amount !== -b.amount || a.amount === 0) {
      skipped++;
      continue;
    }
    try {
      linkTransfer(a.id, b.id);
      linked++;
    } catch (err) {
      if (!(err instanceof TransferError)) throw err;
      skipped++;
    }
  }
  res.json({ linked, skipped });
});

// PUT /transactions/:id
// A split's parts and a transfer's other side are separate rows: keep them in step with
// the row being edited, so budgets and both accounts agree on dates and amounts.
transactionsRouter.put('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const data = parsed.data;
  const changes = (key: keyof typeof data) =>
    data[key] !== undefined && data[key] !== existing[key];
  // A reconciled row is locked to what the bank statement agreed: amount, date and account stay put.
  // Category, notes, tags and payee don't change any balance, so they remain editable.
  if (
    existing.reconciled === 1 &&
    (changes('amount') || changes('date') || changes('accountId') || data.mainAmount !== undefined)
  )
    return res.status(403).json({
      error:
        'Cannot change the amount, date or account of a reconciled transaction. Unlock it first.',
    });
  // A bank feed's row belongs to the account the bank reported it in: moved elsewhere, the next
  // sync would import it again (and Up's would fail on the row's fixed id)
  if (
    changes('accountId') &&
    existing.importedId &&
    (isUpImport(existing.importedId) || hasBankFeed(existing.accountId))
  )
    return res.status(400).json({
      error:
        'This transaction came from your bank feed, so it stays in that account. To record it elsewhere, add it to the other account and delete this one.',
    });
  // Access tokens (assistants) keep the old rule: they never touch a reconciled row at all
  if (existing.reconciled === 1 && /^bearer /i.test(req.headers.authorization ?? ''))
    return res.status(403).json({ error: 'Cannot modify a reconciled transaction' });
  if (
    existing.parentTransactionId &&
    (changes('accountId') || changes('date') || changes('amount'))
  ) {
    return res
      .status(400)
      .json({ error: "Change the split transaction's account, date or amount instead of a part" });
  }
  if (existing.isParent === 1 && (changes('amount') || data.categoryId)) {
    return res.status(400).json({ error: 'Edit the parts of a split transaction instead' });
  }
  if (existing.transferTransactionId) {
    const boundary = db
      .select({ value: isBudgetBoundary.mapWith(Boolean) })
      .from(transactions)
      .where(eq(transactions.id, existing.id))
      .get()!.value;
    if (changes('accountId') || (changes('categoryId') && data.categoryId && !boundary)) {
      return res.status(400).json({
        error:
          'Only the budget side of a boundary transfer can have a category; transfers stay in their accounts',
      });
    }
  }
  const ctx = currencyContext();
  const accountId = data.accountId ?? existing.accountId;
  if (data.accountId !== undefined && !ctx.currencies.has(data.accountId)) {
    return res.status(404).json({ error: 'Account not found' });
  }
  if (
    data.mainAmount !== undefined &&
    (existing.parentTransactionId || !isForeign(ctx.currencies.get(accountId), ctx.budget))
  ) {
    return res.status(400).json({
      error: existing.parentTransactionId
        ? 'Change the value of the whole split transaction instead of a part'
        : "This account is in the budget's currency: its amount is already the value",
    });
  }
  const other = existing.transferTransactionId
    ? db
        .select()
        .from(transactions)
        .where(eq(transactions.id, existing.transferTransactionId))
        .get()
    : undefined;
  // A transfer between two currencies keeps each side's own amount: what left isn't what arrived
  const crossCurrency =
    !!other && accountCurrency(existing.accountId, ctx) !== accountCurrency(other.accountId, ctx);
  if (
    other?.reconciled === 1 &&
    (changes('date') || changes('amount') || data.mainAmount !== undefined)
  ) {
    return res.status(403).json({ error: 'Cannot modify a reconciled transfer counterpart' });
  }
  const { mainAmount, ...fields } = data;

  db.transaction((tx) => {
    if (Object.keys(fields).length) {
      tx.update(transactions).set(fields).where(eq(transactions.id, existing.id)).run();
    }
    if (mainAmount !== undefined) {
      tx.update(transactions)
        .set(
          mainAmount === null
            ? { mainAmountSource: null }
            : { mainAmount, mainAmountSource: 'manual' },
        )
        .where(eq(transactions.id, existing.id))
        .run();
    }
    if (existing.isParent === 1) {
      const shared = {
        accountId: data.accountId,
        date: data.date,
        payeeId: data.payeeId,
        payeeName: data.payeeName,
      };
      if (Object.values(shared).some((v) => v !== undefined)) {
        tx.update(transactions)
          .set(shared)
          .where(eq(transactions.parentTransactionId, existing.id))
          .run();
      }
    }
    const otherAmount = data.amount === undefined || crossCurrency ? undefined : -data.amount;
    if (existing.transferTransactionId && (data.date !== undefined || otherAmount !== undefined)) {
      tx.update(transactions)
        .set({ date: data.date, amount: otherAmount })
        .where(eq(transactions.id, existing.transferTransactionId))
        .run();
    }
  });
  // A typed-in value stays unless what it was for changed (another amount, day or account)
  const moved = changes('amount') || changes('date') || changes('accountId');
  if (moved || mainAmount !== undefined) {
    refreshMainAmounts([existing.id], { keepManual: mainAmount !== undefined || !moved });
  }
  const updated = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  res.json(updated);
});

// DELETE /transactions/:id — handles transfer unlinking and split cascade
transactionsRouter.delete('/:id', (req, res) => {
  const existing = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.reconciled === 1)
    return res.status(403).json({ error: 'Cannot modify a reconciled transaction' });

  if (existing.transferTransactionId) {
    const other = db
      .select()
      .from(transactions)
      .where(eq(transactions.id, existing.transferTransactionId))
      .get();
    if (other?.reconciled === 1) {
      return res.status(403).json({ error: 'Cannot modify a reconciled transfer counterpart' });
    }
  }
  deleteTransactionByOwner(existing);
  res.status(204).send();
});
