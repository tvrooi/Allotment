import type { BudgetSummary } from '../types';

type Funding = Pick<
  BudgetSummary,
  | 'overspent'
  | 'uncategorized'
  | 'toBeBudgeted'
  | 'paymentShortfall'
  | 'uncoveredCardPayments'
  | 'accountIssues'
  | 'complete'
>;

/** What the Ready to assign hero reads from the summary: the causes, plus the server's verdict */
type HeroFunding = Funding &
  Pick<BudgetSummary, 'resolved' | 'resources' | 'envelopes' | 'reserved'>;

export type UnresolvedCause = 'overspent' | 'uncategorised' | 'card-payments' | 'over-assigned';

const CAUSE_WORDS: Record<UnresolvedCause, string> = {
  overspent: 'overspent envelopes',
  uncategorised: 'uncategorised spending',
  'card-payments': 'card payments without funding',
  'over-assigned': 'more assigned than you have',
};

/**
 * The causes that keep a figure that holds from being settled, in one order. The only place
 * these checks live: the todo line and the $0 caveat label both read this list.
 */
export function unresolvedCauses(f: Funding): UnresolvedCause[] {
  const causes: UnresolvedCause[] = [];
  if (f.overspent > 0) causes.push('overspent');
  if (f.uncategorized > 0) causes.push('uncategorised');
  if ((f.paymentShortfall ?? 0) > 0 || (f.uncoveredCardPayments ?? 0) > 0)
    causes.push('card-payments');
  if (f.toBeBudgeted < 0) causes.push('over-assigned');
  return causes;
}

/**
 * Whether the figure itself is in doubt: balances that disagree with the bank, or missing
 * exchange rates. Overspending and the rest are jobs to do beside a figure that holds.
 */
export function figureInDoubt(f: Pick<Funding, 'accountIssues' | 'complete'>): boolean {
  return !!f.accountIssues?.length || f.complete === false;
}

/**
 * What keeps the budget from being settled, naming only what is actually there: an account
 * that disagrees with its bank, missing exchange rates, overspent envelopes, uncategorised
 * spending, card payments without funding, or more assigned than there is.
 */
export function unresolvedReason(f: Funding): string {
  if (f.accountIssues?.length) return 'Reconcile account balances before assigning money';
  if (f.complete === false) return 'Incomplete: missing exchange rates';
  const causes = unresolvedCauses(f).map((c) => CAUSE_WORDS[c]);
  if (!causes.length) return 'Check the Review page';
  const list =
    causes.length === 1
      ? causes[0]
      : `${causes.slice(0, -1).join(', ')} and ${causes[causes.length - 1]}`;
  return `Resolve ${list}`;
}

/** The $0 caveat for a single cause; a cause without its own sentence is an item to review */
const CAVEAT: Partial<Record<UnresolvedCause, string>> = {
  overspent: 'All assigned, but envelopes are overspent',
  uncategorised: 'All assigned, but some spending has no category',
  'card-payments': 'All assigned, but card payments need funding',
};

export interface ReadyStatus {
  /** The hero's background */
  bg: string;
  /** The "Ready to assign" heading and its supporting text */
  text: string;
  /** The status line under the figure; null shows none */
  label: string | null;
  labelClass: string;
  /** The figure: zero is always the normal text colour */
  figureClass: string;
  /** The seedling before the label, only on a clean $0 */
  glyph: boolean;
}

const look = (bg: string, text: string, label: string | null): ReadyStatus => ({
  bg,
  text,
  label,
  labelClass: text,
  figureClass: text,
  glyph: false,
});

/** At $0 the figure is the normal text colour, whatever the hero's look (GLOSSARY.md) */
const atZero = (bg: string, text: string, label: string | null, labelClass = text) => ({
  ...look(bg, text, label),
  labelClass,
  figureClass: 'text-text',
});

/**
 * The Ready to assign hero's state (#241). `funding` is undefined while the summary loads or
 * has failed: a $0 then gets no label, because praise needs the server's `resolved`. Labels
 * carry no amount, so Safe mode reveals nothing beyond the masked figure.
 */
export function readyToAssignStatus(
  toBeBudgeted: number,
  incomePlanned: number,
  funding?: HeroFunding,
): ReadyStatus {
  if (funding && figureInDoubt(funding))
    return look('bg-caution-subtle', 'text-caution', unresolvedReason(funding));
  if (toBeBudgeted < 0)
    return look('bg-negative-subtle', 'text-negative', 'Assigned more than you have');
  if (toBeBudgeted === 0) {
    if (!funding) return atZero('bg-surface-alt', 'text-text-secondary', null);
    // A new budget: no money yet is nothing to praise
    if (funding.resources === 0 && (funding.envelopes ?? funding.reserved) === 0)
      return atZero('bg-surface-alt', 'text-text-secondary', 'Nothing to assign yet');
    if (funding.resolved)
      return {
        ...atZero(
          'bg-positive-subtle',
          'text-positive',
          'Every dollar has a job',
          'text-positive font-medium',
        ),
        glyph: true,
      };
    // The server's resolved also counts causes not named here (a pool below zero)
    const causes = unresolvedCauses(funding);
    const caveat =
      causes.length >= 2
        ? `All assigned, with ${causes.length} things to resolve`
        : (causes.length === 1 && CAVEAT[causes[0]]) || 'All assigned, with items to review';
    return atZero(
      'bg-positive-subtle',
      'text-positive',
      caveat,
      'text-text font-medium text-pretty',
    );
  }
  const threshold = Math.max(incomePlanned * 0.02, 500);
  if (toBeBudgeted <= threshold)
    return look('bg-caution-subtle', 'text-caution', 'Almost budgeted');
  return look('bg-positive-subtle', 'text-positive', 'Give every dollar a job');
}
