// Investments on Tax time (docs/INVESTMENT-SALES-AND-INCOME.md): every write to a sale, a payment
// or what they depend on runs here, in one DB transaction, and is undone with a refusal when it
// would change a lodged year's figures (item 18's capital gains or item 11's income), the way
// depreciating assets are locked.
import { db } from '../db/index.js';
import { lodgedYears } from './depreciatingAssetService.js';
import { financialYearName } from './financialYear.js';
import { InvestmentError } from './investmentError.js';
import {
  deleteIncome,
  incomeYear,
  saveIncome,
  type IncomeInput,
} from './investmentIncomeService.js';
import { capitalGainsYear, deleteSale, saveSale, type SaleInput } from './investmentSales.js';
import { updateBudgetSettings } from './mainAmountService.js';

/** What a lodged year's lock protects: its figures, and each sale's and payment's */
function lockedFigures(fy: number) {
  const g = capitalGainsYear(fy);
  const i = incomeYear(fy);
  return JSON.stringify({
    gains: [g.totalGains, g.netGain, g.lossesCarriedForward, g.lossesApplied, g.unknownParcels],
    sales: g.sales.map((s) => [s.id, s.soldOn, s.quantity, s.proceeds, s.cost, s.gain]),
    income: [i.dividends, i.distributions, i.interest, i.unconverted],
    payments: i.payments.map((p) => [p.id, p.paidOn, p.kind, p.converted]),
  });
}

/** Runs `change` in one DB transaction, undone with a 409 when it moves a lodged year's figures */
export function keepingLodgedYears<T>(change: () => T): T {
  return db.transaction(() => {
    const lodged = lodgedYears();
    const before = lodged.map(lockedFigures);
    const result = change();
    const changed = lodged.filter((fy, i) => lockedFigures(fy) !== before[i]);
    if (changed.length)
      throw new InvestmentError(
        `That would change the investment figures of ${changed.map(financialYearName).join(', ')}, already lodged. Unlock the year first.`,
        409,
      );
    return result;
  });
}

export const recordSale = (holdingId: string, input: SaleInput) =>
  keepingLodgedYears(() => saveSale(holdingId, input));

export const updateSale = (holdingId: string, saleId: string, input: SaleInput) =>
  keepingLodgedYears(() => saveSale(holdingId, input, saleId));

/** Removes a sale and puts its units back in the holding and its lots */
export const removeSale = (holdingId: string, saleId: string) =>
  keepingLodgedYears(() => deleteSale(holdingId, saleId));

export const recordIncome = (holdingId: string, input: IncomeInput) =>
  keepingLodgedYears(() => saveIncome(holdingId, input));

export const updateIncome = (holdingId: string, incomeId: string, input: IncomeInput) =>
  keepingLodgedYears(() => saveIncome(holdingId, input, incomeId));

/** Removes a payment and any units it reinvested */
export const removeIncome = (holdingId: string, incomeId: string) =>
  keepingLodgedYears(() => deleteIncome(holdingId, incomeId));

/** Net capital losses carried into a year from before Allotment (0 clears them) */
export function setCarriedInLosses(financialYear: number | null, amount: number) {
  keepingLodgedYears(() =>
    updateBudgetSettings({
      capitalLossesCarriedIn: financialYear === null ? 0 : amount,
      capitalLossesCarriedInFy: amount && financialYear !== null ? financialYear : null,
    }),
  );
}
