import { Router } from 'express';
import { and, eq, ne, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  upSourceRecords,
  plaidAccountMappings,
  simplefinAccountMappings,
  enableBankingAccountMappings,
} from '../db/schema.js';
import {
  addCutoverOpeningBalance,
  CutoverError,
  isValidDay,
  refreshCutoverDifference,
} from '../services/upCutover.js';
import { deleteTransactionRow } from '../services/transactionHelpers.js';
import { cleanUpText, getUpAccounts, upErrorMessage } from '../services/upService.js';
import {
  isUpSyncing,
  syncUp,
  UP_CONNECTION_ID,
  setUpConnecting,
  nextUpSyncAt,
  UP_POLL_INTERVALS,
} from '../services/upSyncService.js';
import {
  enableRoundUpDebits,
  roundUpCheck,
  roundUpDays,
  RoundUpError,
  upReview,
  upTransactionId,
} from '../services/upReviewService.js';
import { buildRuleContext, insertNewTransaction, loadRules } from '../services/ruleService.js';
import {
  accountCurrency,
  currencyContext,
  currencyToStore,
  startBudgetIfNew,
} from '../services/mainAmountService.js';
import { accountTypeSchema, defaultOffBudget } from '../utils/accountTypes.js';

export const upRouter = Router();
let settingUp = false;
upRouter.use((req, res, next) => {
  if (settingUp && req.method !== 'GET')
    return res.status(409).json({ error: 'Wait for the Up connection to finish.' });
  next();
});
const tokenSchema = z.object({
  accessToken: z
    .string()
    .trim()
    .min(1)
    .max(4_096)
    .regex(/^[\x21-\x7e]+$/),
});
const mappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        upAccountId: z.string().min(1).max(256),
        action: z.enum(['create', 'link', 'skip']),
        accountId: z.string().min(1).max(64).optional(),
        accountName: z.string().trim().min(1).max(200).optional(),
        accountType: accountTypeSchema.optional(),
        /** Link to an account that already has history: Up rows from this day on are imported */
        cutoverDate: z.string().max(10).optional(),
      }),
    )
    .min(1)
    .max(1_000),
});

upRouter.get('/connection', (_req, res) => {
  // Never select the access token for a client response.
  const connection = db
    .select({
      id: upConnections.id,
      syncStatus: upConnections.syncStatus,
      syncError: upConnections.syncError,
      lastSyncedAt: upConnections.lastSyncedAt,
      pollIntervalMinutes: upConnections.pollIntervalMinutes,
      lastAttemptAt: upConnections.lastAttemptAt,
      lastCompletedAt: upConnections.lastCompletedAt,
      nextSyncAt: upConnections.nextSyncAt,
    })
    .from(upConnections)
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .get();
  if (!connection) return res.json(null);
  const local = new Map(
    db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .all()
      .map((a) => [a.id, a.name]),
  );
  res.json({
    ...connection,
    accounts: db
      .select()
      .from(upAccountMappings)
      .all()
      .map((m) => ({
        upAccountId: m.upAccountId,
        name: m.name,
        accountType: m.accountType,
        accountId: m.accountId,
        accountName: m.accountId ? (local.get(m.accountId) ?? null) : null,
        isEnabled: m.isEnabled,
        cutoverDate: m.cutoverDate,
        cutoverDifference: m.cutoverDifference,
      })),
  });
});

upRouter.post('/setup', async (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Enter your Up personal access token.' });
  settingUp = true;
  setUpConnecting(true);
  try {
    const discovered = await getUpAccounts(parsed.data.accessToken);
    if (!discovered.length)
      return res.status(422).json({ error: 'Up did not return any accounts.' });
    if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
    db.transaction(() => {
      db.insert(upConnections)
        .values({ id: UP_CONNECTION_ID, accessToken: parsed.data.accessToken })
        .onConflictDoUpdate({
          target: upConnections.id,
          set: { accessToken: parsed.data.accessToken, syncStatus: 'good', syncError: null },
        })
        .run();
      db.delete(upAccountMappings)
        .where(ne(upAccountMappings.connectionId, UP_CONNECTION_ID))
        .run();
      const ids = discovered.map((a) => a.id);
      for (const old of db.select().from(upAccountMappings).all()) {
        if (!ids.includes(old.upAccountId))
          db.delete(upAccountMappings).where(eq(upAccountMappings.id, old.id)).run();
      }
      for (const a of discovered)
        db.insert(upAccountMappings)
          .values({
            id: `up:${a.id}`,
            connectionId: UP_CONNECTION_ID,
            upAccountId: a.id,
            name: cleanUpText(a.attributes.displayName).slice(0, 200) || 'Up account',
            accountType: a.attributes.accountType,
          })
          .onConflictDoUpdate({
            target: upAccountMappings.id,
            set: {
              name: cleanUpText(a.attributes.displayName).slice(0, 200) || 'Up account',
              accountType: a.attributes.accountType,
            },
          })
          .run();
    });
    const current = new Map(
      db
        .select()
        .from(upAccountMappings)
        .all()
        .map((m) => [m.upAccountId, m]),
    );
    res.json({
      accounts: discovered.map((a) => ({
        upAccountId: a.id,
        name: current.get(a.id)!.name,
        accountType: a.attributes.accountType,
        balance: a.attributes.balance.valueInBaseUnits,
        accountId: current.get(a.id)!.accountId,
        isEnabled: current.get(a.id)!.isEnabled,
      })),
    });
  } catch (err) {
    res.status(422).json({ error: upErrorMessage(err) });
  } finally {
    settingUp = false;
    setUpConnecting(false);
  }
});

upRouter.post('/map-accounts', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = mappingSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Choose how to set up each Up account.' });
  const mappings = db.select().from(upAccountMappings).all();
  const seen = new Set<string>();
  const targetIds = new Set<string>();
  // Validate every choice before creating anything, including currencies and duplicate targets.
  for (const choice of parsed.data.mappings) {
    const mapping = mappings.find((m) => m.upAccountId === choice.upAccountId);
    if (!mapping || seen.has(choice.upAccountId))
      return res.status(400).json({ error: 'Choose each available Up account once.' });
    seen.add(choice.upAccountId);
    if (choice.action === 'create' && mapping.accountId)
      return res
        .status(409)
        .json({ error: 'This Up account is already linked. Keep its existing account.' });
    if (choice.action === 'link') {
      const local =
        choice.accountId &&
        db.select().from(accounts).where(eq(accounts.id, choice.accountId)).get();
      if (!local || local.closedAt)
        return res.status(400).json({ error: 'Choose an open account using AUD.' });
      // Its own currency, else the budget's. A budget with no currency yet is still undecided:
      // linking Up (AUD only) makes it AUD, as creating an Up account does.
      const currency = accountCurrency(local.id, currencyContext());
      if (currency !== null && currency !== 'AUD')
        return res.status(400).json({
          error: `${local.name} uses ${currency}. Up only syncs AUD accounts: choose an account in AUD or create a new one.`,
        });
      if (mapping.accountId && mapping.accountId !== local.id)
        return res.status(409).json({
          error:
            'Keep the existing account link to avoid importing the same history into two accounts.',
        });
      const otherFeed = [
        plaidAccountMappings,
        simplefinAccountMappings,
        enableBankingAccountMappings,
      ].some((table) =>
        db
          .select({ id: table.id })
          .from(table)
          .where(and(eq(table.accountId, local.id), eq(table.isEnabled, 1)))
          .get(),
      );
      if (otherFeed)
        return res
          .status(409)
          .json({ error: 'Disconnect the other bank feed from this account before linking Up.' });
      const hasHistory = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.accountId, local.id))
        .get();
      const newLink = mapping.accountId !== local.id;
      if (choice.cutoverDate !== undefined && !isValidDay(choice.cutoverDate))
        return res.status(400).json({ error: 'Choose a valid cut-over date.' });
      if (choice.cutoverDate !== undefined && newLink && !hasHistory)
        return res
          .status(400)
          .json({ error: 'A cut-over date only applies to an account that already has history.' });
      if (hasHistory && newLink && choice.cutoverDate === undefined)
        return res.status(409).json({
          error:
            'This account already has transactions. Choose the date Up should take over from, or pick an empty account.',
        });
      if (
        targetIds.has(local.id) ||
        mappings.some((m) => m.upAccountId !== choice.upAccountId && m.accountId === local.id)
      )
        return res.status(409).json({ error: 'Each Up account needs its own Allotment account.' });
      targetIds.add(local.id);
    }
  }
  db.transaction(() => {
    for (const choice of parsed.data.mappings) {
      const mapping = mappings.find((m) => m.upAccountId === choice.upAccountId)!;
      if (choice.action === 'skip') {
        db.update(upAccountMappings)
          .set({ isEnabled: 0 })
          .where(eq(upAccountMappings.id, mapping.id))
          .run();
        continue;
      }
      let accountId = choice.accountId;
      if (choice.action === 'link' && accountCurrency(accountId!, currencyContext()) === null)
        currencyToStore('AUD'); // the budget had no currency: it is AUD now
      if (choice.action === 'create') {
        accountId = nanoid();
        const type =
          choice.accountType ??
          (mapping.accountType === 'SAVER'
            ? 'savings'
            : mapping.accountType === 'HOME_LOAN'
              ? 'mortgage'
              : 'checking');
        db.insert(accounts)
          .values({
            id: accountId,
            name: choice.accountName || mapping.name,
            type,
            currency: currencyToStore('AUD'),
            startingBalance: 0,
            isOffBudget: defaultOffBudget(type),
          })
          .run();
      }
      // The cut-over is set once, when the link is made; later saves keep it
      const cutoverDate =
        choice.action === 'link' && mapping.accountId !== accountId
          ? choice.cutoverDate
          : undefined;
      db.update(upAccountMappings)
        .set({ accountId, isEnabled: 1, ...(cutoverDate ? { cutoverDate } : {}) })
        .where(eq(upAccountMappings.id, mapping.id))
        .run();
    }
  });
  // A new budget starts this month: imported bank history stays in accounts and reports
  // instead of turning every past purchase into overspending (Settings → Budget start)
  const budgetStartMonth = startBudgetIfNew();
  res.json({ mapped: parsed.data.mappings.length, budgetStartMonth });
});

upRouter.post('/sync', async (_req, res) => {
  if (!db.select({ id: upConnections.id }).from(upConnections).get())
    return res.status(404).json({ error: 'Connect Up first.' });
  res.json(await syncUp());
});

upRouter.delete('/connection', (_req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  db.delete(upConnections).where(eq(upConnections.id, UP_CONNECTION_ID)).run();
  res.status(204).send();
});

upRouter.patch('/settings', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = z
    .object({ pollIntervalMinutes: z.union(UP_POLL_INTERVALS.map((v) => z.literal(v))) })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Choose a supported background sync interval.' });
  const connection = db
    .select({ id: upConnections.id, failureCount: upConnections.failureCount })
    .from(upConnections)
    .where(eq(upConnections.id, UP_CONNECTION_ID))
    .get();
  if (!connection) return res.status(404).json({ error: 'Connect Up first.' });
  const minutes = parsed.data.pollIntervalMinutes;
  db.update(upConnections)
    .set({
      pollIntervalMinutes: minutes,
      nextSyncAt: nextUpSyncAt(minutes, connection.failureCount),
    })
    .where(eq(upConnections.id, connection.id))
    .run();
  res.json({ pollIntervalMinutes: minutes });
});

upRouter.get('/review', (req, res) => {
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(2_000_000)
    .safeParse(req.query.offset ?? 0);
  if (!offset.success) return res.status(400).json({ error: 'Invalid review page.' });
  res.json(upReview(offset.data));
});
upRouter.post('/review/acknowledge', (req, res) => {
  const parsed = z
    .object({ importedId: z.string().min(1).max(1024), revision: z.number().int().positive() })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Choose a review item and its current revision.' });
  const updated = db
    .update(upSourceRecords)
    .set({ reviewState: 'reviewed', previousJson: null })
    .where(
      and(
        eq(upSourceRecords.importedId, parsed.data.importedId),
        eq(upSourceRecords.revision, parsed.data.revision),
        inArray(upSourceRecords.reviewState, ['new', 'changed', 'missing', 'overlap']),
      ),
    )
    .run();
  if (!updated.changes)
    return res
      .status(409)
      .json({ error: 'This item changed or was already reviewed. Refresh before reviewing it.' });
  res.json({ reviewed: true });
});
/**
 * Delete the older row a flagged import may duplicate. The Up row stays. One click, but only
 * for a row nobody has reconciled, and only while the flag is as the owner saw it.
 */
upRouter.post('/review/overlap/delete-old', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = z
    .object({ importedId: z.string().min(1).max(1024), revision: z.number().int().positive() })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Choose a review item and its current revision.' });
  const record = db
    .select()
    .from(upSourceRecords)
    .where(
      and(
        eq(upSourceRecords.importedId, parsed.data.importedId),
        eq(upSourceRecords.revision, parsed.data.revision),
        eq(upSourceRecords.reviewState, 'overlap'),
      ),
    )
    .get();
  if (!record)
    return res
      .status(409)
      .json({ error: 'This item changed or was already reviewed. Refresh before reviewing it.' });
  const old = record.overlapTransactionId
    ? db.select().from(transactions).where(eq(transactions.id, record.overlapTransactionId)).get()
    : undefined;
  if (old) {
    if (old.reconciled === 1)
      return res.status(409).json({
        error: 'That older transaction is reconciled. Unlock it first, or keep both.',
      });
    if (old.importedId?.startsWith('up:'))
      return res.status(409).json({ error: 'That is an Up import. Keep both.' });
    if (old.transferTransactionId) {
      const other = db
        .select({ reconciled: transactions.reconciled })
        .from(transactions)
        .where(eq(transactions.id, old.transferTransactionId))
        .get();
      if (other?.reconciled === 1)
        return res
          .status(409)
          .json({ error: 'That older transaction is linked to a reconciled one.' });
    }
  }
  db.transaction(() => {
    if (old) deleteTransactionRow(old);
    if (old) refreshCutoverDifference(old.accountId);
    db.update(upSourceRecords)
      .set({ reviewState: 'reviewed', previousJson: null })
      .where(eq(upSourceRecords.importedId, record.importedId))
      .run();
  });
  res.json({ deleted: !!old });
});
upRouter.post('/cutover/opening-balance', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = z
    .object({ accountId: z.string().min(1).max(64), expected: z.number().int() })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose an account and its amount.' });
  try {
    res.json(addCutoverOpeningBalance(parsed.data.accountId, parsed.data.expected));
  } catch (err) {
    if (err instanceof CutoverError) return res.status(409).json({ error: err.message });
    throw err;
  }
});
upRouter.get('/round-ups', (_req, res) => {
  // Bank-local dates can be a day ahead/behind UTC; include an extra day at this boundary.
  const since = new Date(Date.now() - 91 * 86400_000).toISOString().slice(0, 10);
  res.json({ since, days: roundUpDays(since) });
});

upRouter.get('/round-up-check', (_req, res) => {
  res.json(roundUpCheck().map(({ rows: _rows, ...check }) => check));
});
upRouter.post('/round-up-debits', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = z
    .object({
      accountId: z.string().min(1).max(64),
      count: z.number().int().min(1).max(100_000),
      total: z.number().int().min(-1e13).max(-1),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose the round-ups to add.' });
  const { accountId, count, total } = parsed.data;
  const ruleOpts = {
    rules: loadRules(),
    ctx: buildRuleContext(),
    currencies: currencyContext(),
  };
  try {
    res.json(
      enableRoundUpDebits(accountId, { count, total }, (row) =>
        insertNewTransaction(
          {
            ...row,
            id: upTransactionId(accountId, row.importedId),
            accountId,
            payeeId: null,
            importedPayee: row.payeeName,
            categoryId: null,
          },
          ruleOpts,
        ),
      ),
    );
  } catch (err) {
    if (err instanceof RoundUpError) return res.status(409).json({ error: err.message });
    throw err;
  }
});
/** Stops adding new round-up debits. Rows already added stay, like any imported row. */
upRouter.delete('/round-up-debits/:accountId', (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  db.update(upAccountMappings)
    .set({ roundUpDebitsAt: null })
    .where(eq(upAccountMappings.accountId, req.params.accountId))
    .run();
  res.status(204).send();
});
