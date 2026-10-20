import { Router } from 'express';
import { and, eq, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  accounts,
  transactions,
  upAccountMappings,
  upConnections,
  plaidAccountMappings,
  simplefinAccountMappings,
  enableBankingAccountMappings,
} from '../db/schema.js';
import { cleanUpText, getUpAccounts, upErrorMessage } from '../services/upService.js';
import { isUpSyncing, syncUp, UP_CONNECTION_ID } from '../services/upSyncService.js';
import {
  accountCurrency,
  currencyContext,
  currencyToStore,
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
      })),
  });
});

upRouter.post('/setup', async (req, res) => {
  if (isUpSyncing()) return res.status(409).json({ error: 'Wait for the Up sync to finish.' });
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Enter your Up personal access token.' });
  settingUp = true;
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
      if (!local || local.closedAt || accountCurrency(local.id, currencyContext()) !== 'AUD')
        return res.status(400).json({ error: 'Choose an open account using AUD.' });
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
      if (hasHistory && mapping.accountId !== local.id)
        return res.status(409).json({
          error:
            'Choose an empty account or create a new one. Existing CSV history cannot be matched to Up IDs.',
        });
      if (
        targetIds.has(local.id) ||
        mappings.some((m) => m.upAccountId !== choice.upAccountId && m.accountId === local.id)
      )
        return res.status(409).json({ error: 'Each Up account needs its own FlyBudget account.' });
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
      db.update(upAccountMappings)
        .set({ accountId, isEnabled: 1 })
        .where(eq(upAccountMappings.id, mapping.id))
        .run();
    }
  });
  res.json({ mapped: parsed.data.mappings.length });
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
