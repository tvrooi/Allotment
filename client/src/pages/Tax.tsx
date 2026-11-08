import { lazy, Suspense, useEffect, useState } from 'react';
import { GuideLink } from '../components/guide/GuideLink';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FolderOpen, Paperclip, Trash2 } from 'lucide-react';
import { StatCardRow } from '../components/reports/ChartHelpers';
import { ReceiptDrop, ReceiptThumb } from '../components/tax/ReceiptsSection';
import { Button } from '../components/ui/Button';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Input, Select } from '../components/ui/Input';
import {
  receiptFileUrl,
  taxYearArchiveUrl,
  taxYearCsvUrl,
  type CapitalGainsYear,
  type InvestmentIncomeYear,
  type Receipt,
  type TaxYear,
  type TaxYearAsset,
} from '../api/tax';
import {
  useDeleteReceipt,
  useReceiptMatches,
  useReceipts,
  useTaxYear,
  useTaxYears,
  useUpdateReceipt,
  useUploadReceipt,
} from '../hooks/useTax';
import { formatCurrency } from '../utils/currency';
import { formatDay } from '../utils/dates';
import { AssetsTab, type AssetPrefill } from '../components/tax/Assets';
import { ASSET_LABELS, fyName, lodgeYear, type AssetLabel } from '../api/assets';
import { useAssetMutation } from '../hooks/useAssets';
import { tabIds, TabList } from '../components/ui/tabList';
import { SavingPausedHint } from '../components/connection/SavingPausedHint';
import { useSetCarriedLosses } from '../hooks/useInvestments';
import { useCanSave } from '../hooks/useConnection';
import { formatUnits } from '../utils/units';
import { INCOME_KIND_LABEL, UNKNOWN_TEXT } from '../api/investments';

// Tax time (docs/RECEIPTS-AND-TAX.md): a financial year's deductions by return label, with
// their receipts, and the inbox of receipts not yet matched to a transaction. Record keeping
// for an Australian return, not tax advice.

const CarAndHome = lazy(() => import('../components/tax/CarAndHome'));

const TABS = [
  { id: 'deductions', label: 'Deductions' },
  { id: 'assets', label: 'Assets' },
  { id: 'car-home', label: 'Car and home' },
  { id: 'inbox', label: 'Receipt inbox' },
] as const;

export default function TaxPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'deductions';
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 pt-4 max-md:px-4 border-b border-border shrink-0">
        <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
          Tax time
        </h1>
        <p data-guide="tax.header" className="text-sm text-text-tertiary mt-0.5">
          Deductions you claim and the receipts that prove them, for your Australian tax return.
          Record keeping, not tax advice.{' '}
          <GuideLink page="tax" className="font-medium text-brand-600 hover:text-brand-700">
            How Tax time works
          </GuideLink>
        </p>
        <TabList
          label="Tax view"
          data-guide="tax.tabs"
          className="scroll-row flex gap-1 mt-3 -mb-px"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabIds('tax', t.id).tab}
              aria-controls={tabIds('tax', t.id).panel}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() =>
                setParams(t.id === 'deductions' ? {} : { tab: t.id }, { replace: true })
              }
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 max-md:min-h-11 ${
                tab === t.id
                  ? 'border-brand-600 text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </TabList>
      </div>
      <div
        role="tabpanel"
        id={tabIds('tax', tab).panel}
        aria-labelledby={tabIds('tax', tab).tab}
        className="flex-1 overflow-y-auto px-6 py-5 max-md:px-4"
      >
        {tab === 'inbox' ? (
          <Inbox />
        ) : tab === 'assets' ? (
          <AssetsTab />
        ) : tab === 'car-home' ? (
          <Suspense fallback={null}>
            <CarAndHome />
          </Suspense>
        ) : (
          <Deductions />
        )}
      </div>
    </div>
  );
}

function Deductions() {
  const { data: years = [] } = useTaxYears();
  const [fy, setFy] = useState<number | null>(null);
  useEffect(() => {
    if (fy === null && years.length) setFy(years[0].financialYear);
  }, [years, fy]);
  const { data: year } = useTaxYear(fy);

  return (
    <div className="space-y-5 max-w-5xl">
      <div data-guide="tax.year" className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-text-secondary space-y-1">
          <span className="block">Financial year (1 July to 30 June)</span>
          <Select
            aria-label="Financial year"
            value={fy ?? ''}
            onChange={(e) => setFy(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y.financialYear} value={y.financialYear}>
                {y.name}
              </option>
            ))}
          </Select>
        </label>
        {year &&
          (year.claims.length > 0 ||
            year.assets.length > 0 ||
            year.pool ||
            year.home.minutes > 0 ||
            year.capitalGains.sales.length > 0 ||
            year.investmentIncome.payments.length > 0) && (
            <div className="flex gap-2 ml-auto">
              <a href={taxYearCsvUrl(year.financialYear)} download>
                <Button variant="secondary">
                  <Download size={14} /> Deductions (CSV)
                </Button>
              </a>
              <a href={taxYearArchiveUrl(year.financialYear)} download>
                <Button variant="secondary">
                  <Download size={14} /> CSV and receipts (ZIP)
                </Button>
              </a>
            </div>
          )}
      </div>

      {year && (
        <>
          <StatCardRow
            cards={[
              { label: `Claimed in ${year.name}`, value: formatCurrency(year.total) },
              {
                label: 'Work-related (D2–D5)',
                value: formatCurrency(year.workRelatedTotal),
                sub: 'Over $300 needs written evidence',
              },
              {
                label: 'Without a receipt',
                value: String(year.missingReceipts),
                tone: year.missingReceipts ? 'negative' : undefined,
              },
            ]}
          />
          {year.amendments.length > 0 && <Amendments year={year} />}
          {year.notes
            // An amendment's note is the banner's text, shown above
            .filter((n) => !year.amendments.some((a) => a.note === n))
            .map((n) => (
              <p
                key={n}
                role="note"
                className="rounded-md border border-caution p-3 text-sm text-caution"
              >
                {n}
              </p>
            ))}
          {year.claims.length === 0 &&
          year.assets.length === 0 &&
          !year.pool &&
          year.home.claim === 0 ? (
            <p className="text-sm text-text-secondary">
              Nothing claimed in {year.name} yet. Open a transaction and tick{' '}
              <em>Claim as a tax deduction</em>, or make a rule that claims matching payments as
              they import.
            </p>
          ) : (
            <>
              <section aria-label="Totals by label">
                <table className="w-full text-sm max-w-xl">
                  <tbody>
                    {year.totals.map((t) => (
                      <tr key={t.label} className="border-b border-border-light">
                        <th scope="row" className="text-left py-1.5 font-normal">
                          <span className="font-medium">{t.label}</span> {t.name}
                          <span className="ml-2 text-xs text-text-tertiary">
                            {t.count} item{t.count === 1 ? '' : 's'}
                          </span>
                        </th>
                        <td className="text-right tabular-nums">{formatCurrency(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {year.claims.length > 0 && (
                <section aria-label="Claims" className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[44rem]">
                    <thead>
                      <tr className="text-left text-xs text-text-tertiary">
                        <th className="py-1.5 font-medium">Date</th>
                        <th className="font-medium">Payee</th>
                        <th className="font-medium">Label</th>
                        <th className="text-right font-medium">Cost</th>
                        <th className="text-right font-medium">Work use</th>
                        <th className="text-right font-medium">Claim</th>
                        <th className="font-medium pl-4">Receipts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {year.claims.map((c) => (
                        <tr
                          key={c.transactionId}
                          className="border-t border-border-light align-top"
                        >
                          <td className="py-2 whitespace-nowrap">{formatDay(c.date)}</td>
                          <td className="py-2">
                            {c.payeeName ?? '—'}
                            {(c.notes || c.categoryName) && (
                              <span className="block text-xs text-text-tertiary">
                                {c.notes ?? c.categoryName}
                              </span>
                            )}
                          </td>
                          <td className="py-2">{c.label}</td>
                          <td className="py-2 text-right tabular-nums">{formatCurrency(c.cost)}</td>
                          <td className="py-2 text-right tabular-nums">{c.workUseBps / 100}%</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(c.claim)}
                            {c.overImmediateLimit && (
                              <span className="block text-xs text-caution">
                                Over $300 ·{' '}
                                <Link
                                  to="/tax?tab=assets"
                                  state={{
                                    asset: {
                                      transactionId: c.transactionId,
                                      name: c.payeeName ?? 'Asset',
                                      cost: c.cost,
                                      date: c.date,
                                      claimed: true,
                                      label: (ASSET_LABEL_SET.has(c.label)
                                        ? c.label
                                        : 'D5') as AssetLabel,
                                      workUseBps: c.workUseBps,
                                    } satisfies AssetPrefill,
                                  }}
                                  className="underline hover:text-text"
                                >
                                  Depreciate instead
                                </Link>
                              </span>
                            )}
                          </td>
                          <td className="py-2 pl-4">
                            {c.receipts.length || c.files.length ? (
                              <>
                                {c.receipts.map((r) => (
                                  <a
                                    key={r.id}
                                    href={receiptFileUrl(r.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                                  >
                                    <Paperclip size={12} />
                                    <span className="truncate max-w-40">{r.fileName}</span>
                                  </a>
                                ))}
                                {c.files.map((f) => (
                                  <Link
                                    key={f.id}
                                    to={`/files?file=${encodeURIComponent(f.id)}`}
                                    className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                                  >
                                    <FolderOpen size={12} />
                                    <span className="truncate max-w-40">{f.fileName}</span>
                                  </Link>
                                ))}
                              </>
                            ) : (
                              <span className="text-xs text-negative">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {(year.assets.length > 0 || year.pool) && (
                <YearAssets assets={year.assets} pool={year.pool} />
              )}
            </>
          )}
          {(year.capitalGains.sales.length > 0 || year.capitalGains.lossesCarriedIn > 0) && (
            <CapitalGains year={year.capitalGains} financialYear={year.financialYear} />
          )}
          {year.investmentIncome.payments.length > 0 && (
            <InvestmentIncome year={year.investmentIncome} />
          )}
          <p className="text-xs text-text-tertiary">
            Keep receipts for five years from when you lodge. Amounts are in your budget's currency;
            a claim is the cost times its work-use share. Labels match the deductions section of
            myTax.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * A lodged year whose working-from-home claim moved since it was marked lodged: the server's
 * wording, and Mark lodged again to record the new figures once the ATO has an amendment.
 */
function Amendments({ year }: { year: TaxYear }) {
  const canSave = useCanSave();
  const lodge = useAssetMutation(lodgeYear);
  return (
    <section
      aria-label="Amended since lodging"
      className="rounded-md border border-caution p-3 space-y-2"
    >
      <h2 className="text-sm font-semibold text-caution">Amended since lodging</h2>
      <ul className="space-y-1 text-sm text-caution">
        {year.amendments.map((a) => (
          <li key={a.part}>{a.note}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canSave || lodge.isPending}
          onClick={() => lodge.mutate(year.financialYear)}
        >
          Mark lodged again
        </Button>
        <SavingPausedHint />
      </div>
    </section>
  );
}

const ASSET_LABEL_SET = new Set<string>(ASSET_LABELS);

const signedCurrency = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`;

/** Item 18 from the year's investment sales, and the losses carried in from before Allotment */
function CapitalGains({ year, financialYear }: { year: CapitalGainsYear; financialYear: number }) {
  const rows: [string, number][] = [
    ['18H Total current year capital gains', year.totalGains],
    ['Capital losses this year', year.currentLosses],
    ['Net capital losses from earlier years', year.lossesCarriedIn],
    ['Losses used', year.lossesApplied],
    ['CGT discount (50%)', year.discount],
    ['18A Net capital gain', year.netGain],
    ['18V Net capital losses carried forward', year.lossesCarriedForward],
  ];
  return (
    <section aria-labelledby="capital-gains-heading" className="space-y-3">
      <h2 id="capital-gains-heading" className="text-sm font-semibold text-text">
        Capital gains (item 18)
      </h2>
      {year.notes.map((n) => (
        <p
          key={n}
          role="note"
          className="rounded-md border border-caution p-3 text-sm text-caution"
        >
          {n}
        </p>
      ))}
      <table className="w-full text-sm max-w-xl">
        <tbody>
          {rows.map(([label, amount]) => (
            <tr key={label} className="border-b border-border-light">
              <th scope="row" className="text-left py-1.5 font-normal">
                {label}
              </th>
              <td className="text-right tabular-nums">{formatCurrency(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {year.sales.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[44rem]">
            <thead>
              <tr className="text-left text-xs text-text-tertiary">
                <th className="py-1.5 font-medium">Sold on</th>
                <th className="font-medium">Security</th>
                <th className="text-right font-medium">Units</th>
                <th className="text-right font-medium">Proceeds</th>
                <th className="text-right font-medium">Cost</th>
                <th className="text-right font-medium">Gain</th>
                <th className="font-medium pl-4">Discount</th>
              </tr>
            </thead>
            <tbody>
              {year.sales.map((s) => (
                <tr key={s.id} className="border-t border-border-light align-top">
                  <td className="py-2 whitespace-nowrap">{formatDay(s.soldOn)}</td>
                  <td className="py-2">
                    <Link to="/investments" className="text-brand-600 hover:text-brand-700">
                      {s.symbol}
                    </Link>
                    <span className="block text-xs text-text-tertiary">{s.accountName}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatUnits(s.quantity)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {s.proceeds === null ? '—' : formatCurrency(s.proceeds)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {s.cost === null ? '—' : formatCurrency(s.cost)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {s.gain === null ? (
                      <span className="text-xs text-negative">
                        {s.unknown ? UNKNOWN_TEXT[s.unknown] : 'Not known'}
                      </span>
                    ) : (
                      signedCurrency(s.gain)
                    )}
                  </td>
                  <td className="py-2 pl-4">
                    {s.gain === null || s.gain <= 0
                      ? '—'
                      : s.discount === 'all'
                        ? 'Yes'
                        : s.discount === 'some'
                          ? 'Part'
                          : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CarriedInLosses current={year.carriedInFromBefore} financialYear={financialYear} />
    </section>
  );
}

/** Dividends (item 11), distributions and interest (item 10) from the year's payments */
function InvestmentIncome({ year }: { year: InvestmentIncomeYear }) {
  const rows: [string, number][] = [
    ['11S Unfranked amount', year.dividends.unfranked],
    ['11T Franked amount', year.dividends.franked],
    ['11U Franking credit', year.dividends.frankingCredit],
    ['11V TFN amounts withheld', year.dividends.withheld],
  ];
  if (year.interest.count)
    rows.push(
      ['10L Gross interest', year.interest.gross],
      ['10M TFN amounts withheld from interest', year.interest.withheld],
    );
  if (year.distributions.count)
    rows.push(
      ['Distributions paid (use the fund statement)', year.distributions.amount],
      ['Distributions: franking credits', year.distributions.frankingCredit],
    );
  const money = (n: number | null) => (n === null ? '—' : formatCurrency(n));
  return (
    <section aria-labelledby="investment-income-heading" className="space-y-3">
      <h2 id="investment-income-heading" className="text-sm font-semibold text-text">
        Dividends and interest (items 10 and 11)
      </h2>
      {year.notes.map((n) => (
        <p
          key={n}
          role="note"
          className="rounded-md border border-caution p-3 text-sm text-caution"
        >
          {n}
        </p>
      ))}
      <table className="w-full text-sm max-w-xl">
        <tbody>
          {rows.map(([label, amount]) => (
            <tr key={label} className="border-b border-border-light">
              <th scope="row" className="text-left py-1.5 font-normal">
                {label}
              </th>
              <td className="text-right tabular-nums">{formatCurrency(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[44rem]">
          <thead>
            <tr className="text-left text-xs text-text-tertiary">
              <th className="py-1.5 font-medium">Paid on</th>
              <th className="font-medium">Security</th>
              <th className="font-medium">Kind</th>
              <th className="text-right font-medium">Paid</th>
              <th className="text-right font-medium">Franked</th>
              <th className="text-right font-medium">Credit</th>
              <th className="text-right font-medium">Withheld</th>
            </tr>
          </thead>
          <tbody>
            {year.payments.map((p) => (
              <tr key={p.id} className="border-t border-border-light align-top">
                <td className="py-2 whitespace-nowrap">{formatDay(p.paidOn)}</td>
                <td className="py-2">
                  <Link to="/investments" className="text-brand-600 hover:text-brand-700">
                    {p.symbol}
                  </Link>
                  <span className="block text-xs text-text-tertiary">{p.accountName}</span>
                  {p.holdingPeriodConcern && (
                    <span className="block text-xs text-caution">Check the 45-day rule</span>
                  )}
                </td>
                <td className="py-2">{INCOME_KIND_LABEL[p.kind]}</td>
                <td className="py-2 text-right tabular-nums">{money(p.converted.amount)}</td>
                <td className="py-2 text-right tabular-nums">{money(p.converted.franked)}</td>
                <td className="py-2 text-right tabular-nums">
                  {money(p.converted.frankingCredit)}
                </td>
                <td className="py-2 text-right tabular-nums">{money(p.converted.withheld)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Net capital losses from years before Allotment's records, entered once */
function CarriedInLosses({
  current,
  financialYear,
}: {
  current: CapitalGainsYear['carriedInFromBefore'];
  financialYear: number;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(current?.amount ?? 0);
  const save = useSetCarriedLosses();
  const canSave = useCanSave();
  const into = current?.financialYear ?? financialYear;
  const submit = (value: number) =>
    save.mutate({ financialYear: into, amount: value }, { onSuccess: () => setEditing(false) });
  return (
    <div className="text-sm text-text-secondary space-y-2">
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(amount);
          }}
        >
          <label className="space-y-1">
            <span className="block text-xs font-medium">
              Net capital losses carried into {fyName(into)} from before Allotment
            </span>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              aria-label="Net capital losses from before Allotment"
            />
          </label>
          <Button type="submit" disabled={save.isPending || !canSave}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <p>
          {current
            ? `Net capital losses from before Allotment: ${formatCurrency(current.amount)}, carried into ${fyName(current.financialYear)}.`
            : 'Net capital losses from years before you used Allotment can be carried in.'}{' '}
          <button
            type="button"
            className="font-medium text-brand-600 hover:text-brand-700"
            onClick={() => {
              setAmount(current?.amount ?? 0);
              setEditing(true);
            }}
          >
            {current ? 'Change' : 'Add them'}
          </button>
          {current && (
            <>
              {' · '}
              <button
                type="button"
                className="font-medium text-brand-600 hover:text-brand-700"
                onClick={() => submit(0)}
              >
                Remove
              </button>
            </>
          )}
        </p>
      )}
      <SavingPausedHint />
      {save.error && (
        <p role="alert" className="text-sm text-negative">
          {(save.error as Error).message}
        </p>
      )}
    </div>
  );
}

/** This year's decline in value of depreciating assets, alongside the claims */
function YearAssets({ assets, pool }: { assets: TaxYearAsset[]; pool: TaxYear['pool'] }) {
  return (
    <section aria-label="Decline in value" className="overflow-x-auto">
      <h2 className="text-sm font-semibold text-text mb-1">Decline in value</h2>
      <table className="w-full text-sm min-w-[44rem]">
        <thead>
          <tr className="text-left text-xs text-text-tertiary">
            <th className="py-1.5 font-medium">Asset</th>
            <th className="font-medium">Label</th>
            <th className="text-right font-medium">Decline</th>
            <th className="text-right font-medium">Work use</th>
            <th className="text-right font-medium">Deduction</th>
            <th className="font-medium pl-4">Records</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.assetId} className="border-t border-border-light align-top">
              <td className="py-2">
                <Link
                  to={`/tax?tab=assets&asset=${encodeURIComponent(a.assetId)}`}
                  className="text-brand-600 hover:text-brand-700"
                >
                  {a.name}
                </Link>
                {a.disposedDate && (
                  <span className="block text-xs text-text-tertiary">
                    Disposed {formatDay(a.disposedDate)}
                    {a.row.balancingAdjustment !== undefined &&
                      ` · balancing adjustment ${formatCurrency(a.row.balancingAdjustment)}`}
                  </span>
                )}
              </td>
              <td className="py-2">{a.label}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(a.row.decline)}</td>
              <td className="py-2 text-right tabular-nums">{a.row.workUseBps / 100}%</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(a.deduction)}</td>
              <td className="py-2 pl-4">
                {a.receipts.length || a.files.length ? (
                  `${a.receipts.length + a.files.length} file${a.receipts.length + a.files.length === 1 ? '' : 's'}`
                ) : (
                  <span className="text-xs text-negative">None</span>
                )}
              </td>
            </tr>
          ))}
          {pool && (
            <tr className="border-t border-border-light align-top">
              <td className="py-2">
                <Link to="/tax?tab=assets" className="text-brand-600 hover:text-brand-700">
                  Low-value pool
                </Link>
                <span className="block text-xs text-text-tertiary">
                  {pool.assets.map((a) => a.name).join(', ')}
                </span>
              </td>
              <td className="py-2">D6</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(pool.row.decline)}</td>
              <td className="py-2 text-right tabular-nums">—</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(pool.row.decline)}</td>
              <td className="py-2 pl-4" />
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function Inbox() {
  const { data: receipts = [] } = useReceipts({ inbox: true });
  const upload = useUploadReceipt();
  const [error, setError] = useState<string | null>(null);
  async function add(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        await upload.mutateAsync({ file });
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-text-secondary">
        Add receipts here as you get them, then match each one to its transaction when it arrives
        from your bank. Typing the total and date makes the suggestions exact.
      </p>
      <ReceiptDrop onFiles={add} busy={upload.isPending} label="Add receipts to the inbox" />
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      {receipts.length === 0 ? (
        <p className="text-sm text-text-tertiary">The inbox is empty.</p>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <InboxItem key={r.id} receipt={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxItem({ receipt }: { receipt: Receipt }) {
  const update = useUpdateReceipt();
  const remove = useDeleteReceipt();
  const { data: matches = [] } = useReceiptMatches(receipt.id);
  const [merchant, setMerchant] = useState(receipt.merchant ?? '');
  const save = (change: Parameters<typeof update.mutate>[0]['change']) =>
    update.mutate({ id: receipt.id, change });
  return (
    <li
      className="rounded-md border border-border-light p-3 flex gap-3 max-sm:flex-col"
      aria-label={`Receipt ${receipt.fileName}`}
    >
      <ReceiptThumb receipt={receipt} size={88} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate flex-1">{receipt.fileName}</span>
          <button
            type="button"
            onClick={() => remove.mutate(receipt.id)}
            className="p-1 rounded text-text-tertiary hover:text-negative"
            aria-label={`Delete receipt ${receipt.fileName}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            aria-label="Merchant"
            placeholder="Merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            onBlur={() =>
              (merchant || null) !== receipt.merchant && save({ merchant: merchant || null })
            }
          />
          <Input
            aria-label="Receipt date"
            type="date"
            value={receipt.receiptDate ?? ''}
            onChange={(e) => save({ receiptDate: e.target.value || null })}
          />
          <CurrencyInput
            aria-label="Receipt total"
            value={receipt.total ?? 0}
            onChange={(total) => total !== (receipt.total ?? 0) && save({ total: total || null })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-text-tertiary">
            {matches.length
              ? 'Likely transactions'
              : 'No transaction within 10 days looks like it yet.'}
          </p>
          {matches.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate">
                {formatDay(m.date)} · {m.payeeName ?? '—'} · {m.accountName}
                {m.exactAmount && <span className="ml-1 text-xs text-positive">same total</span>}
              </span>
              <span className="tabular-nums">{formatCurrency(-m.amount)}</span>
              <Button size="sm" variant="secondary" onClick={() => save({ transactionId: m.id })}>
                Attach
              </Button>
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}
