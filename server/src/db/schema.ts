import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  primaryKey,
  blob,
  customType,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { secretCipher } from './secretCrypto.js';

/** TEXT column encrypted at rest when a key is configured (see secretCrypto.ts). Can't be queried by value. */
const encryptedText = customType<{ data: string; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => secretCipher.encrypt(value),
  fromDriver: (value) => secretCipher.decrypt(value),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  startingBalance: integer('starting_balance').notNull().default(0),
  isOffBudget: integer('is_off_budget').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  closedAt: text('closed_at'),
  /** Custom logo as a small image data URL; null = colored initials */
  logo: text('logo'),
  /** How this account's bank writes its CSV files (JSON `ImportSettings`), from the last import */
  importSettings: text('import_settings'),
  /** ISO 4217 code of the account's currency; null = the budget's currency */
  currency: text('currency'),
  /** Day the starting balance was typed as "balance as of today"; imports of older rows keep it true */
  balanceAsOf: text('balance_as_of'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categoryGroups = sqliteTable('category_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isIncome: integer('is_income').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  budgetType: text('budget_type'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  /** 1 = tucked away from pickers and the budget while it holds no money (never deleted) */
  hidden: integer('hidden').notNull().default(0),
  /** An expense envelope that follows a budget account: confirmed transfers into the account
   * add to it, transfers back out take from it (budgetLedger.ts). One envelope per account. */
  linkedAccountId: text('linked_account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
});

export const payees = sqliteTable('payees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultCategoryId: text('default_category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  /** Custom logo as a small image data URL; null = colored initials */
  logo: text('logo'),
  /** 1 = don't offer to recategorize this payee's other transactions after a change */
  skipCategoryFollowup: integer('skip_category_followup').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    amount: integer('amount').notNull(),
    payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
    payeeName: text('payee_name'),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    notes: text('notes'),
    reconciled: integer('reconciled').notNull().default(0),
    transferTransactionId: text('transfer_transaction_id'),
    isParent: integer('is_parent').notNull().default(0),
    parentTransactionId: text('parent_transaction_id'),
    importedId: text('imported_id'),
    /** Raw payee text from the bank or CSV, kept so rules can match it after a rename */
    importedPayee: text('imported_payee'),
    /**
     * 1 for a balance correction (reconciliation, "Update value"): it changes the balance, but
     * while it has no category, income and spending reports leave it out
     */
    isAdjustment: integer('is_adjustment').notNull().default(0),
    scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
    /**
     * In an account with another currency than the budget's: what the transaction is worth in
     * the budget's currency (budget and reports count this). Null = the same as `amount`.
     */
    mainAmount: integer('main_amount'),
    /** Where `mainAmount` came from: rate | manual | transfer | missing (services/mainAmounts.ts) */
    mainAmountSource: text('main_amount_source'),
    /** When the user marked it reviewed (phase 9). Never set by imports, sync, rules or restore */
    reviewedAt: text('reviewed_at'),
    /**
     * 1 to leave it out of income/spending reports (phase 9). Balances, the envelope budget,
     * forecasts and reconciliation still count it. A split's parts follow their parent.
     */
    hiddenFromReports: integer('hidden_from_reports').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('transactions_account_date_idx').on(table.accountId, table.date),
    index('transactions_category_idx').on(table.categoryId),
    index('transactions_date_idx').on(table.date),
    index('transactions_imported_id_idx').on(table.importedId),
    index('idx_transactions_schedule').on(table.scheduleId),
  ],
);

export const budgetMonths = sqliteTable(
  'budget_months',
  {
    id: text('id').primaryKey(),
    month: text('month').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    budgeted: integer('budgeted').notNull().default(0),
    notes: text('notes'),
  },
  (table) => [uniqueIndex('budget_months_month_category_idx').on(table.month, table.categoryId)],
);

export const paydayPlans = sqliteTable('payday_plans', {
  id: text('id').primaryKey(),
  configJson: text('config_json').notNull(),
  archived: integer('archived').notNull().default(0),
});

export const paydayFundingEvents = sqliteTable(
  'payday_funding_events',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => paydayPlans.id),
    scheduledDate: text('scheduled_date').notNull(),
    appliedDate: text('applied_date').notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('payday_event_plan_date').on(table.planId, table.scheduledDate)],
);

/** One finished reconciliation: the rows it locked and any adjustment it created (for undo) */
export const accountReconciliations = sqliteTable(
  'account_reconciliations',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** JSON array of the transaction ids this reconciliation locked (adjustment included) */
    transactionIds: text('transaction_ids').notNull(),
    adjustmentTransactionId: text('adjustment_transaction_id'),
    adjustmentAmount: integer('adjustment_amount').notNull().default(0),
    statementBalance: integer('statement_balance').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    undoneAt: text('undone_at'),
  },
  (table) => [index('account_reconciliations_account').on(table.accountId)],
);

/** A funding that was undone: kept for Funding history while the payday itself is free again */
export const paydayFundingUndos = sqliteTable(
  'payday_funding_undos',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').notNull(),
    scheduledDate: text('scheduled_date').notNull(),
    appliedDate: text('applied_date').notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    /** { reversed: [{categoryId,name,amount}], skipped: [{categoryId,name,amount,reason}] } */
    resultJson: text('result_json').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    undoneAt: text('undone_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('payday_undo_plan').on(table.planId)],
);

// Retain the receipt identity even if its ledger row is later deleted. A second plan
// cannot allocate that same income again; restoring a backup preserves this guard.
export const paydayFundingReceipts = sqliteTable('payday_funding_receipts', {
  transactionId: text('transaction_id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => paydayFundingEvents.id, { onDelete: 'cascade' }),
});

export const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  conditions: text('conditions').notNull(),
  actions: text('actions').notNull(),
  /** 'and' = every condition must match, 'or' = any one */
  conditionsOp: text('conditions_op').notNull().default('and'),
  enabled: integer('enabled').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  /** The access token name that proposed it (created disabled for the owner to review); null = the owner */
  proposedBy: text('proposed_by'),
});

export const schedules = sqliteTable(
  'schedules',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    amountType: text('amount_type').notNull().default('exact'),
    recurrenceType: text('recurrence_type').notNull(),
    recurrenceRule: text('recurrence_rule').notNull().default('{}'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    weekendAdjust: text('weekend_adjust').notNull().default('none'),
    dateFlexibility: integer('date_flexibility').notNull().default(3),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    transferAccountId: text('transfer_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
    notes: text('notes'),
    status: text('status').notNull().default('active'),
    autoCreate: integer('auto_create').notNull().default(0),
    autoCreateFrom: text('auto_create_from'),
    source: text('source').notNull().default('manual'),
    occurrenceHorizon: text('occurrence_horizon'),
    /** "Still active": occurrences missed on or before this date don't suggest it ended */
    confirmedActiveAt: text('confirmed_active_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_schedules_status').on(table.status),
    index('idx_schedules_payee').on(table.payeeId),
    index('idx_schedules_account').on(table.accountId),
  ],
);

export const scheduleOccurrences = sqliteTable(
  'schedule_occurrences',
  {
    id: text('id').primaryKey(),
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    scheduledDate: text('scheduled_date').notNull(),
    expectedDate: text('expected_date').notNull(),
    expectedAmount: integer('expected_amount').notNull(),
    status: text('status').notNull().default('pending'),
    matchedTransactionId: text('matched_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    matchType: text('match_type'),
    matchConfidence: integer('match_confidence'),
    skippedAt: text('skipped_at'),
    paidAt: text('paid_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_occ_schedule_date_unique').on(table.scheduleId, table.scheduledDate),
    index('idx_occ_expected_date').on(table.expectedDate),
    index('idx_occ_status').on(table.status),
    uniqueIndex('idx_occ_matched_tx_unique').on(table.matchedTransactionId),
  ],
);

export const scheduleMatchDismissals = sqliteTable(
  'schedule_match_dismissals',
  {
    id: text('id').primaryKey(),
    occurrenceId: text('occurrence_id')
      .notNull()
      .references(() => scheduleOccurrences.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    dismissedAt: text('dismissed_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('idx_dismissal_unique').on(table.occurrenceId, table.transactionId)],
);

/**
 * Pairs of transactions the user said aren't a transfer, so they're never suggested again.
 * The id is the pair itself (`pairKey` in services/transferMatching.ts: smaller id first).
 */
export const transferMatchDismissals = sqliteTable('transfer_match_dismissals', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  otherTransactionId: text('other_transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  dismissedAt: text('dismissed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Phase 9 tags: on register rows (unsplit transactions and split parents); parts inherit
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * A receipt's bytes, stored once per content (id is the SHA-256). Not in JSON backups and not
 * tied to any row, so a restore on the same installation keeps every receipt's file; the
 * database file itself (a cold backup) holds them all.
 */
export const receiptFiles = sqliteTable('receipt_files', {
  id: text('id').primaryKey(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdAt: text('created_at').notNull(),
});

/** A receipt: a file, what it says, and the transaction it belongs to (null = unmatched) */
export const receipts = sqliteTable(
  'receipts',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    fileId: text('file_id').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    merchant: text('merchant'),
    receiptDate: text('receipt_date'),
    /** What the receipt says was paid, in cents of the transaction's currency */
    total: integer('total'),
    subtotal: integer('subtotal'),
    tax: integer('tax'),
    /** Tip, delivery and other fees */
    tip: integer('tip'),
    /** How it was matched: auto | manual | created (a transaction made from it); null = unmatched */
    matchedBy: text('matched_by'),
    notes: text('notes'),
    /** Reading by a local model (receiptReader.ts): pending | read | failed; null = never asked */
    readStatus: text('read_status'),
    readError: text('read_error'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('receipts_transaction_idx').on(table.transactionId)],
);

/**
 * A transaction claimed as a tax deduction: its ATO return label (D1 car … D10 tax affairs,
 * D15 other) and the share of it that is for work. Australian financial years only.
 */
/** What a receipt lists, each with the category it belongs to (for autosplit) */
export const receiptLineItems = sqliteTable(
  'receipt_line_items',
  {
    id: text('id').primaryKey(),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => receipts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    /** Cents, positive for something bought */
    amount: integer('amount').notNull(),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  },
  (table) => [index('receipt_line_items_receipt_idx').on(table.receiptId)],
);

export const taxClaims = sqliteTable('tax_claims', {
  transactionId: text('transaction_id')
    .primaryKey()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  workUseBps: integer('work_use_bps').notNull().default(10000),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })],
);

/** An All Transactions URL query saved under a name (phase 9) */
export const savedViews = sqliteTable('saved_views', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  query: text('query').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A saved forecast scenario: its assumptions as JSON, versioned so two devices can't
 * silently overwrite each other */
export const forecastScenarios = sqliteTable('forecast_scenarios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  assumptions: text('assumptions').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const customReports = sqliteTable('custom_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const dashboardPages = sqliteTable('dashboard_pages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // JSON date range the dashboard's widgets follow by default; null means the last 6 months
  dateRange: text('date_range'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// A report widget on a dashboard page. `meta` is a JSON string whose shape depends on
// `type`; custom report widgets point at their report so deleting it removes the widget.
export const dashboardWidgets = sqliteTable('dashboard_widgets', {
  id: text('id').primaryKey(),
  pageId: text('page_id')
    .notNull()
    .references(() => dashboardPages.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  customReportId: text('custom_report_id').references(() => customReports.id, {
    onDelete: 'cascade',
  }),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  width: integer('width').notNull().default(6),
  height: integer('height').notNull().default(4),
  meta: text('meta').notNull().default('{}'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  currentAmount: integer('current_amount').notNull().default(0),
  categoryId: text('category_id')
    .references(() => categories.id, { onDelete: 'set null' })
    .unique(),
  targetDate: text('target_date'),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  icon: text('icon').notNull().default('🎯'),
  color: text('color').notNull().default('#2563EB'),
  sortOrder: integer('sort_order').notNull().default(0),
  /** active | paused | completed | retired (phase 7D); only active goals get suggestions */
  status: text('status').notNull().default('active'),
  statusReason: text('status_reason'),
  replacedByGoalId: text('replaced_by_goal_id'),
  statusChangedAt: text('status_changed_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Each goal status change, with the money move confirmed in the same action (phase 7D). */
export const goalStatusEvents = sqliteTable('goal_status_events', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  reason: text('reason'),
  replacementGoalId: text('replacement_goal_id').references(() => goals.id, {
    onDelete: 'set null',
  }),
  moveId: text('move_id').references(() => budgetMoves.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
});

/** The budget's optional priorities profile (phase 7A): one row, id 'default'. */
export const financialPriorities = sqliteTable('financial_priorities', {
  id: text('id').primaryKey(),
  purpose: text('purpose'),
  /** Replaces the measured essentials average when set, in budget minor units */
  essentialMonthlyAmount: integer('essential_monthly_amount'),
  /** amount | months | null */
  reserveTargetType: text('reserve_target_type'),
  reserveTargetAmount: integer('reserve_target_amount'),
  reserveTargetMonths: integer('reserve_target_months'),
  reserveMinimum: integer('reserve_minimum'),
  /** payday | monthly | quarterly | off */
  reviewCadence: text('review_cadence').notNull().default('off'),
  reminderSnoozedUntil: text('reminder_snoozed_until'),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A label on an expense category: essential | enjoyment | flexibility (phase 7A). */
export const categoryPurposes = sqliteTable('category_purposes', {
  categoryId: text('category_id')
    .primaryKey()
    .references(() => categories.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
});

/** A completed review and the figures it saw, for the next comparison (phase 7E). */
export const reviewCompletions = sqliteTable('review_completions', {
  id: text('id').primaryKey(),
  completedAt: text('completed_at').notNull(),
  asOf: text('as_of').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
});

/** One applied extra-income split per received deposit (phase 7F). */
export const incomeReviews = sqliteTable('income_reviews', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().unique(),
  month: text('month').notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  received: integer('received').notNull(),
  baseline: integer('baseline').notNull(),
  reservePercent: integer('reserve_percent').notNull(),
  assigned: integer('assigned').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Persistent funding target per expense category (phase 6D). Suggestions only. */
export const categoryTargets = sqliteTable('category_targets', {
  categoryId: text('category_id')
    .primaryKey()
    .references(() => categories.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  dueDate: text('due_date'),
  cycleMonths: integer('cycle_months'),
  /** Month the target was set, for the even rate a by-date target started with. */
  createdMonth: text('created_month').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// One personal Up token exposes the user's spending, Saver and joint accounts.
export const upConnections = sqliteTable('up_connections', {
  id: text('id').primaryKey(),
  accessToken: encryptedText('access_token').notNull(),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  lastSyncedAt: text('last_synced_at'),
  pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(0),
  lastAttemptAt: text('last_attempt_at'),
  lastCompletedAt: text('last_completed_at'),
  nextSyncAt: text('next_sync_at'),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const upAccountMappings = sqliteTable('up_account_mappings', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => upConnections.id, { onDelete: 'cascade' }),
  upAccountId: text('up_account_id').notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  isEnabled: integer('is_enabled').notNull().default(1),
  initializedAt: text('initialized_at'),
  /** Up's settled balance at the last complete sync, for the round-up accounting check. */
  settledBalance: integer('settled_balance'),
  /** When the owner enabled round-up debits proven missing by that balance; null = off. */
  roundUpDebitsAt: text('round_up_debits_at'),
  /** Set when linked to an account that already had history: Up rows before this day are never imported. */
  cutoverDate: text('cutover_date'),
  /** Bank balance at the cut-over minus the register's, at the last sync (0 = they agree). */
  cutoverDifference: integer('cutover_difference'),
});

// Bank observations are separate from the editable/reconciled ledger. No credentials or raw payloads.
export const upSourceRecords = sqliteTable(
  'up_source_records',
  {
    importedId: text('imported_id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    sourceJson: text('source_json').notNull(),
    previousJson: text('previous_json'),
    reviewState: text('review_state').notNull().default('reviewed'),
    revision: integer('revision').notNull().default(1),
    seenInLatest: integer('seen_in_latest').notNull().default(1),
    /** Review state 'overlap': the older, non-Up row this import may duplicate. */
    overlapTransactionId: text('overlap_transaction_id'),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [index('up_source_review').on(table.reviewState, table.lastSeenAt)],
);

export const simplefinConnections = sqliteTable('simplefin_connections', {
  id: text('id').primaryKey(),
  accessUrl: encryptedText('access_url').notNull(),
  connectionName: text('connection_name').notNull(),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const simplefinAccountMappings = sqliteTable(
  'simplefin_account_mappings',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => simplefinConnections.id, { onDelete: 'cascade' }),
    simplefinAccountId: text('simplefin_account_id').notNull(),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    simplefinAccountName: text('simplefin_account_name').notNull(),
    /** The bank account's currency (ISO 4217), for accounts created from it */
    currency: text('currency'),
    isEnabled: integer('is_enabled').notNull().default(1),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('simplefin_account_mapping_unique').on(
      table.connectionId,
      table.simplefinAccountId,
    ),
  ],
);

export const plaidConfig = sqliteTable('plaid_config', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  secret: encryptedText('secret').notNull(),
  environment: text('environment').notNull().default('development'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const plaidItems = sqliteTable('plaid_items', {
  id: text('id').primaryKey(),
  plaidItemId: text('plaid_item_id').notNull(),
  institutionId: text('institution_id').notNull(),
  institutionName: text('institution_name').notNull(),
  accessToken: encryptedText('access_token').notNull(),
  cursor: text('cursor'),
  lastSyncedAt: text('last_synced_at'),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  consentExpiresAt: text('consent_expires_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const plaidAccountMappings = sqliteTable(
  'plaid_account_mappings',
  {
    id: text('id').primaryKey(),
    plaidItemId: text('plaid_item_id')
      .notNull()
      .references(() => plaidItems.id, { onDelete: 'cascade' }),
    plaidAccountId: text('plaid_account_id').notNull(),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    plaidAccountName: text('plaid_account_name').notNull(),
    plaidAccountType: text('plaid_account_type').notNull(),
    plaidAccountMask: text('plaid_account_mask'),
    /** The bank account's currency (ISO 4217), for accounts created from it */
    currency: text('currency'),
    isEnabled: integer('is_enabled').notNull().default(1),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('plaid_account_mapping_unique').on(table.plaidItemId, table.plaidAccountId),
  ],
);

// --- Enable Banking (European banks, PSD2) ---

/** The user's own Enable Banking application (single row, id='default'). */
export const enableBankingConfig = sqliteTable('enable_banking_config', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull(),
  /** The application's RSA private key (PEM), used to sign API requests */
  privateKey: encryptedText('private_key').notNull(),
  /** Name and environment from Enable Banking, for display only */
  applicationName: text('application_name'),
  environment: text('environment'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** One bank login (an Enable Banking session), valid until the consent expires. */
export const enableBankingConnections = sqliteTable('enable_banking_connections', {
  id: text('id').primaryKey(),
  sessionId: encryptedText('session_id').notNull(),
  aspspName: text('aspsp_name').notNull(),
  aspspCountry: text('aspsp_country').notNull(),
  psuType: text('psu_type').notNull().default('personal'),
  /** When the bank's consent ends (ISO timestamp); the user reconnects after that */
  validUntil: text('valid_until'),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const enableBankingAccountMappings = sqliteTable(
  'enable_banking_account_mappings',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => enableBankingConnections.id, { onDelete: 'cascade' }),
    /** The bank account's id in the current session (changes when the user reconnects) */
    accountUid: text('account_uid').notNull(),
    /** Stays the same across sessions, so a reconnect finds the same account */
    identificationHash: text('identification_hash'),
    iban: text('iban'),
    name: text('name').notNull(),
    currency: text('currency'),
    cashAccountType: text('cash_account_type'),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    isEnabled: integer('is_enabled').notNull().default(1),
    /** Latest booking date imported, so the next sync asks for a little before it */
    lastBookedDate: text('last_booked_date'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('enable_banking_account_mappings_connection_idx').on(table.connectionId)],
);

// --- Server mode (self-hosted / Docker) login ---

/** The single login password, as an scrypt hash. Only used in server mode. */
export const authConfig = sqliteTable('auth_config', {
  id: text('id').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Login sessions. `id` is the SHA-256 of the session token, never the token itself. */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
  /** The browser that signed in (listed in Settings → Server → Signed-in devices) */
  userAgent: text('user_agent'),
  /** Roughly when the session was last used (updated at most every few minutes) */
  lastUsedAt: text('last_used_at'),
});

/**
 * Read-only access tokens (Settings → Server → Read-only access): for tools such as an AI
 * assistant or an MCP client to read the budget. Only the SHA-256 of a token is stored; the
 * token itself is shown once. They never write and are never part of a backup.
 */
export const accessTokens = sqliteTable('access_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  name: text('name').notNull(),
  scope: text('scope').notNull().default('read'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
});

/** Assignments an organise token suggests for a month; only the owner applies them */
export const budgetProposals = sqliteTable('budget_proposals', {
  id: text('id').primaryKey(),
  month: text('month').notNull(),
  tokenId: text('token_id'),
  tokenName: text('token_name').notNull(),
  note: text('note'),
  /** [{ categoryId, amount, reason }]: amounts added to the month's assignments */
  rowsJson: text('rows_json').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: text('created_at').notNull(),
  decidedAt: text('decided_at'),
});

/** Category changes an access token made, one set per tool call, so the owner (or the token) can undo them */
export const assistantChangeSets = sqliteTable('assistant_change_sets', {
  id: text('id').primaryKey(),
  tokenId: text('token_id'),
  tokenName: text('token_name').notNull(),
  tool: text('tool').notNull(),
  summary: text('summary').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  undoneAt: text('undone_at'),
});

export const assistantChangeEntries = sqliteTable(
  'assistant_change_entries',
  {
    changeSetId: text('change_set_id')
      .notNull()
      .references(() => assistantChangeSets.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id').notNull(),
    previousCategoryId: text('previous_category_id'),
    newCategoryId: text('new_category_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.changeSetId, t.transactionId] })],
);

/** The budget's own settings: one row, id 'budget' */
export const budgetSettings = sqliteTable('budget_settings', {
  id: text('id').primaryKey(),
  /** ISO 4217 code of the budget's currency; null = not chosen yet (the device's symbol is shown) */
  currency: text('currency'),
  /** 1 = download ECB reference rates (opt in: it's a request to another server) */
  ratesEnabled: integer('rates_enabled').notNull().default(0),
  /** Where to download them from; null = Frankfurter's public server */
  ratesUrl: text('rates_url'),
  ratesLastFetchedAt: text('rates_last_fetched_at'),
  ratesLastError: text('rates_last_error'),
  /**
   * First month the envelope budget counts (YYYY-MM); null = all history. Earlier activity and
   * assignments stay in the register and reports but don't carry into envelopes.
   */
  budgetStartMonth: text('budget_start_month'),
  /** Receipts: split a matched transaction by its line items' categories (1 = on) */
  receiptAutoSplit: integer('receipt_auto_split').notNull().default(1),
  /** Receipts: add the receipt's notes and items to a matched transaction's notes */
  receiptAddNotes: integer('receipt_add_notes').notNull().default(1),
  /** Receipts: tag a matched transaction "Receipt" */
  receiptAddTag: integer('receipt_add_tag').notNull().default(1),
  /** Read receipts with a local Ollama model (off until the owner turns it on) */
  receiptReaderEnabled: integer('receipt_reader_enabled').notNull().default(0),
  receiptReaderUrl: text('receipt_reader_url'),
  receiptReaderModel: text('receipt_reader_model'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Exchange rates: on `date`, one `base` was `rate` `quote` (a decimal string, never a float).
 * Ids are `source:date:base:quote`, so two devices downloading the same day write the same row.
 */
export const exchangeRates = sqliteTable(
  'exchange_rates',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    base: text('base').notNull(),
    quote: text('quote').notNull(),
    rate: text('rate').notNull(),
    /** ecb | manual */
    source: text('source').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('exchange_rates_pair_date_idx').on(table.base, table.quote, table.date)],
);

/** Private household ledger. Amounts are in the group's declared currency. */
export const householdGroups = sqliteTable('household_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  accountId: text('account_id')
    .references(() => accounts.id, { onDelete: 'restrict' })
    .unique(),
  /** How a quick-shared expense splits: { mode, shares: [{ personId, value }] }; null = equal */
  defaultSplitJson: text('default_split_json'),
});
/** More pool accounts for a group (an Up 2Up spending account and its savers, say) */
export const householdPoolAccounts = sqliteTable(
  'household_pool_accounts',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => householdGroups.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .unique()
      .references(() => accounts.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.accountId] })],
);
export const householdPeople = sqliteTable('household_people', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => householdGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isSelf: integer('is_self').notNull().default(0),
});
export const householdEvents = sqliteTable('household_events', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => householdGroups.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  payerId: text('payer_id').references(() => householdPeople.id, { onDelete: 'restrict' }),
  recipientId: text('recipient_id').references(() => householdPeople.id, { onDelete: 'restrict' }),
  transactionId: text('transaction_id')
    .references(() => transactions.id, { onDelete: 'restrict' })
    .unique(),
  reversesId: text('reverses_id').references((): AnySQLiteColumn => householdEvents.id, {
    onDelete: 'restrict',
  }),
  billId: text('bill_id'),
  reviewReason: text('review_reason'),
});
export const householdShares = sqliteTable('household_shares', {
  id: text('id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => householdEvents.id, { onDelete: 'cascade' }),
  personId: text('person_id')
    .notNull()
    .references(() => householdPeople.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(),
});
export const householdBills = sqliteTable('household_bills', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => householdGroups.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  dueDate: text('due_date').notNull(),
  amount: integer('amount').notNull(),
  personalShare: integer('personal_share').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
});

/** A recurring item shared with a household; its payments are shared with the default split */
export const householdRecurringBills = sqliteTable(
  'household_recurring_bills',
  {
    scheduleId: text('schedule_id')
      .primaryKey()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => householdGroups.id, { onDelete: 'cascade' }),
    /** This bill's own split ({ mode, shares }); null = the household's default split */
    splitJson: text('split_json'),
    /** Payments to its payee dated from this day are shared as they arrive; null = by hand */
    autoShareFrom: text('auto_share_from'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('household_recurring_bills_group').on(table.groupId)],
);

export const budgetRevision = sqliteTable('budget_revision', {
  id: integer('id').primaryKey(),
  revision: text('revision').notNull(),
});
export const budgetMoves = sqliteTable('budget_moves', {
  id: text('id').primaryKey(),
  month: text('month').notNull(),
  sourceId: text('source_id').notNull(),
  destinationId: text('destination_id').notNull(),
  amount: integer('amount').notNull(),
  sourceBefore: integer('source_before').notNull(),
  destinationBefore: integer('destination_before').notNull(),
  afterRevision: text('after_revision').notNull(),
  undone: integer('undone').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

/** Reviewed cutover to explicit payment funding; no bank or historical ledger edits. */
export const cardFunding = sqliteTable('card_funding', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'restrict' }),
  categoryId: text('category_id')
    .notNull()
    .unique()
    .references(() => categories.id, { onDelete: 'restrict' }),
  startDate: text('start_date').notNull(),
  baselineIds: text('baseline_ids').notNull(),
  reviewedBalance: integer('reviewed_balance').notNull(),
  initialFunding: integer('initial_funding').notNull(),
  createdAt: text('created_at').notNull(),
});

// P3 investments (docs/INVESTMENTS.md): manual positions, kept apart from the ledger. Nothing
// here changes an account's balance; recording holdings as a value is a separate, explicit step.

/** An instrument a position can hold: a share, ETF, fund, bond or coin, priced in one currency */
export const securities = sqliteTable('securities', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  /** stock | etf | fund | bond | crypto | other: what the instrument is, not what it holds */
  kind: text('kind').notNull().default('other'),
  /** ISO 4217 code its prices are quoted in */
  currency: text('currency').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A price entered for a day: one per security per day, in minor units of its currency per unit */
export const securityPrices = sqliteTable(
  'security_prices',
  {
    securityId: text('security_id')
      .notNull()
      .references(() => securities.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    price: integer('price').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [primaryKey({ columns: [table.securityId, table.date] })],
);

/** How many units of a security an investment account holds (millionths of a unit) */
export const holdings = sqliteTable(
  'holdings',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    securityId: text('security_id')
      .notNull()
      .references(() => securities.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('holdings_account_security_idx').on(table.accountId, table.securityId)],
);

/** Units bought on one day and what they cost in total; null cost = not known, never zero */
export const taxLots = sqliteTable(
  'tax_lots',
  {
    id: text('id').primaryKey(),
    holdingId: text('holding_id')
      .notNull()
      .references(() => holdings.id, { onDelete: 'cascade' }),
    acquiredOn: text('acquired_on').notNull(),
    quantity: integer('quantity').notNull(),
    costBasis: integer('cost_basis'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('tax_lots_holding_idx').on(table.holdingId)],
);

/** What a loan or mortgage account costs and how it is repaid, for the long-term forecast.
 * Rate in basis points, repayment in minor units a month; the account's balance stays the
 * ledger's. */
export const accountLoanDetails = sqliteTable('account_loan_details', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  rateBps: integer('rate_bps').notNull(),
  monthlyRepayment: integer('monthly_repayment').notNull().default(0),
  termMonths: integer('term_months'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A saved long-term forecast plan: its settings as JSON plus a version, so two devices can't
 * silently overwrite each other. Children are replaced together with a save. */
export const longTermPlans = sqliteTable('long_term_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  settingsJson: text('settings_json').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** A life event in a plan; `paramsJson` holds the kind's fields */
export const longTermEvents = sqliteTable(
  'long_term_events',
  {
    planId: text('plan_id')
      .notNull()
      .references(() => longTermPlans.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    enabled: integer('enabled').notNull().default(1),
    paramsJson: text('params_json').notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.id] })],
);

/** A plan's per-account choices: left out, or a class or growth rate other than the default */
export const longTermAccountAssumptions = sqliteTable(
  'long_term_account_assumptions',
  {
    planId: text('plan_id')
      .notNull()
      .references(() => longTermPlans.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    included: integer('included').notNull().default(1),
    cls: text('cls'),
    growthBps: integer('growth_bps'),
  },
  (t) => [primaryKey({ columns: [t.planId, t.accountId] })],
);

/** A plan's ordered savings allocation (percent of what is left, or a fixed amount) */
export const longTermSplits = sqliteTable(
  'long_term_splits',
  {
    planId: text('plan_id')
      .notNull()
      .references(() => longTermPlans.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    bps: integer('bps'),
    amount: integer('amount'),
  },
  (t) => [primaryKey({ columns: [t.planId, t.position] })],
);

/**
 * Buy now, pay later (docs/PAYMENT-PLANS.md): one purchase on an Afterpay-style credit account
 * (`accountId`), paid in `instalmentCount` instalments from `fundingAccountId`. The purchase row
 * carries the real category. `extraTransactionIds` (JSON) lists refund and late-fee rows the plan
 * created on the account, so removing the plan removes them too.
 */
export const paymentPlans = sqliteTable(
  'payment_plans',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    fundingAccountId: text('funding_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    purchaseTransactionId: text('purchase_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull().default('afterpay'),
    merchant: text('merchant').notNull(),
    /** What was bought, positive minor units */
    total: integer('total').notNull(),
    instalmentCount: integer('instalment_count').notNull(),
    /** weekly | fortnightly | monthly */
    frequency: text('frequency').notNull().default('fortnightly'),
    firstDueDate: text('first_due_date').notNull(),
    extraTransactionIds: text('extra_transaction_ids').notNull().default('[]'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index('payment_plans_account').on(t.accountId)],
);

/**
 * One instalment of a plan (positive minor units). Paid once `transactionId` is set: the
 * plan account's side of the transfer that paid it (one payment may pay several instalments).
 * `previousJson` keeps the bank row's payee and category from before it became a transfer, so
 * unlinking puts it back exactly. An instalment a refund brought to 0 is settled.
 */
export const paymentPlanInstalments = sqliteTable(
  'payment_plan_instalments',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => paymentPlans.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    dueDate: text('due_date').notNull(),
    amount: integer('amount').notNull(),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    previousJson: text('previous_json'),
    paidAt: text('paid_at'),
  },
  (t) => [
    uniqueIndex('payment_plan_instalments_seq').on(t.planId, t.seq),
    index('payment_plan_instalments_tx').on(t.transactionId),
  ],
);

/** "Not this payment": a bank row never suggested for this instalment again */
export const paymentPlanDismissals = sqliteTable(
  'payment_plan_dismissals',
  {
    instalmentId: text('instalment_id')
      .notNull()
      .references(() => paymentPlanInstalments.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.instalmentId, t.transactionId] })],
);
