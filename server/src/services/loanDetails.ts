/**
 * Rate and repayment for loan, mortgage and other debt accounts (docs/LONG-TERM-FORECAST.md
 * §7). Beside the account, not on it: the account's balance stays the ledger's, and nothing
 * here moves money.
 */
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accountLoanDetails, accounts } from '../db/schema.js';
import { isLiabilityType } from '../utils/accountTypes.js';
import { ForecastError } from './forecastService.js';

export const loanDetailsSchema = z
  .object({
    rateBps: z.number().int().min(0).max(10_000),
    monthlyRepayment: z.number().int().min(0).max(10_000_000_000_000),
    termMonths: z.number().int().min(1).max(1200).nullable(),
  })
  .strict();
export type LoanDetails = z.infer<typeof loanDetailsSchema>;

export interface LoanListing {
  accountId: string;
  name: string;
  type: string;
  details: LoanDetails | null;
}

export function listLoanDetails(): LoanListing[] {
  const details = new Map(
    db
      .select()
      .from(accountLoanDetails)
      .all()
      .map((d) => [d.accountId, d]),
  );
  return db
    .select()
    .from(accounts)
    .where(isNull(accounts.closedAt))
    .all()
    .filter((a) => isLiabilityType(a.type))
    .map((a) => {
      const d = details.get(a.id);
      return {
        accountId: a.id,
        name: a.name,
        type: a.type,
        details: d
          ? { rateBps: d.rateBps, monthlyRepayment: d.monthlyRepayment, termMonths: d.termMonths }
          : null,
      };
    });
}

export function setLoanDetails(accountId: string, details: LoanDetails): LoanDetails {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) throw new ForecastError('Account not found', 404);
  if (!isLiabilityType(account.type))
    throw new ForecastError('Loan details belong to a loan, mortgage or other debt account', 400);
  const now = new Date().toISOString();
  db.insert(accountLoanDetails)
    .values({ accountId, ...details, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: accountLoanDetails.accountId,
      set: { ...details, updatedAt: now },
    })
    .run();
  return details;
}

export function deleteLoanDetails(accountId: string) {
  db.delete(accountLoanDetails).where(eq(accountLoanDetails.accountId, accountId)).run();
}
