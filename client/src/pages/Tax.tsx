import { useEffect, useState } from 'react';
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
  type Receipt,
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
import { onTabListKeyDown } from '../components/ui/tabList';
import { AssetsTab, type AssetPrefill } from '../components/tax/Assets';
import { ASSET_LABELS, type AssetLabel } from '../api/assets';

// Tax time (docs/RECEIPTS-AND-TAX.md): a financial year's deductions by return label, with
// their receipts, and the inbox of receipts not yet matched to a transaction. Record keeping
// for an Australian return, not tax advice.

const TABS = [
  { id: 'deductions', label: 'Deductions' },
  { id: 'assets', label: 'Assets' },
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
          Record keeping, not tax advice.
        </p>
        <div
          data-guide="tax.tabs"
          className="scroll-row flex gap-1 mt-3 -mb-px"
          role="tablist"
          aria-label="Tax view"
          onKeyDown={onTabListKeyDown}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
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
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 max-md:px-4">
        {tab === 'inbox' ? <Inbox /> : tab === 'assets' ? <AssetsTab /> : <Deductions />}
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
        {year && (year.claims.length > 0 || year.assets.length > 0) && (
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
          {year.notes.map((n) => (
            <p
              key={n}
              role="note"
              className="rounded-md border border-caution p-3 text-sm text-caution"
            >
              {n}
            </p>
          ))}
          {year.claims.length === 0 && year.assets.length === 0 ? (
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
              {year.assets.length > 0 && <YearAssets assets={year.assets} />}
            </>
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

const ASSET_LABEL_SET = new Set<string>(ASSET_LABELS);

/** This year's decline in value of depreciating assets, alongside the claims */
function YearAssets({ assets }: { assets: TaxYearAsset[] }) {
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
