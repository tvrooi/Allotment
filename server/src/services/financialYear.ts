// Australian financial years (1 July to 30 June), named by the year they start. Shared by Tax
// time's deductions (taxService.ts) and capital gains (investmentSales.ts).

/** The financial year a date falls in, named by the year it starts: 2026 = 1 July 2026–30 June 2027 */
export function financialYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 7 ? year : year - 1;
}
export const financialYearRange = (fy: number) => ({ from: `${fy}-07-01`, to: `${fy + 1}-06-30` });
export const financialYearName = (fy: number) => `${fy}–${String(fy + 1).slice(2)}`;
