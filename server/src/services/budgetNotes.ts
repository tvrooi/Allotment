// BUD-10: the owner's notes on a budget month and on a category. Free text that moves no money:
// it is never a transaction, never changes a category's identity, and doesn't bump the budget
// revision, so writing one leaves every open funding preview valid. This is the one place that
// writes them (routes/budget.ts, owner only).
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { budgetMonthNotes, categories, categoryNotes } from '../db/schema.js';
import { BudgetError } from './budgetMoves.js';

/** The longest note kept; the routes refuse a longer one */
export const MAX_NOTE_LENGTH = 2000;

const now = () => new Date().toISOString();

/** Leading and trailing space doesn't count; an empty note removes the row */
const tidy = (note: string) => note.trim();

export function monthNote(month: string): string {
  return (
    db.select().from(budgetMonthNotes).where(eq(budgetMonthNotes.month, month)).get()?.note ?? ''
  );
}

export function setMonthNote(month: string, note: string) {
  const text = tidy(note);
  if (!text) db.delete(budgetMonthNotes).where(eq(budgetMonthNotes.month, month)).run();
  else
    db.insert(budgetMonthNotes)
      .values({ month, note: text, updatedAt: now() })
      .onConflictDoUpdate({ target: budgetMonthNotes.month, set: { note: text, updatedAt: now() } })
      .run();
  return { month, note: text };
}

/** Every category's note, by category id */
export function categoryNoteMap(): Map<string, string> {
  return new Map(
    db
      .select()
      .from(categoryNotes)
      .all()
      .map((r) => [r.categoryId, r.note]),
  );
}

export function setCategoryNote(categoryId: string, note: string) {
  if (!db.select().from(categories).where(eq(categories.id, categoryId)).get())
    throw new BudgetError('Category not found', 404);
  const text = tidy(note);
  if (!text) db.delete(categoryNotes).where(eq(categoryNotes.categoryId, categoryId)).run();
  else
    db.insert(categoryNotes)
      .values({ categoryId, note: text, updatedAt: now() })
      .onConflictDoUpdate({
        target: categoryNotes.categoryId,
        set: { note: text, updatedAt: now() },
      })
      .run();
  return { categoryId, note: text };
}

/** The budget's groups with each category's note (`''` for none) */
export function withCategoryNotes<C extends { id: string }, G extends { categories: C[] }>(
  groups: G[],
): (G & { categories: (C & { note: string })[] })[] {
  const notes = categoryNoteMap();
  return groups.map((g) => ({
    ...g,
    categories: g.categories.map((c) => ({ ...c, note: notes.get(c.id) ?? '' })),
  }));
}
