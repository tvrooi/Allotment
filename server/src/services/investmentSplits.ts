// D3c splits and consolidations (docs/INVESTMENT-SALES-AND-INCOME.md §4): a split is an event on
// a holding, a date and a ratio. It never rewrites a lot or a sale parcel: a lot's units on a day
// are its recorded units times the splits after it was bought and on or before that day, and a
// parcel's units are as of its sale's date (splitMath.ts). Recording one scales the units the
// holding holds now, in the same DB transaction. Writes are made through investmentTax.ts.
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { holdings, investmentSales, investmentSplits, taxLots } from '../db/schema.js';
import { InvestmentError } from './investmentError.js';
import { todayIso } from './mainAmountService.js';
import { lotUnitsOn, scaleUnits, validRatio, type Split } from './splitMath.js';

export interface SplitInput {
  /** The first day on which units are counted after the split */
  effectiveOn: string;
  toUnits: number;
  fromUnits: number;
}

const now = () => new Date().toISOString();

/** Every holding's splits in the order they happened (then the order they were entered) */
export function splitsByHolding(): Map<string, Split[]> {
  const out = new Map<string, Split[]>();
  for (const r of db
    .select()
    .from(investmentSplits)
    .orderBy(asc(investmentSplits.effectiveOn), asc(investmentSplits.createdAt))
    .all()) {
    const list = out.get(r.holdingId) ?? [];
    list.push({ effectiveOn: r.effectiveOn, toUnits: r.toUnits, fromUnits: r.fromUnits });
    out.set(r.holdingId, list);
  }
  return out;
}

export function splitsOf(holdingId: string): Split[] {
  return db
    .select()
    .from(investmentSplits)
    .where(eq(investmentSplits.holdingId, holdingId))
    .orderBy(asc(investmentSplits.effectiveOn), asc(investmentSplits.createdAt))
    .all()
    .map((r) => ({ effectiveOn: r.effectiveOn, toUnits: r.toUnits, fromUnits: r.fromUnits }));
}

/** A holding's splits for the Investments page, newest first */
export function splitRows(holdingId: string) {
  return db
    .select({
      id: investmentSplits.id,
      effectiveOn: investmentSplits.effectiveOn,
      toUnits: investmentSplits.toUnits,
      fromUnits: investmentSplits.fromUnits,
    })
    .from(investmentSplits)
    .where(eq(investmentSplits.holdingId, holdingId))
    .orderBy(desc(investmentSplits.effectiveOn), desc(investmentSplits.createdAt))
    .all();
}

function holdingOf(holdingId: string) {
  const row = db.select().from(holdings).where(eq(holdings.id, holdingId)).get();
  if (!row) throw new InvestmentError('Holding not found', 404);
  return row;
}

function splitOf(holdingId: string, splitId: string) {
  const row = db.select().from(investmentSplits).where(eq(investmentSplits.id, splitId)).get();
  if (!row || row.holdingId !== holdingId) throw new InvestmentError('Split not found', 404);
  return row;
}

/**
 * Sales dated on or after a split were entered in units counted after it, or before it was
 * recorded: either way recording or removing the split would change what their units mean.
 */
function refuseIfSoldAfter(holdingId: string, effectiveOn: string, action: string) {
  const sale = db
    .select({ id: investmentSales.id })
    .from(investmentSales)
    .where(and(eq(investmentSales.holdingId, holdingId), gte(investmentSales.soldOn, effectiveOn)))
    .get();
  if (sale)
    throw new InvestmentError(
      `A sale is dated on or after ${effectiveOn}. ${action} Remove the sale and enter it again afterwards.`,
      409,
    );
}

function checkInput(holdingId: string, input: SplitInput) {
  holdingOf(holdingId);
  if (input.effectiveOn > todayIso())
    throw new InvestmentError("A split can't be dated in the future");
  if (!validRatio(input.toUnits, input.fromUnits))
    throw new InvestmentError('Enter two different whole numbers for the ratio, such as 2 for 1');
  refuseIfSoldAfter(
    holdingId,
    input.effectiveOn,
    "Recording this split would change that sale's units.",
  );
}

/** What a split would do to the units held now and to each purchase, before it is saved */
export function previewSplit(holdingId: string, input: SplitInput) {
  checkInput(holdingId, input);
  const holding = holdingOf(holdingId);
  const splits = splitsOf(holdingId);
  const after = [...splits, { ...input }].sort((a, b) =>
    a.effectiveOn.localeCompare(b.effectiveOn),
  );
  const today = todayIso();
  const held = scaleUnits(holding.quantity, input);
  const lots = db
    .select()
    .from(taxLots)
    .where(eq(taxLots.holdingId, holdingId))
    .orderBy(asc(taxLots.acquiredOn), asc(taxLots.createdAt))
    .all()
    .map((l) => {
      const before = lotUnitsOn(l, splits, today);
      const next = lotUnitsOn(l, after, today);
      return {
        id: l.id,
        acquiredOn: l.acquiredOn,
        before: before.units,
        after: next.units,
        // A lot bought on or after the split date isn't scaled by it
        scaled: next.units !== before.units,
        exact: next.exact,
      };
    });
  return {
    before: holding.quantity,
    after: held.units,
    lots,
    /** A fraction of a millionth of a unit is dropped by the holding or a lot */
    rounded: !held.exact || lots.some((l) => !l.exact),
  };
}

/** Records a split and scales the holding's units. Call inside investmentTax.ts's lock. */
export function saveSplit(holdingId: string, input: SplitInput) {
  const preview = previewSplit(holdingId, input);
  const id = nanoid();
  const at = now();
  db.insert(investmentSplits)
    .values({
      id,
      holdingId,
      effectiveOn: input.effectiveOn,
      toUnits: input.toUnits,
      fromUnits: input.fromUnits,
      createdAt: at,
    })
    .run();
  db.update(holdings)
    .set({ quantity: preview.after, updatedAt: at })
    .where(eq(holdings.id, holdingId))
    .run();
  return { id, ...input, before: preview.before, after: preview.after, rounded: preview.rounded };
}

/** Removes a split and scales the holding's units back. Call inside investmentTax.ts's lock. */
export function deleteSplit(holdingId: string, splitId: string) {
  const split = splitOf(holdingId, splitId);
  const holding = holdingOf(holdingId);
  refuseIfSoldAfter(
    holdingId,
    split.effectiveOn,
    "Removing this split would change that sale's units.",
  );
  db.delete(investmentSplits).where(eq(investmentSplits.id, splitId)).run();
  db.update(holdings)
    .set({ quantity: scaleUnits(holding.quantity, split, 'back').units, updatedAt: now() })
    .where(eq(holdings.id, holdingId))
    .run();
}
