import { and, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accounts,
  cardFunding,
  categories,
  categoryGroups,
  paymentPlanDismissals,
  paymentPlanInstalments,
  paymentPlans,
  payees,
  transactions,
} from '../db/schema.js';
import { personalBudgetAccount } from './balances.js';
import { BudgetError } from './budgetMoves.js';
import { setupEmptyCardFunding } from './cardFundingSetup.js';
import { refreshMainAmounts, todayIso } from './mainAmountService.js';
import { deleteTransactionRow, resolvePayee } from './transactionHelpers.js';
import { TransferError, transferToAccount } from './transferService.js';

// Buy now, pay later (docs/PAYMENT-PLANS.md). An Afterpay-style provider is a small credit
// account: the purchase is a transaction on it with its real category, and each instalment is a
// transfer from the bank account into it. A plan records which purchase and which payments
// belong together. Payments are only ever linked when the owner confirms them: the matching
// here suggests, it never writes.

type TransactionRow = typeof transactions.$inferSelect;
type PlanRow = typeof paymentPlans.$inferSelect;
type InstalmentRow = typeof paymentPlanInstalments.$inferSelect;

/** A request that can't be done; the message is safe to show */
export class PlanError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export const PROVIDERS = {
  afterpay: { name: 'Afterpay', pattern: /after\s*pay/i },
  zip: { name: 'Zip', pattern: /\bzip\b/i },
  klarna: { name: 'Klarna', pattern: /klarna/i },
  paypal: { name: 'PayPal Pay in 4', pattern: /paypal/i },
  humm: { name: 'Humm', pattern: /humm/i },
  other: { name: 'Payment plan', pattern: null },
} as const;
export type Provider = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as Provider[];

export const FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Afterpay retries a failed payment over a few days, and banks can post a day early */
const EARLY_DAYS = 3;
const LATE_DAYS = 10;
/** Unpaid this many days after its due date: shown as overdue */
const OVERDUE_AFTER_DAYS = 2;

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const shift = (date: string, days: number) => iso(addDays(parseISO(date), days));
const gap = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

/** The due date of instalment `index` (0 = the first) */
export function dueDate(firstDue: string, frequency: Frequency, index: number): string {
  const first = parseISO(firstDue);
  if (frequency === 'monthly') return iso(addMonths(first, index));
  return iso(addDays(first, index * (frequency === 'weekly' ? 7 : 14)));
}

/**
 * Splits `total` over `count` instalments. The first `fixed` amounts are taken as they are
 * (payments already made); the rest share what is left equally, the odd cents on the first of
 * them, which is how Afterpay rounds.
 */
export function instalmentAmounts(total: number, count: number, fixed: number[] = []): number[] {
  if (fixed.length > count) throw new PlanError('There are more payments than instalments');
  const paid = fixed.reduce((s, a) => s + a, 0);
  const remaining = total - paid;
  const left = count - fixed.length;
  if (remaining < 0) throw new PlanError('The payments add up to more than the purchase');
  if (left === 0) {
    if (remaining !== 0)
      throw new PlanError('The payments add up to less than the purchase: add an instalment');
    return [...fixed];
  }
  if (remaining < left) throw new PlanError('Each instalment needs at least 1 cent');
  const base = Math.floor(remaining / left);
  const odd = remaining - base * left;
  return [...fixed, ...Array.from({ length: left }, (_, i) => base + (i === 0 ? odd : 0))];
}

function getPlan(id: string): PlanRow {
  const plan = db.select().from(paymentPlans).where(eq(paymentPlans.id, id)).get();
  if (!plan) throw new PlanError('Payment plan not found', 404);
  return plan;
}

function instalmentsOf(planId: string): InstalmentRow[] {
  return db
    .select()
    .from(paymentPlanInstalments)
    .where(eq(paymentPlanInstalments.planId, planId))
    .orderBy(paymentPlanInstalments.seq)
    .all();
}

const unpaid = (i: InstalmentRow) => !i.transactionId && i.amount > 0;

/** An open account in the personal budget, or a PlanError */
function personalAccount(id: string, what: string) {
  const account = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), personalBudgetAccount))
    .get();
  if (!account) throw new PlanError(`Choose ${what} in your budget`);
  if (account.closedAt) throw new PlanError(`${account.name} is closed`);
  return account;
}

function planAccount(id: string) {
  const account = personalAccount(id, 'an Afterpay account');
  if (!['credit', 'line_of_credit'].includes(account.type))
    throw new PlanError('A payment plan belongs on a credit account, like your Afterpay account');
  return account;
}

function fundingAccount(id: string, planAccountId: string) {
  if (id === planAccountId) throw new PlanError('Payments come from a different account');
  return personalAccount(id, 'the account the payments come from');
}

/** A spending category the purchase can have: not income, not a card payment reserve */
function checkCategory(id: string | null | undefined) {
  if (!id) return;
  const row = db
    .select({ isIncome: categoryGroups.isIncome })
    .from(categories)
    .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
    .where(eq(categories.id, id))
    .get();
  if (!row) throw new PlanError('Category not found', 404);
  if (row.isIncome) throw new PlanError('Choose a spending category for the purchase');
  if (db.select().from(cardFunding).where(eq(cardFunding.categoryId, id)).get())
    throw new PlanError('Payment envelopes hold funding; choose what the purchase was for');
}

/** Why a bank row can't pay an instalment, or null when it can */
function paymentIneligible(row: TransactionRow, planAccountId: string): string | null {
  if (row.accountId === planAccountId) return 'Choose the payment in your bank account';
  if (row.amount >= 0) return 'A payment leaves your bank account';
  if (row.reconciled === 1) return 'Reconciled transactions are locked';
  if (row.transferTransactionId) return 'This is already a transfer';
  if (row.isParent === 1 || row.parentTransactionId)
    return "A split transaction can't be a payment";
  if (row.isAdjustment === 1) return "A balance correction can't be a payment";
  return null;
}

// ─── Accounts ───────────────────────────────────────────────────────────────

/**
 * A new on-budget credit account for a provider, with payment funding set up at nothing owed,
 * so a purchase moves its envelope money into "<name> payment". When funding can't be set up
 * (missing exchange rates, more assigned than you have), the account is still created and the
 * reason is returned: set it up later in Budget → Card payments.
 */
export function createPlanAccount(input: { name?: string; provider: Provider }) {
  const name = input.name?.trim() || PROVIDERS[input.provider].name;
  const id = nanoid();
  db.insert(accounts)
    .values({
      id,
      name,
      type: 'credit',
      startingBalance: 0,
      isOffBudget: 0,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
  let paymentFunding: { ok: true } | { ok: false; reason: string } = { ok: true };
  try {
    setupEmptyCardFunding(id);
  } catch (error) {
    if (!(error instanceof BudgetError)) throw error;
    paymentFunding = { ok: false, reason: error.message };
  }
  return { account: db.select().from(accounts).where(eq(accounts.id, id)).get()!, paymentFunding };
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type InstalmentStatus = 'paid' | 'settled' | 'due' | 'overdue';

export interface PlanView {
  id: string;
  accountId: string;
  accountName: string | null;
  fundingAccountId: string | null;
  fundingAccountName: string | null;
  provider: string;
  providerName: string;
  merchant: string;
  total: number;
  instalmentCount: number;
  frequency: string;
  firstDueDate: string;
  purchase: {
    id: string;
    date: string;
    amount: number;
    categoryId: string | null;
    categoryName: string | null;
    split: boolean;
  } | null;
  /** The purchase row's amount no longer matches the plan's total (it was edited) */
  purchaseChanged: boolean;
  instalments: {
    id: string;
    seq: number;
    dueDate: string;
    amount: number;
    status: InstalmentStatus;
    transactionId: string | null;
    paidAt: string | null;
  }[];
  paidCount: number;
  /** Still to pay, positive minor units */
  remaining: number;
  nextDue: { date: string; amount: number } | null;
  status: 'active' | 'paid';
  extraTransactionIds: string[];
}

function instalmentStatus(i: InstalmentRow, today: string): InstalmentStatus {
  if (i.transactionId) return 'paid';
  if (i.amount <= 0) return 'settled';
  return gap(i.dueDate, today) > OVERDUE_AFTER_DAYS ? 'overdue' : 'due';
}

function viewOf(plan: PlanRow, today: string): PlanView {
  const accountName = (id: string | null) =>
    id ? (db.select().from(accounts).where(eq(accounts.id, id)).get()?.name ?? null) : null;
  const purchaseRow = plan.purchaseTransactionId
    ? db.select().from(transactions).where(eq(transactions.id, plan.purchaseTransactionId)).get()
    : undefined;
  const categoryName = purchaseRow?.categoryId
    ? (db.select().from(categories).where(eq(categories.id, purchaseRow.categoryId)).get()?.name ??
      null)
    : null;
  const rows = instalmentsOf(plan.id);
  const instalments = rows.map((i) => ({
    id: i.id,
    seq: i.seq,
    dueDate: i.dueDate,
    amount: i.amount,
    status: instalmentStatus(i, today),
    transactionId: i.transactionId,
    paidAt: i.paidAt,
  }));
  const open = rows.filter(unpaid);
  const next = open[0];
  return {
    id: plan.id,
    accountId: plan.accountId,
    accountName: accountName(plan.accountId),
    fundingAccountId: plan.fundingAccountId,
    fundingAccountName: accountName(plan.fundingAccountId),
    provider: plan.provider,
    providerName: PROVIDERS[plan.provider as Provider]?.name ?? plan.provider,
    merchant: plan.merchant,
    total: plan.total,
    instalmentCount: plan.instalmentCount,
    frequency: plan.frequency,
    firstDueDate: plan.firstDueDate,
    purchase: purchaseRow
      ? {
          id: purchaseRow.id,
          date: purchaseRow.date,
          amount: purchaseRow.amount,
          categoryId: purchaseRow.categoryId,
          categoryName,
          split: purchaseRow.isParent === 1,
        }
      : null,
    purchaseChanged: !!purchaseRow && purchaseRow.amount !== -plan.total,
    instalments,
    paidCount: rows.filter((i) => i.transactionId).length,
    remaining: open.reduce((s, i) => s + i.amount, 0),
    nextDue: next ? { date: next.dueDate, amount: next.amount } : null,
    status: open.length ? 'active' : 'paid',
    extraTransactionIds: JSON.parse(plan.extraTransactionIds) as string[],
  };
}

/** Every plan, those still being paid first (soonest payment first), then paid ones, newest */
export function listPlans(today = todayIso()): PlanView[] {
  const views = db
    .select()
    .from(paymentPlans)
    .all()
    .map((p) => viewOf(p, today));
  return views.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.nextDue && b.nextDue) return a.nextDue.date.localeCompare(b.nextDue.date);
    return b.firstDueDate.localeCompare(a.firstDueDate);
  });
}

export function getPlanView(id: string, today = todayIso()): PlanView {
  return viewOf(getPlan(id), today);
}

/** The plan a transaction belongs to (its purchase, a payment, a refund or fee), if any */
export function planForTransaction(transactionId: string): PlanView | null {
  const row = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!row) return null;
  const ids = [row.id, row.transferTransactionId, row.parentTransactionId].filter(
    (id): id is string => !!id,
  );
  const direct =
    db.select().from(paymentPlans).where(inArray(paymentPlans.purchaseTransactionId, ids)).get() ??
    db
      .select({ plan: paymentPlans })
      .from(paymentPlanInstalments)
      .innerJoin(paymentPlans, eq(paymentPlans.id, paymentPlanInstalments.planId))
      .where(inArray(paymentPlanInstalments.transactionId, ids))
      .get()?.plan ??
    db
      .select()
      .from(paymentPlans)
      .all()
      .find((p) => (JSON.parse(p.extraTransactionIds) as string[]).includes(row.id));
  return direct ? viewOf(direct, todayIso()) : null;
}

// ─── Creating and changing ──────────────────────────────────────────────────

export interface CreatePlanInput {
  accountId: string;
  fundingAccountId: string;
  provider: Provider;
  merchant: string;
  purchaseDate: string;
  /** Positive minor units */
  total: number;
  categoryId?: string | null;
  notes?: string | null;
  instalmentCount: number;
  frequency: Frequency;
  firstDueDate: string;
  /** Bank payments already made for this plan (earlier purchases), oldest first */
  linkTransactionIds?: string[];
}

/**
 * Records a purchase made with a payment plan: the purchase on the plan account with its real
 * category, its instalments and, for an earlier purchase, the payments already made (each
 * becomes a transfer into the plan account). One database transaction: all or nothing.
 */
export function createPlan(input: CreatePlanInput, today = todayIso()): PlanView {
  return db.transaction(() => {
    const account = planAccount(input.accountId);
    fundingAccount(input.fundingAccountId, account.id);
    checkCategory(input.categoryId);
    const merchant = input.merchant.trim();
    if (!merchant) throw new PlanError('Enter where you bought it');
    if (input.firstDueDate < input.purchaseDate)
      throw new PlanError('The first payment is on or after the purchase');

    const linkIds = input.linkTransactionIds ?? [];
    if (new Set(linkIds).size !== linkIds.length)
      throw new PlanError('Each payment can be linked once');
    const linkRows = linkIds.map((id) => {
      const row = db.select().from(transactions).where(eq(transactions.id, id)).get();
      if (!row) throw new PlanError('Payment not found', 404);
      const reason = paymentIneligible(row, account.id);
      if (reason) throw new PlanError(reason, row.reconciled === 1 ? 403 : 400);
      return row;
    });
    linkRows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const amounts = instalmentAmounts(
      input.total,
      input.instalmentCount,
      linkRows.map((r) => -r.amount),
    );

    const payee = resolvePayee(merchant, null);
    const purchaseId = nanoid();
    db.insert(transactions)
      .values({
        id: purchaseId,
        accountId: account.id,
        date: input.purchaseDate,
        amount: -input.total,
        payeeId: payee.payeeId,
        payeeName: payee.payeeName,
        categoryId: input.categoryId ?? null,
        notes: input.notes?.trim() || null,
        reconciled: 0,
        isParent: 0,
        createdAt: new Date().toISOString(),
      })
      .run();
    refreshMainAmounts([purchaseId]);

    const planId = nanoid();
    db.insert(paymentPlans)
      .values({
        id: planId,
        accountId: account.id,
        fundingAccountId: input.fundingAccountId,
        purchaseTransactionId: purchaseId,
        provider: input.provider,
        merchant,
        total: input.total,
        instalmentCount: input.instalmentCount,
        frequency: input.frequency,
        firstDueDate: input.firstDueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
    const ids = amounts.map(() => nanoid());
    amounts.forEach((amount, i) =>
      db
        .insert(paymentPlanInstalments)
        .values({
          id: ids[i],
          planId,
          seq: i + 1,
          dueDate: dueDate(input.firstDueDate, input.frequency, i),
          amount,
        })
        .run(),
    );
    linkRows.forEach((row, i) => linkRow(getPlan(planId), row, [ids[i]]));
    return viewOf(getPlan(planId), today);
  });
}

/** Marks `row` (a bank payment) as paying `instalmentIds`: it becomes a transfer into the plan
 * account, its category cleared (a transfer isn't spending), the old payee and category kept */
function linkRow(plan: PlanRow, row: TransactionRow, instalmentIds: string[]) {
  const previous = JSON.stringify({
    payeeId: row.payeeId,
    payeeName: row.payeeName,
    importedPayee: row.importedPayee,
    categoryId: row.categoryId,
  });
  let result;
  try {
    result = transferToAccount(row.id, plan.accountId, { createNew: true });
  } catch (error) {
    if (error instanceof TransferError) throw new PlanError(error.message, error.status);
    throw error;
  }
  const other = result.transactions[1];
  const seqs = db
    .select({ seq: paymentPlanInstalments.seq })
    .from(paymentPlanInstalments)
    .where(inArray(paymentPlanInstalments.id, instalmentIds))
    .all()
    .map((i) => i.seq)
    .sort((a, b) => a - b);
  const which =
    seqs.length === 1
      ? `payment ${seqs[0]} of ${plan.instalmentCount}`
      : `payments ${seqs[0]}–${seqs[seqs.length - 1]} of ${plan.instalmentCount}`;
  db.update(transactions).set({ categoryId: null }).where(eq(transactions.id, row.id)).run();
  db.update(transactions)
    .set({ notes: `${plan.merchant}: ${which}` })
    .where(eq(transactions.id, other.id))
    .run();
  db.update(paymentPlanInstalments)
    .set({ transactionId: other.id, previousJson: previous, paidAt: row.date })
    .where(inArray(paymentPlanInstalments.id, instalmentIds))
    .run();
  db.update(paymentPlans)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(paymentPlans.id, plan.id))
    .run();
}

/**
 * "Confirm": a bank payment pays the plan's instalments. Without `instalmentIds`, it pays the
 * earliest unpaid instalments whose amounts add up to the payment (one, or several when paying
 * ahead); with them, they must add up to the payment exactly.
 */
export function linkPayment(planId: string, transactionId: string, instalmentIds?: string[]) {
  return db.transaction(() => {
    const plan = getPlan(planId);
    planAccount(plan.accountId);
    const row = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    if (!row) throw new PlanError('Payment not found', 404);
    const reason = paymentIneligible(row, plan.accountId);
    if (reason) throw new PlanError(reason, row.reconciled === 1 ? 403 : 400);
    personalAccount(row.accountId, 'a payment from an account');
    const open = instalmentsOf(plan.id).filter(unpaid);
    let chosen: InstalmentRow[];
    if (instalmentIds?.length) {
      chosen = open.filter((i) => instalmentIds.includes(i.id));
      if (chosen.length !== new Set(instalmentIds).size)
        throw new PlanError('Choose instalments of this plan that are still to pay');
    } else {
      chosen = [];
      let sum = 0;
      for (const i of open) {
        if (sum >= -row.amount) break;
        chosen.push(i);
        sum += i.amount;
      }
    }
    if (!chosen.length) throw new PlanError('This plan is paid off');
    const sum = chosen.reduce((s, i) => s + i.amount, 0);
    if (sum !== -row.amount)
      throw new PlanError(
        "This payment doesn't match what's due. Change the instalment amounts to match first.",
      );
    linkRow(
      plan,
      row,
      chosen.map((i) => i.id),
    );
    return getPlanView(plan.id);
  });
}

/** Puts a payment back the way it was: the bank row's payee and category, and the plan
 * account's side of the transfer removed. Every instalment it paid is unpaid again. */
function unlinkTransaction(otherId: string) {
  const other = db.select().from(transactions).where(eq(transactions.id, otherId)).get();
  const linked = db
    .select()
    .from(paymentPlanInstalments)
    .where(eq(paymentPlanInstalments.transactionId, otherId))
    .all();
  if (other) {
    const bank = other.transferTransactionId
      ? db.select().from(transactions).where(eq(transactions.id, other.transferTransactionId)).get()
      : undefined;
    if (other.reconciled === 1 || bank?.reconciled === 1)
      throw new PlanError('Reconciled transactions are locked', 403);
    if (bank) {
      const previous = linked.find((i) => i.previousJson)?.previousJson;
      const before = previous
        ? (JSON.parse(previous) as {
            payeeId: string | null;
            payeeName: string | null;
            importedPayee: string | null;
            categoryId: string | null;
          })
        : null;
      const payeeExists =
        before?.payeeId &&
        db.select().from(payees).where(eq(payees.id, before.payeeId)).get() !== undefined;
      const categoryExists =
        before?.categoryId &&
        db.select().from(categories).where(eq(categories.id, before.categoryId)).get() !==
          undefined;
      db.update(transactions)
        .set({
          transferTransactionId: null,
          payeeId: payeeExists ? before!.payeeId : null,
          payeeName: before ? before.payeeName : (bank.importedPayee ?? bank.payeeName),
          importedPayee: before ? before.importedPayee : bank.importedPayee,
          categoryId: categoryExists ? before!.categoryId : null,
        })
        .where(eq(transactions.id, bank.id))
        .run();
    }
    db.delete(transactions).where(eq(transactions.id, other.id)).run();
    if (bank) refreshMainAmounts([bank.id]);
  }
  db.update(paymentPlanInstalments)
    .set({ transactionId: null, previousJson: null, paidAt: null })
    .where(eq(paymentPlanInstalments.transactionId, otherId))
    .run();
}

/** "Not a payment for this plan": undoes a confirmed payment (and any others it paid with it) */
export function unlinkPayment(planId: string, instalmentId: string) {
  return db.transaction(() => {
    const instalment = instalmentsOf(getPlan(planId).id).find((i) => i.id === instalmentId);
    if (!instalment) throw new PlanError('Instalment not found', 404);
    if (!instalment.transactionId) throw new PlanError('This instalment is not paid');
    unlinkTransaction(instalment.transactionId);
    return getPlanView(planId);
  });
}

/** Never suggest this bank row for this instalment again */
export function dismissMatch(instalmentId: string, transactionId: string) {
  const instalment = db
    .select()
    .from(paymentPlanInstalments)
    .where(eq(paymentPlanInstalments.id, instalmentId))
    .get();
  if (!instalment) throw new PlanError('Instalment not found', 404);
  if (!db.select().from(transactions).where(eq(transactions.id, transactionId)).get())
    throw new PlanError('Payment not found', 404);
  db.insert(paymentPlanDismissals)
    .values({ instalmentId, transactionId })
    .onConflictDoNothing()
    .run();
}

/** Changes the merchant and the dates and amounts of instalments still to pay */
export function updatePlan(
  planId: string,
  change: {
    merchant?: string;
    instalments?: { id: string; dueDate?: string; amount?: number }[];
  },
) {
  return db.transaction(() => {
    const plan = getPlan(planId);
    const rows = instalmentsOf(plan.id);
    if (change.merchant !== undefined) {
      const merchant = change.merchant.trim();
      if (!merchant) throw new PlanError('Enter where you bought it');
      db.update(paymentPlans).set({ merchant }).where(eq(paymentPlans.id, plan.id)).run();
    }
    for (const edit of change.instalments ?? []) {
      const row = rows.find((r) => r.id === edit.id);
      if (!row) throw new PlanError('Instalment not found', 404);
      if (row.transactionId) throw new PlanError('A paid instalment is fixed: unlink it first');
      if (edit.amount !== undefined && edit.amount < 0)
        throw new PlanError('An instalment cannot be negative');
      db.update(paymentPlanInstalments)
        .set({ dueDate: edit.dueDate ?? row.dueDate, amount: edit.amount ?? row.amount })
        .where(eq(paymentPlanInstalments.id, row.id))
        .run();
    }
    db.update(paymentPlans)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(paymentPlans.id, plan.id))
      .run();
    return getPlanView(plan.id);
  });
}

function addExtra(plan: PlanRow, transactionId: string) {
  const ids = JSON.parse(plan.extraTransactionIds) as string[];
  db.update(paymentPlans)
    .set({
      extraTransactionIds: JSON.stringify([...ids, transactionId]),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(paymentPlans.id, plan.id))
    .run();
}

function insertPlanRow(
  plan: PlanRow,
  fields: {
    date: string;
    amount: number;
    payeeName: string;
    categoryId: string | null;
    notes: string;
  },
) {
  const payee = resolvePayee(fields.payeeName, null);
  const id = nanoid();
  db.insert(transactions)
    .values({
      id,
      accountId: plan.accountId,
      date: fields.date,
      amount: fields.amount,
      payeeId: payee.payeeId,
      payeeName: payee.payeeName,
      categoryId: fields.categoryId,
      notes: fields.notes,
      reconciled: 0,
      isParent: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
  refreshMainAmounts([id]);
  return id;
}

/**
 * A refund from the merchant: a credit on the plan account in the purchase's category (spending
 * reports show it against what was bought), and the instalments still to pay shrink from the
 * last one back, as Afterpay does. A refund larger than what is still owed leaves a credit on the
 * account; when the provider pays it back to your bank, link that as an ordinary transfer.
 */
export function recordRefund(
  planId: string,
  input: { date: string; amount: number; categoryId?: string | null },
) {
  return db.transaction(() => {
    const plan = getPlan(planId);
    planAccount(plan.accountId);
    if (!(input.amount > 0)) throw new PlanError('Enter the refund amount');
    const purchase = plan.purchaseTransactionId
      ? db.select().from(transactions).where(eq(transactions.id, plan.purchaseTransactionId)).get()
      : undefined;
    const categoryId =
      input.categoryId !== undefined ? input.categoryId : (purchase?.categoryId ?? null);
    checkCategory(categoryId);
    const id = insertPlanRow(plan, {
      date: input.date,
      amount: input.amount,
      payeeName: plan.merchant,
      categoryId,
      notes: `Refund: ${plan.merchant}`,
    });
    addExtra(plan, id);
    let left = input.amount;
    for (const i of instalmentsOf(plan.id).filter(unpaid).reverse()) {
      if (left <= 0) break;
      const cut = Math.min(left, i.amount);
      left -= cut;
      db.update(paymentPlanInstalments)
        .set({ amount: i.amount - cut })
        .where(eq(paymentPlanInstalments.id, i.id))
        .run();
    }
    return getPlanView(plan.id);
  });
}

/**
 * A late fee: an expense on the plan account (in the category you choose, Bank Fees for
 * example) that the provider collects with the next payment, so it is added to the next
 * instalment. When nothing is left to pay, it becomes an extra instalment due on the fee's date.
 */
export function recordFee(
  planId: string,
  input: { date: string; amount: number; categoryId?: string | null },
) {
  return db.transaction(() => {
    const plan = getPlan(planId);
    planAccount(plan.accountId);
    if (!(input.amount > 0)) throw new PlanError('Enter the fee amount');
    checkCategory(input.categoryId);
    const provider = PROVIDERS[plan.provider as Provider]?.name ?? plan.provider;
    const id = insertPlanRow(plan, {
      date: input.date,
      amount: -input.amount,
      payeeName: provider,
      categoryId: input.categoryId ?? null,
      notes: `Late fee: ${plan.merchant}`,
    });
    addExtra(plan, id);
    const rows = instalmentsOf(plan.id);
    const next = rows.find(unpaid);
    if (next) {
      db.update(paymentPlanInstalments)
        .set({ amount: next.amount + input.amount })
        .where(eq(paymentPlanInstalments.id, next.id))
        .run();
    } else {
      db.insert(paymentPlanInstalments)
        .values({
          id: nanoid(),
          planId: plan.id,
          seq: Math.max(0, ...rows.map((r) => r.seq)) + 1,
          dueDate: input.date,
          amount: input.amount,
        })
        .run();
    }
    return getPlanView(plan.id);
  });
}

/**
 * Removes a plan and everything it added: confirmed payments go back to ordinary bank rows with
 * their old payee and category, and the purchase, refunds and fees it created are deleted.
 * Refused while any of those rows is reconciled. The bank's own rows are never deleted.
 */
export function deletePlan(planId: string) {
  db.transaction(() => {
    const plan = getPlan(planId);
    const extras = JSON.parse(plan.extraTransactionIds) as string[];
    const created = [plan.purchaseTransactionId, ...extras]
      .filter((id): id is string => !!id)
      .map((id) => db.select().from(transactions).where(eq(transactions.id, id)).get())
      .filter((row): row is TransactionRow => !!row);
    if (created.some((r) => r.reconciled === 1))
      throw new PlanError('Reconciled transactions are locked: unlock them first', 403);
    for (const otherId of new Set(
      instalmentsOf(plan.id)
        .map((i) => i.transactionId)
        .filter((id): id is string => !!id),
    ))
      unlinkTransaction(otherId);
    for (const row of created) deleteTransactionRow(row);
    db.delete(paymentPlans).where(eq(paymentPlans.id, plan.id)).run();
  });
}

// ─── Matching bank payments ─────────────────────────────────────────────────

export interface PaymentMatch {
  planId: string;
  merchant: string;
  providerName: string;
  instalmentIds: string[];
  seqs: number[];
  instalmentCount: number;
  dueDate: string;
  transaction: {
    id: string;
    accountId: string;
    date: string;
    amount: number;
    payeeName: string | null;
  };
}

/** Bank rows that could be a payment: money out of a personal account, not yet a transfer */
function paymentCandidates(from: string, to: string, excludeAccountId?: string) {
  return db
    .select({ tx: transactions })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        personalBudgetAccount,
        isNull(accounts.closedAt),
        lt(transactions.amount, 0),
        isNull(transactions.transferTransactionId),
        eq(transactions.isParent, 0),
        isNull(transactions.parentTransactionId),
        eq(transactions.reconciled, 0),
        eq(transactions.isAdjustment, 0),
        sql`${transactions.date} >= ${from} and ${transactions.date} <= ${to}`,
        sql`not exists (select 1 from household_events he where he.transaction_id = ${transactions.id})`,
        excludeAccountId ? ne(transactions.accountId, excludeAccountId) : undefined,
      ),
    )
    .all()
    .map((r) => r.tx);
}

const bankText = (row: TransactionRow) => `${row.importedPayee ?? ''} ${row.payeeName ?? ''}`;

/**
 * Suggestions for "Confirm this payment": bank rows (in the plan's payment account) whose amount
 * is one unpaid instalment within a few days of its due date, or the next few together (paying
 * ahead), and whose bank text names the provider. Suggestions only; nothing is linked until the
 * owner confirms. A row can be suggested for more than one plan; confirming one removes it.
 */
export function findPaymentMatches(today = todayIso()): PaymentMatch[] {
  const matches: PaymentMatch[] = [];
  const dismissed = new Set(
    db
      .select()
      .from(paymentPlanDismissals)
      .all()
      .map((d) => `${d.instalmentId}:${d.transactionId}`),
  );
  for (const plan of db.select().from(paymentPlans).all()) {
    if (!plan.fundingAccountId) continue;
    const open = instalmentsOf(plan.id).filter(unpaid);
    if (!open.length) continue;
    const pattern = PROVIDERS[plan.provider as Provider]?.pattern ?? null;
    const from = shift(open[0].dueDate, -Math.max(EARLY_DAYS, 14));
    const to = shift(open[open.length - 1].dueDate, LATE_DAYS);
    const rows = paymentCandidates(from, to > today ? today : to).filter(
      (r) => r.accountId === plan.fundingAccountId && (!pattern || pattern.test(bankText(r))),
    );
    const provider = PROVIDERS[plan.provider as Provider]?.name ?? plan.provider;
    for (const row of rows) {
      const paid = -row.amount;
      const near = (date: string) => {
        const days = gap(date, row.date);
        return days >= -EARLY_DAYS && days <= LATE_DAYS;
      };
      const add = (chosen: InstalmentRow[]) => {
        if (dismissed.has(`${chosen[0].id}:${row.id}`)) return;
        matches.push({
          planId: plan.id,
          merchant: plan.merchant,
          providerName: provider,
          instalmentIds: chosen.map((i) => i.id),
          seqs: chosen.map((i) => i.seq),
          instalmentCount: plan.instalmentCount,
          dueDate: chosen[0].dueDate,
          transaction: {
            id: row.id,
            accountId: row.accountId,
            date: row.date,
            amount: row.amount,
            payeeName: row.payeeName,
          },
        });
      };
      // One instalment, near its due date: the closest one when several have the same amount
      const single = open
        .filter((i) => i.amount === paid && near(i.dueDate))
        .sort((a, b) => Math.abs(gap(a.dueDate, row.date)) - Math.abs(gap(b.dueDate, row.date)));
      if (single.length) {
        add([single[0]]);
        continue;
      }
      // Paying ahead: the next several unpaid instalments at once, before the last is late
      let sum = 0;
      for (let k = 0; k < open.length; k++) {
        sum += open[k].amount;
        if (sum > paid) break;
        if (k > 0 && sum === paid && gap(row.date, open[k].dueDate) >= -LATE_DAYS) {
          add(open.slice(0, k + 1));
          break;
        }
      }
    }
  }
  return matches.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
}

// ─── Earlier purchases ──────────────────────────────────────────────────────

export interface HistoryGroup {
  accountId: string;
  accountName: string;
  transactions: { id: string; date: string; amount: number; payeeName: string | null }[];
  suggested: {
    instalmentCount: number;
    total: number;
    firstDueDate: string;
    frequency: Frequency;
  };
  /** The last payment was recent: the plan is probably still being paid */
  inProgress: boolean;
}

/**
 * Earlier payments to the provider, grouped into likely plans so each can be recorded as the
 * purchase it paid for: the same amount (the first may be a few cents more, the rounding)
 * about a fortnight apart, at most four in a row. Reconciled rows are locked and are only
 * counted. A guess for the owner to check and complete; nothing is written.
 */
export function historyGroups(
  provider: Provider,
  months: number,
  today = todayIso(),
): { groups: HistoryGroup[]; lockedCount: number } {
  const pattern = PROVIDERS[provider].pattern;
  const from = iso(addMonths(parseISO(today), -months));
  const named = (r: TransactionRow) => !pattern || pattern.test(bankText(r));
  const rows = paymentCandidates(from, today)
    .filter(named)
    .filter(
      (r) =>
        !db
          .select({ type: accounts.type })
          .from(accounts)
          .where(
            and(eq(accounts.id, r.accountId), inArray(accounts.type, ['credit', 'line_of_credit'])),
          )
          .get(),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lockedCount = db
    .select()
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        personalBudgetAccount,
        lt(transactions.amount, 0),
        eq(transactions.reconciled, 1),
        isNull(transactions.transferTransactionId),
        sql`${transactions.date} >= ${from} and ${transactions.date} <= ${today}`,
      ),
    )
    .all()
    .filter((r) => named(r.transactions)).length;

  const used = new Set<string>();
  const groups: HistoryGroup[] = [];
  const names = new Map(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => [a.id, a.name]),
  );
  for (const start of rows) {
    if (used.has(start.id)) continue;
    const chain = [start];
    used.add(start.id);
    let base: number | null = null;
    while (chain.length < 4) {
      const last = chain[chain.length - 1];
      const next = rows.find((r) => {
        if (used.has(r.id) || r.accountId !== start.accountId) return false;
        const days = gap(last.date, r.date);
        if (days < 12 || days > 16) return false;
        const amount = -r.amount;
        if (base !== null) return amount === base;
        // The first payment carries the odd cents: the rest are equal, a few cents less at most
        const diff = -start.amount - amount;
        return diff >= 0 && diff <= 3;
      });
      if (!next) break;
      base ??= -next.amount;
      chain.push(next);
      used.add(next.id);
    }
    const lastDate = chain[chain.length - 1].date;
    const inProgress = chain.length < 4 && gap(lastDate, today) <= 16;
    if (chain.length < 2 && !inProgress) continue;
    const each = base ?? -start.amount;
    const count = inProgress ? 4 : chain.length;
    const paid = chain.reduce((s, r) => s - r.amount, 0);
    groups.push({
      accountId: start.accountId,
      accountName: names.get(start.accountId) ?? '',
      transactions: chain.map((r) => ({
        id: r.id,
        date: r.date,
        amount: r.amount,
        payeeName: r.payeeName,
      })),
      suggested: {
        instalmentCount: count,
        total: paid + (count - chain.length) * each,
        firstDueDate: start.date,
        frequency: 'fortnightly',
      },
      inProgress,
    });
  }
  return { groups: groups.reverse(), lockedCount };
}

// ─── Budget: what is due ────────────────────────────────────────────────────

/**
 * Unpaid instalments due in `month` (and, in the current month, overdue ones), by the plan
 * account's payment category: shown on the Budget page as what that envelope should expect to
 * pay. A projection only.
 */
export function expectedInstalments(month: string, today = todayIso()) {
  const byCategory = new Map<
    string,
    { scheduleId: string; name: string; date: string; amount: number }[]
  >();
  if (month < today.slice(0, 7)) return byCategory;
  const current = month === today.slice(0, 7);
  const funding = new Map(
    db
      .select()
      .from(cardFunding)
      .all()
      .map((c) => [c.accountId, c.categoryId]),
  );
  for (const plan of db.select().from(paymentPlans).all()) {
    const categoryId = funding.get(plan.accountId);
    if (!categoryId) continue;
    for (const i of instalmentsOf(plan.id).filter(unpaid)) {
      const inMonth = i.dueDate.slice(0, 7) === month;
      if (!inMonth && !(current && i.dueDate < month)) continue;
      const list = byCategory.get(categoryId) ?? [];
      list.push({
        scheduleId: `plan:${plan.id}:${i.seq}`,
        name: `${plan.merchant} (${i.seq} of ${plan.instalmentCount})`,
        date: i.dueDate,
        amount: i.amount,
      });
      byCategory.set(categoryId, list);
    }
  }
  return byCategory;
}
