import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  accessTokens,
  budgetMonths,
  budgetProposals,
  cardFunding,
  categories,
  categoryGroups,
} from '../db/schema.js';
import { BudgetError, fundedWrite } from './budgetMoves.js';
import { fundingState } from './budgetService.js';
import { todayIso } from './mainAmountService.js';
import { addMonthsTo } from './fundingMath.js';

// Assignment suggestions from an organise token (an assistant): saved for the owner, who
// applies or dismisses them on the Budget page. A suggestion never assigns money by itself;
// applying it adds each amount to the month's assignment, all or nothing, from money that is
// unassigned at that moment (budgetMoves.fundedWrite).

export interface ProposalRow {
  categoryId: string;
  amount: number;
  reason?: string;
}

function parseRows(json: string): ProposalRow[] {
  try {
    const rows = JSON.parse(json) as ProposalRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Open suggestions (or every one), newest first, with category names */
export function listProposals(status?: 'open') {
  const names = new Map(
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .all()
      .map((c) => [c.id, c.name]),
  );
  return db
    .select()
    .from(budgetProposals)
    .where(status ? eq(budgetProposals.status, status) : undefined)
    .orderBy(desc(budgetProposals.createdAt))
    .limit(50)
    .all()
    .map(({ rowsJson, ...p }) => {
      const rows = parseRows(rowsJson).map((r) => ({
        ...r,
        categoryName: names.get(r.categoryId) ?? null,
      }));
      return { ...p, rows, total: rows.reduce((s, r) => s + r.amount, 0) };
    });
}

/** Saves a suggestion: expense categories only, this month or next, within unassigned money */
export function createProposal(
  input: { month: string; note?: string; rows: ProposalRow[] },
  tokenId?: string,
) {
  const thisMonth = todayIso().slice(0, 7);
  if (input.month !== thisMonth && input.month !== addMonthsTo(thisMonth, 1))
    throw new BudgetError('Suggest assignments for this month or next', 400);
  const payment = new Set(
    db
      .select({ id: cardFunding.categoryId })
      .from(cardFunding)
      .all()
      .map((r) => r.id),
  );
  const expense = new Set(
    db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(eq(categoryGroups.isIncome, 0))
      .all()
      .map((c) => c.id)
      .filter((id) => !payment.has(id)),
  );
  const ids = input.rows.map((r) => r.categoryId);
  if (new Set(ids).size !== ids.length) throw new BudgetError('List each category once', 400);
  const bad = input.rows.find((r) => !expense.has(r.categoryId));
  if (bad)
    throw new BudgetError(
      `${bad.categoryId} isn't an expense category (income and payment envelopes can't be assigned)`,
      400,
    );
  const total = input.rows.reduce((s, r) => s + r.amount, 0);
  const { available, complete } = fundingState();
  if (!complete) throw new BudgetError('Add missing exchange rates before assigning money.');
  if (total > available)
    throw new BudgetError(
      `That is more than the ${(available / 100).toFixed(2)} ready to assign today`,
      400,
    );
  const tokenName =
    (tokenId &&
      db
        .select({ name: accessTokens.name })
        .from(accessTokens)
        .where(eq(accessTokens.id, tokenId))
        .get()?.name) ||
    'Assistant';
  const row = {
    id: nanoid(),
    month: input.month,
    tokenId: tokenId ?? null,
    tokenName,
    note: input.note ?? null,
    rowsJson: JSON.stringify(input.rows),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.insert(budgetProposals).values(row).run();
  return listProposals().find((p) => p.id === row.id)!;
}

function openProposal(id: string) {
  const p = db.select().from(budgetProposals).where(eq(budgetProposals.id, id)).get();
  if (!p) throw new BudgetError('Suggestion not found', 404);
  if (p.status !== 'open') throw new BudgetError(`This suggestion was already ${p.status}`);
  return p;
}

/** Adds every suggested amount to the month's assignments, or none if money runs short */
export function applyProposal(id: string) {
  const p = openProposal(id);
  const rows = parseRows(p.rowsJson);
  fundedWrite(() => {
    for (const r of rows) {
      if (!db.select().from(categories).where(eq(categories.id, r.categoryId)).get())
        throw new BudgetError('A suggested category no longer exists. Dismiss this suggestion.');
      const existing =
        db
          .select()
          .from(budgetMonths)
          .where(and(eq(budgetMonths.month, p.month), eq(budgetMonths.categoryId, r.categoryId)))
          .get()?.budgeted ?? 0;
      const budgeted = existing + r.amount;
      db.insert(budgetMonths)
        .values({ id: nanoid(), month: p.month, categoryId: r.categoryId, budgeted })
        .onConflictDoUpdate({
          target: [budgetMonths.month, budgetMonths.categoryId],
          set: { budgeted },
        })
        .run();
    }
    db.update(budgetProposals)
      .set({ status: 'applied', decidedAt: new Date().toISOString() })
      .where(eq(budgetProposals.id, id))
      .run();
  });
  return { applied: rows.reduce((s, r) => s + r.amount, 0), month: p.month };
}

export function dismissProposal(id: string) {
  openProposal(id);
  db.update(budgetProposals)
    .set({ status: 'dismissed', decidedAt: new Date().toISOString() })
    .where(eq(budgetProposals.id, id))
    .run();
  return { ok: true };
}
