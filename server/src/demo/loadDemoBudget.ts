import { and, eq } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  budgetSettings,
  exchangeRates,
  budgetMonths,
  budgetMonthNotes,
  categoryNotes,
  categories,
  categoryGroups,
  customReports,
  dashboardPages,
  dashboardWidgets,
  goals,
  holdings,
  householdGroups,
  householdPeople,
  investmentIncome,
  investmentSplits,
  investmentSaleParcels,
  investmentSales,
  payees,
  rules,
  scheduleOccurrences,
  schedules,
  securities,
  securityPrices,
  taxHomeHours,
  taxHomeYears,
  taxLots,
  tags,
  transactionTags,
  transactions,
} from '../db/schema.js';
import { ensureOccurrencesForAll } from '../services/scheduleService.js';
import { linkOccurrenceToTransaction } from '../services/matchingEngine.js';
import { buildDemoBudget, type DemoBudget, type DemoFile } from './demoBudget.js';
import { DEMO_NOTES, DEMO_PDFS, DEMO_RECEIPT_PHOTOS } from './demoFiles.js';
import { addReceipt, updateReceipt } from '../services/receiptService.js';
import { addDocument, linkDocument, updateDocument } from '../services/documentService.js';
import { uploadFromBytes } from '../services/fileStore.js';
import { setClaim } from '../services/taxService.js';
import { createAsset, listAssets, lodgeYear } from '../services/depreciatingAssetService.js';
import {
  recordEvent,
  shareBillPayments,
  sharePayments,
  shareRecurringBills,
  snapshot,
} from '../services/householdService.js';
import { createPlan as createPayLater, createPlanAccount } from '../services/paymentPlanService.js';
import { createPlan as createLongTermPlan } from '../services/longTermPlans.js';
import { planSchema } from '../services/longTermConfig.js';
import { setLoanDetails } from '../services/loanDetails.js';

/** Rows per INSERT: SQLite allows 32,766 bound values, and transactions have ~17 columns */
const CHUNK = 500;

/**
 * Fills an empty database with the demo budget, dated relative to `today`. Used by the
 * in-browser demo (server/src/browser) and `npm run db:seed-demo`.
 */
export function loadDemoBudget(today: Date): void {
  const demo = buildDemoBudget(today);

  db.transaction((tx) => {
    const insert = <T extends Parameters<typeof tx.insert>[0]>(
      table: T,
      rows: T['$inferInsert'][],
    ) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        tx.insert(table)
          .values(rows.slice(i, i + CHUNK))
          .run();
      }
    };
    // Parents before the rows that point at them
    insert(budgetSettings, demo.budgetSettings);
    insert(exchangeRates, demo.exchangeRates);
    insert(categoryGroups, demo.categoryGroups);
    insert(categories, demo.categories);
    insert(accounts, demo.accounts);
    insert(payees, demo.payees);
    insert(schedules, demo.schedules);
    insert(transactions, demo.transactions);
    insert(budgetMonths, demo.budgetMonths);
    insert(rules, demo.rules);
    insert(customReports, demo.customReports);
    insert(dashboardPages, demo.dashboardPages);
    insert(dashboardWidgets, demo.dashboardWidgets);
    insert(goals, demo.goals);
    insert(budgetMonthNotes, demo.budgetMonthNotes);
    insert(categoryNotes, demo.categoryNotes);
    insert(securities, demo.securities);
    insert(securityPrices, demo.securityPrices);
    insert(holdings, demo.holdings);
    insert(taxLots, demo.taxLots);
    insert(investmentSales, demo.investmentSales);
    insert(investmentSaleParcels, demo.investmentSaleParcels);
    insert(investmentIncome, demo.investmentIncome);
    insert(investmentSplits, demo.investmentSplits);
    insert(taxHomeYears, demo.taxHomeYears);
    insert(taxHomeHours, demo.taxHomeHours);
    insert(tags, demo.tags);
    insert(transactionTags, demo.transactionTags);
  });

  // Recurring items get their occurrences the way the app makes them (three months ahead,
  // like the server's startup task), then past ones are marked paid or skipped
  ensureOccurrencesForAll(format(addDays(today, 90), 'yyyy-MM-dd'));
  for (const link of demo.scheduleLinks) {
    const occurrence = db
      .select({ id: scheduleOccurrences.id })
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.scheduleId, link.scheduleId),
          eq(scheduleOccurrences.scheduledDate, link.scheduledDate),
        ),
      )
      .get();
    if (!occurrence) continue;
    if (link.transactionId) {
      linkOccurrenceToTransaction(occurrence.id, link.transactionId, 'automatic', 100);
    } else {
      db.update(scheduleOccurrences)
        .set({ status: 'skipped', skippedAt: link.scheduledDate })
        .where(eq(scheduleOccurrences.id, occurrence.id))
        .run();
    }
  }

  loadRecords(demo, format(today, 'yyyy-MM-dd'));
}

/** A sample file's bytes */
function fileBytes(file: DemoFile) {
  const base64 =
    file.kind === 'photo'
      ? DEMO_RECEIPT_PHOTOS[file.key]
      : file.kind === 'pdf'
        ? DEMO_PDFS[file.key]
        : DEMO_NOTES[file.key];
  return Buffer.from(base64, 'base64');
}

/**
 * Receipts, files, tax claims, the household and plans, made through the same services the
 * pages use, so the demo's records follow every rule a real budget's do (a matched receipt
 * splits its payment by category, a shared payment becomes a household entry, and so on).
 * Each service runs its own database transaction: sql.js can't nest them.
 */
function loadRecords(demo: DemoBudget, today: string) {
  for (const claim of demo.taxClaims)
    setClaim(claim.transactionId, {
      label: claim.label,
      workUseBps: claim.workUseBps,
      notes: claim.notes,
    });
  for (const asset of demo.depreciatingAssets) createAsset(asset);
  const assetIds = new Map(listAssets().map((a) => [a.name, a.id]));
  for (const fy of demo.lodgedYears) db.transaction(() => lodgeYear(fy));

  for (const receipt of demo.receipts) {
    const { id } = addReceipt({
      bytes: fileBytes(receipt.file),
      fileName: receipt.fileName,
      transactionId: receipt.transactionId,
    });
    updateReceipt(id, {
      merchant: receipt.merchant,
      receiptDate: receipt.receiptDate,
      total: receipt.total,
      tax: receipt.tax,
      lineItems: receipt.items,
    });
    const assetId = receipt.assetName && assetIds.get(receipt.assetName);
    if (assetId) linkDocument(id, 'asset', assetId);
  }
  for (const doc of demo.documents) {
    const { id } = addDocument({
      upload: uploadFromBytes(fileBytes(doc.file)),
      fileName: doc.fileName,
      description: doc.description,
      link: doc.link ?? undefined,
    });
    updateDocument(id, {
      documentDate: doc.documentDate,
      important: doc.important,
      starred: doc.starred,
    });
  }

  const house = demo.household;
  const groupId = 'demo-household';
  db.insert(householdGroups)
    .values({ id: groupId, name: house.name, currency: 'AUD', accountId: null, isDefault: 1 })
    .run();
  const personIds = house.people.map((name, i) => {
    const id = `demo-person-${i}`;
    db.insert(householdPeople)
      .values({ id, groupId, name, isSelf: i === house.selfIndex ? 1 : 0 })
      .run();
    return id;
  });
  shareRecurringBills(groupId, house.billScheduleIds);
  // Each shared bill's recent payments (what the Household page lists), then the other payments
  const billPayments = snapshot(groupId).recurringBills.flatMap((bill) =>
    shareBillPayments(
      groupId,
      bill.scheduleId,
      bill.payments.filter((p) => !p.shared).map((p) => p.transactionId),
    ),
  );
  const shared = sharePayments(groupId, house.sharedTransactionIds, { source: 'manual' });
  for (const result of [...billPayments, ...shared])
    if (!result.ok) throw new Error(`Demo household: ${result.error}`);
  for (const expense of house.expenses)
    recordEvent(groupId, {
      kind: 'expense',
      date: expense.date,
      description: expense.description,
      amount: expense.amount,
      payerId: personIds[expense.payer],
      shares: personIds.map((personId) => ({ personId, value: 1 })),
    });
  // Settling up: each person pays the owner what they owe, less what they still owe after
  const { balances } = snapshot(groupId);
  personIds.forEach((personId, i) => {
    const amount = -(balances[personId] ?? 0) - (house.stillOwing[i] ?? 0);
    if (i === house.selfIndex || amount <= 0) return;
    recordEvent(groupId, {
      kind: 'settlement',
      date: house.settledOn,
      description: 'Settled up',
      amount,
      payerId: personId,
      recipientId: personIds[house.selfIndex],
    });
  });

  for (const plan of demo.payLater) {
    const account = createPlanAccount({ provider: plan.provider });
    createPayLater({ ...plan, accountId: account.account.id }, today);
  }
  for (const plan of demo.longTermPlans) createLongTermPlan(planSchema.parse(plan));
  for (const loan of demo.loanDetails) setLoanDetails(loan.accountId, loan.details);
}
