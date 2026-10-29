import { bankLinked } from '../services/accountIntegrity.js';
import { Router } from 'express';
import {
  AccountDeletionError,
  deleteAccountWithTransactions,
  previewAccountDeletion,
} from '../services/accountDeletion.js';
import {
  reconcile,
  lastReconciliation,
  recordReconciliation,
  undoLastReconciliation,
  reconciliationSnapshot,
  ReconciliationError,
} from '../services/reconciliationService.js';
import { db } from '../db/index.js';
import {
  cardFunding,
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
} from '../db/schema.js';
import { roundUpCheck } from '../services/upReviewService.js';
import { poolGroupOf } from '../services/householdService.js';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { logoSchema } from '../utils/logo.js';
import { accountTypeSchema, defaultOffBudget } from '../utils/accountTypes.js';
import { accountTransactionSum, inAccountBalance } from '../services/balances.js';
import {
  bookedValue,
  budgetCurrency,
  currencyContext,
  currencyToStore,
  valueToday,
  type CurrencyContext,
} from '../services/mainAmountService.js';
import { currencySchema } from '../utils/validation.js';
import {
  importSettingsSchema,
  readImportSettings,
  readStatementAccount,
  statementAccountSchema,
  storeImportSettings,
} from '../utils/importSettings.js';

export const accountsRouter = Router();

const fields = {
  name: z.string().trim().min(1).max(200),
  type: accountTypeSchema,
  startingBalance: z.number().int(),
  isOffBudget: z.number().int().min(0).max(1),
  /** ISO 4217; null or the budget's own = the budget's currency */
  currency: currencySchema.nullable(),
};

const createSchema = z.object({
  ...fields,
  startingBalance: fields.startingBalance.default(0),
  isOffBudget: fields.isOffBudget.optional(),
  currency: fields.currency.optional(),
});

// Built without defaults: Zod applies `.default()` even inside `.partial()`, so an update
// that only renames an account would otherwise reset its starting balance to 0
const updateSchema = z.object(fields).partial().extend({
  logo: logoSchema.optional(),
  // Reopens a closed account (undo of "Close account"); closing is DELETE
  closedAt: z.null().optional(),
});

/**
 * An account as the API shows it: its balance, its currency (the budget's when it has none
 * of its own) and the balance in the budget's currency at the latest rate (null without one)
 */
function shown(
  account: typeof accounts.$inferSelect,
  balance: number,
  hasTransactions: boolean,
  ctx: CurrencyContext,
) {
  const currency = account.currency ?? ctx.budget;
  const value = valueToday(balance, currency, ctx);
  // In another currency: how much more (or less) it's worth today than it was counted as
  let currencyDifference: number | null = null;
  if (value.rateDate && value.mainBalance !== null) {
    const booked = bookedValue(account, ctx);
    currencyDifference = booked === null ? null : value.mainBalance - booked;
  }
  // A household pool sits outside the personal budget even though it isn't off budget
  const householdPool = poolGroupOf(account.id)?.name ?? null;
  // Bank import settings (an IBAN, for one) have their own route: GET /:id/import-settings
  const { importSettings: _importSettings, ...rest } = account;
  return {
    ...rest,
    currency,
    balance,
    hasTransactions,
    householdPool,
    // A bank feed supplies this account's transactions: a hand-entered row will disagree with the bank
    bankLinked: bankLinked(account.id),
    ...value,
    currencyDifference,
  };
}

function withBalance(account: typeof accounts.$inferSelect) {
  const sum = accountTransactionSum(account.id);
  const any = !!db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .get();
  return shown(account, account.startingBalance + sum, any, currencyContext());
}

const storedCurrency = currencyToStore;

accountsRouter.get('/', (req, res) => {
  const rows = db
    .select()
    .from(accounts)
    .where(req.query.include_closed === '1' ? undefined : isNull(accounts.closedAt))
    .orderBy(accounts.sortOrder)
    .all();
  if (!rows.length) return res.json([]);

  const sums = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`coalesce(sum(case when ${inAccountBalance} then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .groupBy(transactions.accountId)
    .all();

  const sumMap = new Map(sums.map((s) => [s.accountId, s.sum]));
  const ctx = currencyContext();
  res.json(
    rows.map((a) => shown(a, a.startingBalance + (sumMap.get(a.id) ?? 0), sumMap.has(a.id), ctx)),
  );
});

// Bank sync health without any connection data (no tokens, bank ids or errors): when each Up
// account last synced, the bank's settled balance against the register, and whether missing
// round-up debits explain the difference. Readable by access tokens, for an assistant.
accountsRouter.get('/sync-status', (_req, res) => {
  const connections = db
    .select({
      id: upConnections.id,
      syncStatus: upConnections.syncStatus,
      lastSyncedAt: upConnections.lastSyncedAt,
    })
    .from(upConnections)
    .all();
  const mappings = new Map(
    db
      .select({
        accountId: upAccountMappings.accountId,
        connectionId: upAccountMappings.connectionId,
      })
      .from(upAccountMappings)
      .all()
      .map((m) => [m.accountId, m.connectionId]),
  );
  res.json(
    roundUpCheck().map((c) => {
      const connection = connections.find((x) => x.id === mappings.get(c.accountId));
      return {
        accountId: c.accountId,
        accountName: c.accountName,
        provider: 'up',
        syncStatus: connection?.syncStatus ?? null,
        lastSyncedAt: connection?.lastSyncedAt ?? null,
        bankBalance: c.settledBalance,
        registerBalance: c.register,
        difference: c.difference,
        verdict: c.verdict,
        missingRoundUps: c.missing,
        roundUpDebitsEnabled: !!c.enabledAt,
      };
    }),
  );
});

accountsRouter.get('/balances-ago', (_req, res) => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const cutoff = oneMonthAgo.toISOString().slice(0, 10);

  const rows = db.select().from(accounts).where(isNull(accounts.closedAt)).all();
  const sums = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(sql`${transactions.date} < ${cutoff}`, inAccountBalance))
    .groupBy(transactions.accountId)
    .all();

  const sumMap = Object.fromEntries(sums.map((s) => [s.accountId, s.sum]));
  const result: Record<string, number> = {};
  for (const a of rows) {
    result[a.id] = a.startingBalance + (sumMap[a.id] ?? 0);
  }
  res.json(result);
});

accountsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = {
    id: nanoid(),
    ...parsed.data,
    currency: storedCurrency(parsed.data.currency) ?? null,
    // Homes, cars, investments and loans stay off budget unless asked otherwise
    isOffBudget: parsed.data.isOffBudget ?? defaultOffBudget(parsed.data.type),
    sortOrder: 0,
    closedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert(accounts).values(account).run();
  res.status(201).json(withBalance(account as typeof accounts.$inferSelect));
});

accountsRouter.put('/reorder', (req, res) => {
  const parsed = z.object({ ids: z.array(z.string().max(64)).max(10_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.transaction((tx) => {
    parsed.data.ids.forEach((id, i) => {
      tx.update(accounts).set({ sortOrder: i }).where(eq(accounts.id, id)).run();
    });
  });
  res.json({ ok: true });
});

accountsRouter.get('/:id/reconcile', (req, res) => {
  try {
    res.json(reconciliationSnapshot(req.params.id));
  } catch (error) {
    if (error instanceof ReconciliationError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

accountsRouter.get('/:id/reconcile/last', (req, res) => {
  res.json(lastReconciliation(req.params.id));
});

accountsRouter.post('/:id/reconcile/undo', (req, res) => {
  try {
    res.json(undoLastReconciliation(req.params.id));
  } catch (error) {
    if (error instanceof ReconciliationError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

accountsRouter.post('/:id/reconcile', (req, res) => {
  const parsed = z
    .object({
      transactionIds: z.array(z.string().min(1).max(64)).max(100_000),
      statementBalance: z.number().int().min(-1e13).max(1e13),
      expectedBalance: z.number().int().min(-1e13).max(1e13),
      revision: z.string().min(1).max(200),
      createAdjustment: z.boolean(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(reconcile(req.params.id, parsed.data));
  } catch (error) {
    if (error instanceof ReconciliationError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

accountsRouter.put('/:id/reconcile', (req, res) => {
  const parsed = z
    .object({ transactionIds: z.array(z.string().max(64)).min(1).max(100_000) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (bankLinked(req.params.id)) {
    const selected = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, req.params.id),
          inArray(transactions.id, parsed.data.transactionIds),
        ),
      )
      .all();
    if (
      selected.some((t) => t.amount > 0 && !t.reconciled && t.importedId?.startsWith('schedule:'))
    )
      return res
        .status(409)
        .json({ error: 'Review generated income against its bank receipt before reconciling.' });
  }

  // Only this account's transactions
  const result = db.transaction(() => {
    const pending = db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, req.params.id),
          inArray(transactions.id, parsed.data.transactionIds),
          ne(transactions.reconciled, 1),
        ),
      )
      .all()
      .map((t) => t.id);
    if (pending.length) {
      db.update(transactions).set({ reconciled: 1 }).where(inArray(transactions.id, pending)).run();
      recordReconciliation(req.params.id, pending, 0);
    }
    return pending.length;
  });

  res.json({ reconciled: result });
});

const storedImportSettings = (id: string) =>
  db
    .select({ importSettings: accounts.importSettings })
    .from(accounts)
    .where(eq(accounts.id, id))
    .get();

accountsRouter.get('/:id/import-settings', (req, res) => {
  const account = storedImportSettings(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json({
    settings: readImportSettings(account.importSettings),
    statementAccount: readStatementAccount(account.importSettings),
  });
});

/** Saves one part of the import settings (CSV settings or statement account), keeping the other */
function saveImportSettingsPart(
  id: string,
  change: Parameters<typeof storeImportSettings>[1],
): boolean {
  return db.transaction((tx) => {
    const account = tx
      .select({ importSettings: accounts.importSettings })
      .from(accounts)
      .where(eq(accounts.id, id))
      .get();
    if (!account) return false;
    tx.update(accounts)
      .set({ importSettings: storeImportSettings(account.importSettings, change) })
      .where(eq(accounts.id, id))
      .run();
    return true;
  });
}

accountsRouter.put('/:id/import-settings', (req, res) => {
  const parsed = importSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!saveImportSettingsPart(req.params.id, { settings: parsed.data })) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ settings: parsed.data });
});

accountsRouter.put('/:id/statement-account', (req, res) => {
  const parsed = z.object({ account: statementAccountSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!saveImportSettingsPart(req.params.id, { statementAccount: parsed.data.account })) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ statementAccount: parsed.data.account });
});

accountsRouter.put('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = db.select().from(accounts).where(eq(accounts.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  if (
    db.select().from(cardFunding).where(eq(cardFunding.accountId, existing.id)).get() &&
    ((parsed.data.isOffBudget !== undefined && parsed.data.isOffBudget !== 0) ||
      (parsed.data.type !== undefined &&
        !['credit', 'line_of_credit'].includes(parsed.data.type)) ||
      (parsed.data.currency !== undefined &&
        (parsed.data.currency ?? budgetCurrency()) !== (existing.currency ?? budgetCurrency())))
  )
    return res.status(409).json({
      error: 'An account with payment funding must keep its credit type, budget scope and currency',
    });
  const data = { ...parsed.data };
  const household = poolGroupOf(existing.id);
  if (
    household &&
    data.currency !== undefined &&
    (data.currency ?? budgetCurrency()) !== household.currency
  )
    return res.status(409).json({ error: 'A household pool must keep its declared currency' });
  if (data.currency !== undefined) {
    const budget = budgetCurrency();
    const before = existing.currency ?? budget;
    const after = data.currency ?? budget;
    if (after !== before) {
      // Its amounts are in its currency: another one would change what they mean
      const any = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.accountId, existing.id))
        .get();
      if (any) {
        return res.status(409).json({
          error:
            "An account's currency can't change once it has transactions. Add a new account in the other currency and move the money with a transfer.",
        });
      }
    }
    data.currency = storedCurrency(data.currency);
  }

  if (Object.keys(data).length) {
    db.update(accounts).set(data).where(eq(accounts.id, req.params.id)).run();
  }
  const updated = db.select().from(accounts).where(eq(accounts.id, req.params.id)).get()!;
  res.json(withBalance(updated));
});

// Delete an account and all its transactions for good (typed name). Closing stays DELETE /:id.
accountsRouter.get('/:id/deletion', (req, res) => {
  try {
    res.json(previewAccountDeletion(req.params.id));
  } catch (error) {
    if (error instanceof AccountDeletionError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

accountsRouter.post('/:id/delete-permanently', (req, res) => {
  const parsed = z
    .object({ confirmName: z.string().max(500) })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Type the account name to confirm' });
  try {
    res.json(deleteAccountWithTransactions(req.params.id, parsed.data.confirmName));
  } catch (error) {
    if (error instanceof AccountDeletionError)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

accountsRouter.delete('/:id', (req, res) => {
  const result = db.transaction(() => {
    const account = db.select().from(accounts).where(eq(accounts.id, req.params.id)).get();
    if (!account) return 'missing';
    if (account.startingBalance + accountTransactionSum(account.id) !== 0) return 'nonzero';
    db.update(accounts)
      .set({ closedAt: new Date().toISOString() })
      .where(eq(accounts.id, account.id))
      .run();
    return null;
  });
  if (result === 'missing') return res.status(404).json({ error: 'Account not found' });
  if (result === 'nonzero')
    return res.status(409).json({
      error:
        'Reconcile this account to zero before closing it. Closing does not remove its money or debt.',
    });
  res.status(204).send();
});
