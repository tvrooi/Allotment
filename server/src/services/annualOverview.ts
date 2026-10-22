import { budgetGroups, fundingState } from './budgetService.js';
import { todayIso } from './mainAmountService.js';

// The annual budget overview (docs/MONARCH-DEVELOPMENT-PHASE.md, "Annual overview"). It is
// built from the monthly budget calculation itself, so each month agrees with the monthly
// budget. Assignments and activity are summed; balances never are. Months after the current
// one are plans: they never add to money available today, which comes from fundingState.

export interface AnnualMonth {
  month: string;
  /** After the current month: assignments are plans, there is no activity yet */
  planned: boolean;
  assigned: number;
  activity: number;
}

export interface AnnualCategory {
  id: string;
  name: string;
  months: AnnualMonth[];
  assigned: number;
  activity: number;
  /** Available at the end of the latest month of the year that has started; null before it */
  available: number | null;
}

export interface AnnualGroup {
  id: string;
  name: string;
  isIncome: boolean;
  categories: AnnualCategory[];
}

export function annualOverview(year: number, today = todayIso()) {
  const current = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  // The month whose closing balances the year reports: December, or this month mid-year
  const balanceMonth = months.filter((m) => m <= current).at(-1) ?? null;
  const perMonth = months.map((m) => ({ month: m, groups: budgetGroups(m, today) }));

  const groups: AnnualGroup[] = perMonth[0].groups.map((g) => ({
    id: g.id,
    name: g.name,
    isIncome: Boolean(g.isIncome),
    categories: g.categories.map((c) => {
      const cells = perMonth.map(({ month, groups: gs }) => {
        const cat = gs.find((x) => x.id === g.id)?.categories.find((x) => x.id === c.id);
        return {
          month,
          planned: month > current,
          assigned: cat?.budgeted ?? 0,
          activity: cat?.activity ?? 0,
          balance: cat?.balance ?? 0,
        };
      });
      const closing = balanceMonth ? cells.find((m) => m.month === balanceMonth) : undefined;
      return {
        id: c.id,
        name: c.name,
        months: cells.map(({ balance: _balance, ...cell }) => cell),
        assigned: cells.reduce((s, m) => s + m.assigned, 0),
        activity: cells.reduce((s, m) => s + m.activity, 0),
        available: closing ? closing.balance : null,
      };
    }),
  }));

  const expense = groups.filter((g) => !g.isIncome).flatMap((g) => g.categories);
  const income = groups.filter((g) => g.isIncome).flatMap((g) => g.categories);
  const totals = months.map((month, i) => ({
    month,
    planned: month > current,
    assigned: expense.reduce((s, c) => s + c.months[i].assigned, 0),
    activity: expense.reduce((s, c) => s + c.months[i].activity, 0),
    income: income.reduce((s, c) => s + c.months[i].activity, 0),
  }));
  const state = fundingState(today);
  return {
    year,
    asOf: today,
    balanceMonth,
    months: totals,
    groups,
    totals: {
      assigned: totals.reduce((s, m) => s + m.assigned, 0),
      activity: totals.reduce((s, m) => s + m.activity, 0),
      income: totals.reduce((s, m) => s + m.income, 0),
      /** Assignments to months after the current one, in this year */
      plannedAssigned: totals.filter((m) => m.planned).reduce((s, m) => s + m.assigned, 0),
    },
    // Today's position, unchanged from the budget: plans and expected pay never add to it
    today: {
      complete: state.complete,
      available: state.available,
      unassigned: state.unassigned,
      futureAssigned: state.futureAssigned,
      // Phase 6B's card positions, unchanged: debt, its payment reserve and what is unfunded
      cards: state.cards.map((c) => ({
        accountId: c.accountId,
        name: c.name,
        debt: c.debt,
        reserve: c.available,
        shortfall: c.shortfall,
      })),
      paymentShortfall: state.paymentShortfall,
    },
  };
}
