import path from 'path';
import { isoDate } from '../utils/validation.js';
import { getTableColumns, isNotNull, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { databasePath, db, sqlite } from '../db/index.js';
import {
  householdGroups,
  householdPeople,
  householdEvents,
  householdShares,
  householdBills,
  accounts,
  budgetSettings,
  exchangeRates,
  budgetMonths,
  budgetMoves,
  categories,
  cardFunding,
  categoryTargets,
  categoryGroups,
  customReports,
  dashboardPages,
  dashboardWidgets,
  goals,
  payees,
  plaidAccountMappings,
  rules,
  scheduleMatchDismissals,
  scheduleOccurrences,
  schedules,
  simplefinAccountMappings,
  upAccountMappings,
  upSourceRecords,
  enableBankingAccountMappings,
  transactions,
  transferMatchDismissals,
  paydayPlans,
  paydayFundingEvents,
  paydayFundingReceipts,
  financialPriorities,
  categoryPurposes,
  goalStatusEvents,
  reviewCompletions,
  incomeReviews,
  tags,
  transactionTags,
  savedViews,
  forecastScenarios,
  securities,
  securityPrices,
  holdings,
  taxLots,
  accountLoanDetails,
  longTermPlans,
  longTermEvents,
  longTermAccountAssumptions,
  longTermSplits,
} from '../db/schema.js';
import { paydayConfigSchema, fundingSnapshotSchema } from './paydayConfig.js';
import { fillMissingMainAmounts, ratesChanged } from './mainAmountService.js';
import { upObservationSchema } from './upTransactions.js';
import { targetSchema } from './targetConfig.js';
import { CADENCES, PURPOSES, reviewSnapshotSchema } from './resilienceConfig.js';
import { GOAL_STATUSES } from './goalLifecycle.js';
import { purposeError } from './resilienceService.js';
import { validateViewQuery } from './transactionMarks.js';
import { scenarioSchema } from './forecastConfig.js';
import {
  accountAssumptionSchema,
  eventSchema,
  settingsSchema,
  splitSchema,
} from './longTermConfig.js';
import { loanDetailsSchema } from './loanDetails.js';
import { SECURITY_KINDS } from './investmentService.js';
import { isCurrencyCode } from '../utils/currencies.js';

// Full JSON backup of the user's data, and restoring one.
//
// Bank credentials (Plaid/SimpleFIN), the server password and login sessions are
// never included: a backup file is easy to leave lying around, and credentials are
// encrypted with a key that only this installation has anyway. After a restore,
// connected banks keep syncing into the same accounts when the backup came from
// this installation.

export const BACKUP_FORMAT = 'flybudget-backup';
export const BACKUP_VERSION = 16;

/** Every table in a backup, parents before the tables that reference them. */
const TABLES = {
  budgetSettings,
  exchangeRates,
  accounts,
  accountLoanDetails,
  categoryGroups,
  categories,
  cardFunding,
  categoryTargets,
  payees,
  schedules,
  transactions,
  upSourceRecords,
  scheduleOccurrences,
  scheduleMatchDismissals,
  transferMatchDismissals,
  budgetMonths,
  budgetMoves,
  rules,
  tags,
  transactionTags,
  savedViews,
  forecastScenarios,
  longTermPlans,
  longTermEvents,
  longTermAccountAssumptions,
  longTermSplits,
  customReports,
  dashboardPages,
  dashboardWidgets,
  goals,
  goalStatusEvents,
  paydayPlans,
  paydayFundingEvents,
  paydayFundingReceipts,
  financialPriorities,
  categoryPurposes,
  reviewCompletions,
  incomeReviews,
  householdGroups,
  householdPeople,
  householdEvents,
  householdShares,
  householdBills,
  securities,
  securityPrices,
  holdings,
  taxLots,
} satisfies Record<string, SQLiteTable>;

export type BackupTable = keyof typeof TABLES;
export const BACKUP_TABLES = Object.keys(TABLES) as BackupTable[];

const MAX_ROWS_PER_TABLE = 2_000_000;

export function createBackup() {
  const data: Record<string, unknown> = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
  };
  db.transaction((tx) => {
    for (const name of BACKUP_TABLES) data[name] = tx.select().from(TABLES[name]).all();
  });
  return data;
}

export class InvalidBackupError extends Error {}

type Row = Record<string, unknown>;

/**
 * Checks a backup's shape against the schema: every table is a list of rows, and every
 * column has the right type (SQLite would otherwise happily store "abc" as an amount).
 * Tables missing from older backups are restored as empty. Unknown fields are dropped.
 */
/** A parsed backup: its rows, and whether it's from before the budget had a currency */
export type ParsedBackup = Record<BackupTable, Row[]> & { beforeCurrencies?: boolean };

export function parseBackup(input: unknown): ParsedBackup {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidBackupError('This is not a FlyBudget backup file');
  }
  const body = input as Record<string, unknown>;
  const isV1 = body.format === undefined && Array.isArray(body.accounts);
  if (!isV1 && body.format !== BACKUP_FORMAT) {
    throw new InvalidBackupError('This is not a FlyBudget backup file');
  }
  if (typeof body.version === 'number' && body.version > BACKUP_VERSION) {
    throw new InvalidBackupError('This backup was made by a newer version of FlyBudget');
  }

  const result = {} as ParsedBackup;
  // Made before currencies existed: it has no budget settings, and restoring it keeps this
  // budget's currency (it was only a symbol then)
  if (body.budgetSettings === undefined) {
    Object.defineProperty(result, 'beforeCurrencies', { value: true, enumerable: false });
  }
  for (const name of BACKUP_TABLES) {
    const rows = body[name] ?? [];
    if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_TABLE) {
      throw new InvalidBackupError(`"${name}" in the backup is not a list of rows`);
    }
    const columns = Object.entries(getTableColumns(TABLES[name]));
    result[name] = rows.map((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new InvalidBackupError(`Row ${i + 1} of "${name}" is not valid`);
      }
      const row: Row = {};
      for (const [key, column] of columns) {
        const value = (raw as Row)[key];
        if (value === undefined || value === null) {
          if (column.notNull && !column.hasDefault) {
            throw new InvalidBackupError(`Row ${i + 1} of "${name}" is missing "${key}"`);
          }
          if (value === null && !column.notNull) row[key] = null;
          continue;
        }
        const ok =
          column.columnType === 'SQLiteInteger'
            ? Number.isSafeInteger(value)
            : typeof value === 'string' && value.length <= 1_000_000;
        if (!ok) throw new InvalidBackupError(`Row ${i + 1} of "${name}" has an invalid "${key}"`);
        row[key] = value;
      }
      // Budget start (format 15). Older backups have none: every month counts.
      if (
        name === 'budgetSettings' &&
        row.budgetStartMonth != null &&
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(row.budgetStartMonth))
      ) {
        throw new InvalidBackupError(
          `Row ${i + 1} of "budgetSettings" has an invalid budget start`,
        );
      }
      if (name === 'cardFunding') {
        try {
          const ids = JSON.parse(String(row.baselineIds));
          if (
            !Array.isArray(ids) ||
            ids.some((id) => typeof id !== 'string') ||
            !isoDate.safeParse(row.startDate).success ||
            Number(row.initialFunding) < 0 ||
            Number(row.initialFunding) > 1e13
          )
            throw new Error();
        } catch {
          throw new InvalidBackupError('Invalid card funding setup');
        }
      }
      if (name === 'paydayPlans') {
        try {
          paydayConfigSchema.parse(JSON.parse(row.configJson as string));
        } catch {
          throw new InvalidBackupError('Invalid payday plan');
        }
        if (row.archived !== undefined && ![0, 1].includes(Number(row.archived)))
          throw new InvalidBackupError('Invalid payday plan state');
      }
      if (name === 'paydayFundingEvents') {
        try {
          const snapshot = fundingSnapshotSchema.parse(JSON.parse(row.snapshotJson as string));
          if (
            snapshot.planId !== row.planId ||
            snapshot.scheduledDate !== row.scheduledDate ||
            snapshot.today !== row.appliedDate
          )
            throw new Error('Funding identity does not match its history');
        } catch {
          throw new InvalidBackupError('Invalid payday funding history');
        }
      }
      if (name === 'upSourceRecords') {
        for (const field of ['sourceJson', 'previousJson']) {
          if (row[field] == null) continue;
          try {
            upObservationSchema.parse(JSON.parse(row[field] as string));
          } catch {
            throw new InvalidBackupError(`Row ${i + 1} of "${name}" has invalid bank details`);
          }
        }
        if (
          !['new', 'changed', 'missing', 'pending', 'reviewed'].includes(
            String(row.reviewState ?? 'reviewed'),
          ) ||
          (row.revision !== undefined && Number(row.revision) < 1) ||
          (row.seenInLatest !== undefined && ![0, 1].includes(Number(row.seenInLatest)))
        )
          throw new InvalidBackupError('Invalid Up review state');
      }
      if (name === 'tags') {
        const tagName = String(row.name ?? '').trim();
        if (!tagName || tagName.length > 60) throw new InvalidBackupError('Invalid tag name');
        if (row.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(row.color)))
          throw new InvalidBackupError('Invalid tag colour');
      }
      if (name === 'savedViews') {
        try {
          row.query = validateViewQuery(String(row.query));
        } catch {
          throw new InvalidBackupError('Invalid saved view');
        }
      }
      if (name === 'forecastScenarios') {
        try {
          const assumptions = JSON.parse(String(row.assumptions));
          scenarioSchema.parse({ ...assumptions, name: row.name });
          if (row.version !== undefined && Number(row.version) < 1) throw new Error();
        } catch {
          throw new InvalidBackupError('Invalid forecast scenario');
        }
      }
      if (name === 'payees' && row.skipCategoryFollowup !== undefined) {
        if (![0, 1].includes(Number(row.skipCategoryFollowup)))
          throw new InvalidBackupError('Invalid payee setting');
      }
      if (name === 'transactions' && row.hiddenFromReports !== undefined) {
        if (![0, 1].includes(Number(row.hiddenFromReports)))
          throw new InvalidBackupError('Invalid report visibility');
      }
      return row;
    });
  }
  const linked = new Set<string>();
  for (const goal of result.goals) {
    if (goal.categoryId == null) continue;
    const category = result.categories.find((c) => c.id === goal.categoryId);
    const group = result.categoryGroups.find((g) => g.id === category?.groupId);
    if (
      !category ||
      !group ||
      group.isIncome ||
      linked.has(String(goal.categoryId)) ||
      result.cardFunding.some((c) => c.categoryId === goal.categoryId)
    )
      throw new InvalidBackupError('Invalid or duplicate goal category');
    linked.add(String(goal.categoryId));
  }
  // Phase 7 (format 11). Older backups have none of these: every goal restores active.
  const goalIds = new Set(result.goals.map((g) => String(g.id)));
  for (const goal of result.goals)
    if (
      !GOAL_STATUSES.includes(String(goal.status ?? 'active') as never) ||
      (goal.replacedByGoalId != null &&
        (!goalIds.has(String(goal.replacedByGoalId)) || goal.replacedByGoalId === goal.id))
    )
      throw new InvalidBackupError('Invalid goal status');
  for (const event of result.goalStatusEvents)
    if (
      !goalIds.has(String(event.goalId)) ||
      !GOAL_STATUSES.includes(String(event.fromStatus) as never) ||
      !GOAL_STATUSES.includes(String(event.toStatus) as never)
    )
      throw new InvalidBackupError('Invalid goal status history');
  for (const p of result.financialPriorities) {
    const type = p.reserveTargetType ?? null;
    if (
      p.id !== 'default' ||
      !CADENCES.includes(String(p.reviewCadence ?? 'off') as never) ||
      !(
        (type === null && p.reserveTargetAmount == null && p.reserveTargetMonths == null) ||
        (type === 'amount' && Number(p.reserveTargetAmount) > 0 && p.reserveTargetMonths == null) ||
        (type === 'months' &&
          Number(p.reserveTargetMonths) >= 1 &&
          Number(p.reserveTargetMonths) <= 60 &&
          p.reserveTargetAmount == null)
      ) ||
      [p.essentialMonthlyAmount, p.reserveMinimum].some((v) => v != null && Number(v) <= 0)
    )
      throw new InvalidBackupError('Invalid financial priorities');
  }
  for (const p of result.categoryPurposes) {
    const error =
      !PURPOSES.includes(String(p.purpose) as never) ||
      purposeError(String(p.categoryId), String(p.purpose), {
        category: (id) => result.categories.find((c) => c.id === id) as never,
        group: (id) => result.categoryGroups.find((g) => g.id === id) as never,
        isCardReserve: (id) => result.cardFunding.some((c) => c.categoryId === id),
        fundsGoal: (id) => result.goals.some((g) => g.categoryId === id),
        targetType: (id) =>
          result.categoryTargets.find((t) => t.categoryId === id)?.type as string | undefined,
      });
    if (error) throw new InvalidBackupError('Invalid category purpose');
  }
  for (const c of result.reviewCompletions)
    try {
      reviewSnapshotSchema.parse(JSON.parse(String(c.snapshotJson)));
      if (!isoDate.safeParse(c.asOf).success) throw new Error();
    } catch {
      throw new InvalidBackupError('Invalid review history');
    }
  for (const r of result.incomeReviews)
    if (
      Number(r.baseline) < 0 ||
      Number(r.assigned) < 0 ||
      Number(r.reservePercent) < 0 ||
      Number(r.reservePercent) > 100
    )
      throw new InvalidBackupError('Invalid income review');
  for (const target of result.categoryTargets) {
    const category = result.categories.find((c) => c.id === target.categoryId);
    const group = result.categoryGroups.find((g) => g.id === category?.groupId);
    const valid = targetSchema.safeParse({
      type: target.type,
      amount: target.amount,
      ...(target.dueDate != null && { dueDate: target.dueDate }),
      ...(target.cycleMonths != null && { cycleMonths: target.cycleMonths }),
    });
    if (
      !category ||
      !group ||
      group.isIncome ||
      !valid.success ||
      !/^\d{4}-\d{2}$/.test(String(target.createdMonth)) ||
      result.cardFunding.some((c) => c.categoryId === target.categoryId)
    )
      throw new InvalidBackupError('Invalid category target');
  }
  // P3 investments (format 14). Older backups have none.
  const kinds: readonly string[] = SECURITY_KINDS;
  for (const s of result.securities) {
    const symbol = String(s.symbol).trim();
    const name = String(s.name).trim();
    if (
      !symbol ||
      symbol.length > 20 ||
      !name ||
      name.length > 120 ||
      !kinds.includes(String(s.kind ?? 'other')) ||
      !isCurrencyCode(String(s.currency))
    )
      throw new InvalidBackupError('Invalid security');
  }
  for (const p of result.securityPrices)
    if (!isoDate.safeParse(p.date).success || Number(p.price) < 0)
      throw new InvalidBackupError('Invalid security price');
  for (const h of result.holdings)
    if (Number(h.quantity) < 0) throw new InvalidBackupError('Invalid holding');
  for (const l of result.taxLots)
    if (
      !isoDate.safeParse(l.acquiredOn).success ||
      Number(l.quantity) <= 0 ||
      (l.costBasis != null && Number(l.costBasis) < 0)
    )
      throw new InvalidBackupError('Invalid tax lot');
  // Long-term forecast (format 16). Older backups have none: no plans, no loan details.
  const accountIds = new Set(result.accounts.map((a) => String(a.id)));
  const planIds = new Set(result.longTermPlans.map((p) => String(p.id)));
  for (const d of result.accountLoanDetails)
    if (
      !accountIds.has(String(d.accountId)) ||
      !loanDetailsSchema.safeParse({
        rateBps: d.rateBps,
        monthlyRepayment: d.monthlyRepayment ?? 0,
        termMonths: d.termMonths ?? null,
      }).success
    )
      throw new InvalidBackupError('Invalid loan details');
  for (const p of result.longTermPlans)
    try {
      settingsSchema.parse(JSON.parse(String(p.settingsJson)));
      const name = String(p.name).trim();
      if (!name || name.length > 100) throw new Error();
      if (p.version !== undefined && Number(p.version) < 1) throw new Error();
    } catch {
      throw new InvalidBackupError('Invalid long-term plan');
    }
  if (new Set(result.longTermPlans.map((p) => String(p.name).toLowerCase())).size !== planIds.size)
    throw new InvalidBackupError('Invalid long-term plan');
  for (const e of result.longTermEvents)
    try {
      if (!planIds.has(String(e.planId))) throw new Error();
      eventSchema.parse({
        ...JSON.parse(String(e.paramsJson)),
        id: e.id,
        kind: e.kind,
        name: e.name,
        enabled: Number(e.enabled ?? 1) === 1,
      });
    } catch {
      throw new InvalidBackupError('Invalid long-term event');
    }
  for (const a of result.longTermAccountAssumptions)
    if (
      !planIds.has(String(a.planId)) ||
      !accountIds.has(String(a.accountId)) ||
      !accountAssumptionSchema.safeParse({
        accountId: a.accountId,
        included: Number(a.included ?? 1) === 1,
        cls: a.cls ?? null,
        growthBps: a.growthBps ?? null,
      }).success
    )
      throw new InvalidBackupError('Invalid long-term account choice');
  for (const sp of result.longTermSplits)
    if (
      !planIds.has(String(sp.planId)) ||
      !accountIds.has(String(sp.accountId)) ||
      !splitSchema.safeParse({
        accountId: sp.accountId,
        mode: sp.mode,
        ...(sp.bps != null ? { bps: sp.bps } : {}),
        ...(sp.amount != null ? { amount: sp.amount } : {}),
      }).success
    )
      throw new InvalidBackupError('Invalid long-term split');
  return result;
}

/** Copies the current database next to it before a restore replaces everything. */
export async function saveSafetyCopy(): Promise<string | null> {
  if (databasePath === ':memory:') return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(path.dirname(databasePath), `budget-before-restore-${stamp}.db`);
  await sqlite.backup(file);
  return path.basename(file);
}

/** Replaces all budget data with the backup's, in one transaction: all or nothing. */
export function restoreBackup(data: ParsedBackup) {
  // Bank connections aren't in backups; remember which accounts they sync into
  const plaidLinks = db
    .select({ id: plaidAccountMappings.id, accountId: plaidAccountMappings.accountId })
    .from(plaidAccountMappings)
    .where(isNotNull(plaidAccountMappings.accountId))
    .all();
  const simplefinLinks = db
    .select({ id: simplefinAccountMappings.id, accountId: simplefinAccountMappings.accountId })
    .from(simplefinAccountMappings)
    .where(isNotNull(simplefinAccountMappings.accountId))
    .all();
  const enableBankingLinks = db
    .select({
      id: enableBankingAccountMappings.id,
      accountId: enableBankingAccountMappings.accountId,
    })
    .from(enableBankingAccountMappings)
    .where(isNotNull(enableBankingAccountMappings.accountId))
    .all();
  const restoredAccounts = new Set(data.accounts.map((a) => a.id as string));
  const upLinks = db
    .select({ id: upAccountMappings.id, accountId: upAccountMappings.accountId })
    .from(upAccountMappings)
    .where(isNotNull(upAccountMappings.accountId))
    .all();

  db.transaction((tx) => {
    // Foreign keys are checked once, at commit, so rows can go in table by table
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    for (const name of [...BACKUP_TABLES].reverse()) {
      // A backup from before currencies keeps this budget's currency (it was only a symbol then)
      if (name === 'budgetSettings' && data.beforeCurrencies) continue;
      tx.delete(TABLES[name]).run();
    }
    for (const name of BACKUP_TABLES) {
      const rows = data[name];
      // Chunked: SQLite limits how many values one statement may bind
      for (let i = 0; i < rows.length; i += 200) {
        tx.insert(TABLES[name])
          .values(rows.slice(i, i + 200) as never)
          .run();
      }
    }
    for (const [table, links] of [
      [plaidAccountMappings, plaidLinks],
      [simplefinAccountMappings, simplefinLinks],
      [upAccountMappings, upLinks],
      [enableBankingAccountMappings, enableBankingLinks],
    ] as const) {
      for (const link of links) {
        if (!link.accountId || !restoredAccounts.has(link.accountId)) continue;
        tx.update(table)
          .set({ accountId: link.accountId })
          .where(sql`${table.id} = ${link.id}`)
          .run();
      }
    }
    // The restored budget may be older than what Enable Banking last synced: forget where
    // each sync got to, so the next one starts again from the restored account's latest
    // transaction (and recognises the ones it has by their bank ids)
    for (const link of enableBankingLinks) {
      if (link.accountId && restoredAccounts.has(link.accountId)) {
        tx.update(enableBankingAccountMappings)
          .set({ lastBookedDate: null })
          .where(sql`${enableBankingAccountMappings.id} = ${link.id}`)
          .run();
      }
    }
  });
  // Rates came with the backup; a backup from an older version has no values in other
  // currencies yet
  ratesChanged();
  fillMissingMainAmounts();

  return Object.fromEntries(BACKUP_TABLES.map((name) => [name, data[name].length]));
}
