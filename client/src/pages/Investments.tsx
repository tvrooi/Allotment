import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickChart, ChevronDown, Plus } from 'lucide-react';
import {
  useInvestments,
  useDeleteHolding,
  useDeleteSecurity,
  useRefreshInvestments,
} from '../hooks/useInvestments';
import { useAccounts } from '../hooks/useAccounts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import RowMenu from '../components/ui/RowMenu';
import { type StatCard } from '../components/reports/ChartHelpers';
import { UpdateValueModal } from '../components/accounts/UpdateValueModal';
import {
  HoldingModal,
  KIND_LABEL,
  LotsModal,
  PriceModal,
  SecurityModal,
  basisSummary,
} from '../components/investments/InvestmentModals';
import { SalesModal, SellModal } from '../components/investments/SaleModals';
import { IncomeListModal, IncomeModal } from '../components/investments/IncomeModals';
import { SplitModal } from '../components/investments/SplitModals';
import { GuideLink } from '../components/guide/GuideLink';
import type {
  Holding,
  Income,
  InvestmentAccount,
  Sale,
  Security,
  SecuritySummary,
} from '../api/investments';
import { formatMoney } from '../utils/currency';
import { PrivateSection } from '../components/ui/Private';
import { formatDay } from '../utils/dates';
import { formatUnits } from '../utils/units';
import { accountTypeLabel } from '../utils/accountTypes';

// P3 investments (docs/INVESTMENTS.md): manual positions valued with prices the user enters.
// Holdings never change an account's balance; recording their value is an explicit step that
// goes through the account's usual Update Value adjustment.

type Dialog =
  | { kind: 'security'; security?: SecuritySummary; then?: { accountId?: string } }
  | { kind: 'price'; security: Security }
  | { kind: 'holding'; holding?: Holding; accountId?: string; securityId?: string }
  | { kind: 'lots'; holdingId: string }
  | { kind: 'sell'; holdingId: string; sale?: Sale }
  | { kind: 'sales'; holdingId: string }
  | { kind: 'income'; holdingId: string; income?: Income }
  | { kind: 'income-list'; holdingId: string }
  | { kind: 'split'; holdingId: string }
  | { kind: 'record'; accountId: string; value: number }
  | { kind: 'remove-holding'; holding: Holding }
  | { kind: 'remove-security'; security: SecuritySummary };

function signed(amount: number, currency: string | null) {
  return `${amount > 0 ? '+' : ''}${formatMoney(amount, currency)}`;
}

const holdingsCount = (n: number) => (n === 1 ? '1 holding' : `${n} holdings`);

const toneOf = (n: number | null) =>
  n === null || n === 0 ? 'text-text' : n > 0 ? 'text-positive' : 'text-negative';

function holdingMenuItems(holding: Holding, onDialog: (d: Dialog) => void) {
  return [
    {
      label: 'Update price',
      onClick: () => onDialog({ kind: 'price', security: holding.security }),
    },
    {
      label: 'Purchases and cost',
      onClick: () => onDialog({ kind: 'lots', holdingId: holding.id }),
    },
    {
      label: 'Sell',
      hidden: holding.quantity === 0,
      onClick: () => onDialog({ kind: 'sell', holdingId: holding.id }),
    },
    {
      label: `Sales (${holding.sales.length})`,
      hidden: !holding.sales.length,
      onClick: () => onDialog({ kind: 'sales', holdingId: holding.id }),
    },
    {
      label: 'Record a payment',
      onClick: () => onDialog({ kind: 'income', holdingId: holding.id }),
    },
    {
      label: `Income (${holding.income.length})`,
      hidden: !holding.income.length,
      onClick: () => onDialog({ kind: 'income-list', holdingId: holding.id }),
    },
    {
      label: 'Split or consolidate',
      onClick: () => onDialog({ kind: 'split', holdingId: holding.id }),
    },
    { label: 'Edit units', onClick: () => onDialog({ kind: 'holding', holding }) },
    {
      label: 'Remove holding',
      danger: true,
      // Its sales and income are the record for Tax time: it stays (under Sold once empty)
      hidden: holding.sales.length > 0 || holding.income.length > 0,
      onClick: () => onDialog({ kind: 'remove-holding', holding }),
    },
  ];
}

function HoldingRow({ holding, onDialog }: { holding: Holding; onDialog: (d: Dialog) => void }) {
  const currency = holding.security.currency;
  return (
    <tr className="border-t border-border-light align-top">
      <td className="py-3 pr-3">
        <p className="font-medium text-text">{holding.security.symbol}</p>
        <p className="text-xs text-text-tertiary">
          {holding.security.name} · {KIND_LABEL[holding.security.kind]}
        </p>
      </td>
      <td className="py-3 px-3 text-right tabular-nums text-text">
        {formatUnits(holding.quantity)}
      </td>
      <td className="py-3 px-3 text-right">
        {holding.price === null ? (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline"
            onClick={() => onDialog({ kind: 'price', security: holding.security })}
          >
            Add a price
          </button>
        ) : (
          <>
            <p className="tabular-nums text-text">{formatMoney(holding.price, currency)}</p>
            <p className={`text-xs ${holding.priceStale ? 'text-caution' : 'text-text-tertiary'}`}>
              {holding.priceStale ? 'Stale · ' : ''}
              {formatDay(holding.priceDate!)}
            </p>
          </>
        )}
      </td>
      <td className="py-3 px-3 text-right tabular-nums font-medium text-text">
        {holding.value === null ? (
          <span className="text-text-tertiary font-normal">No price</span>
        ) : (
          formatMoney(holding.value, currency)
        )}
      </td>
      <td className="py-3 px-3 text-right">
        {holding.costBasis !== null ? (
          <span className="tabular-nums text-text">{formatMoney(holding.costBasis, currency)}</span>
        ) : (
          <button
            type="button"
            className="text-xs text-text-tertiary hover:text-brand-600 hover:underline text-right"
            onClick={() => onDialog({ kind: 'lots', holdingId: holding.id })}
            title={basisSummary(holding)}
          >
            {holding.basisStatus === 'mismatch'
              ? "Lots don't match"
              : holding.basisStatus === 'partial'
                ? 'Partly known'
                : 'Unknown'}
          </button>
        )}
      </td>
      <td className={`py-3 px-3 text-right tabular-nums ${toneOf(holding.unrealizedGain)}`}>
        {holding.unrealizedGain === null ? (
          <span className="text-text-tertiary">—</span>
        ) : (
          <>
            <p>{signed(holding.unrealizedGain, currency)}</p>
            {holding.gainPercent !== null && (
              <p className="text-xs">
                {holding.gainPercent > 0 ? '+' : ''}
                {holding.gainPercent.toFixed(2)}%
              </p>
            )}
          </>
        )}
      </td>
      <td className="py-3 pl-1 text-right">
        <RowMenu
          label={`Actions for ${holding.security.symbol}`}
          items={holdingMenuItems(holding, onDialog)}
        />
      </td>
    </tr>
  );
}

// Phones get a stacked card per holding: the table's six columns would scroll sideways
function HoldingCard({ holding, onDialog }: { holding: Holding; onDialog: (d: Dialog) => void }) {
  const currency = holding.security.currency;
  return (
    <li className="py-3 flex items-start justify-between gap-2 border-t border-border-light">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-text">{holding.security.symbol}</p>
          <p className="font-medium tabular-nums text-text">
            {holding.value === null ? (
              <span className="text-text-tertiary font-normal">No price</span>
            ) : (
              formatMoney(holding.value, currency)
            )}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-text-tertiary truncate">{holding.security.name}</p>
          {holding.unrealizedGain !== null && (
            <p
              className={`shrink-0 whitespace-nowrap text-xs tabular-nums ${toneOf(holding.unrealizedGain)}`}
            >
              {signed(holding.unrealizedGain, currency)}
              {holding.gainPercent !== null &&
                ` (${holding.gainPercent > 0 ? '+' : ''}${holding.gainPercent.toFixed(2)}%)`}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs text-text-tertiary tabular-nums">
          {formatUnits(holding.quantity)} units
          {' · '}
          {holding.price === null ? (
            <button
              type="button"
              className="text-brand-600 hover:underline"
              onClick={() => onDialog({ kind: 'price', security: holding.security })}
            >
              Add a price
            </button>
          ) : (
            <span className={holding.priceStale ? 'text-caution' : undefined}>
              {formatMoney(holding.price, currency)} on {formatDay(holding.priceDate!)}
              {holding.priceStale ? ' (stale)' : ''}
            </span>
          )}
          {' · '}
          {holding.costBasis !== null ? (
            `cost ${formatMoney(holding.costBasis, currency)}`
          ) : (
            <button
              type="button"
              className="hover:text-brand-600 hover:underline"
              onClick={() => onDialog({ kind: 'lots', holdingId: holding.id })}
            >
              cost {holding.basisStatus === 'partial' ? 'partly known' : 'unknown'}
            </button>
          )}
        </p>
      </div>
      <RowMenu
        label={`Actions for ${holding.security.symbol}`}
        items={holdingMenuItems(holding, onDialog)}
      />
    </li>
  );
}

function HoldingsTable({
  holdings,
  onDialog,
  inset = false,
}: {
  holdings: Holding[];
  onDialog: (d: Dialog) => void;
  /** Inside the Sold list, which has its own padding */
  inset?: boolean;
}) {
  return (
    <>
      <ul className={`md:hidden ${inset ? '' : 'px-5 pb-2'}`}>
        {holdings.map((h) => (
          <HoldingCard key={h.id} holding={h} onDialog={onDialog} />
        ))}
      </ul>
      <HoldingsTableDesktop holdings={holdings} onDialog={onDialog} inset={inset} />
    </>
  );
}

function HoldingsTableDesktop({
  holdings,
  onDialog,
  inset,
}: {
  holdings: Holding[];
  onDialog: (d: Dialog) => void;
  inset: boolean;
}) {
  return (
    <div className={`overflow-x-auto max-md:hidden ${inset ? '' : 'px-5 pb-2'}`}>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-xs text-text-tertiary">
            <th className="text-left font-medium py-2 pr-3">Security</th>
            <th className="text-right font-medium py-2 px-3">Units</th>
            <th className="text-right font-medium py-2 px-3">Price</th>
            <th className="text-right font-medium py-2 px-3">Value</th>
            <th className="text-right font-medium py-2 px-3">Cost basis</th>
            <th className="text-right font-medium py-2 px-3">Unrealized gain</th>
            <th className="w-8" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <HoldingRow key={h.id} holding={h} onDialog={onDialog} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE_TEXT = { positive: 'text-positive', negative: 'text-negative' } as const;

function SummaryStrip({
  cards,
  recorded,
  budget,
}: {
  cards: StatCard[];
  recorded: number | null;
  budget: string | null;
}) {
  const [priced, ...rest] = cards;
  return (
    <section aria-label="Summary" className="rounded-xl bg-surface-alt border border-border-light">
      {recorded !== null && (
        <p className="px-5 pt-4 text-sm text-text-secondary">
          Priced holdings come to{' '}
          <span className="font-semibold tabular-nums text-text">{priced.value}</span> of the{' '}
          <span className="font-semibold tabular-nums text-text">
            {formatMoney(recorded, budget)}
          </span>{' '}
          recorded across your investment accounts.{priced.sub ? ` ${priced.sub}.` : ''}
        </p>
      )}
      <dl className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-8 gap-y-3 px-5 py-4">
        {(recorded !== null ? rest : [priced, ...rest]).map((c) => (
          <div
            key={c.label}
            className="flex md:block items-baseline justify-between gap-3 max-md:flex-wrap"
          >
            <dt className="text-xs text-text-tertiary">{c.label}</dt>
            <dd
              className={`text-lg font-semibold tabular-nums md:mt-0.5 ${c.tone ? TONE_TEXT[c.tone as 'positive' | 'negative'] : 'text-text'}`}
            >
              {c.value}
            </dd>
            {c.sub && <p className="text-xs text-text-tertiary max-md:basis-full">{c.sub}</p>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function AccountCard({
  account,
  onDialog,
}: {
  account: InvestmentAccount;
  onDialog: (d: Dialog) => void;
}) {
  const { currency } = account;
  // Every unit sold: kept for its sales, out of the way
  const held = account.holdings.filter((h) => h.quantity > 0 || !h.sales.length);
  const sold = account.holdings.filter((h) => h.quantity === 0 && h.sales.length > 0);
  if (!account.holdings.length) {
    // Nothing to tabulate: one row instead of a card of empty space
    return (
      <Card padding="none">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <Link to={`/accounts/${account.id}`} className="font-medium text-text hover:underline">
              {account.name}
            </Link>
            <p className="text-xs text-text-tertiary">
              {accountTypeLabel(account.type)} · Recorded balance{' '}
              {formatMoney(account.recordedBalance, currency)} · No holdings recorded
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDialog({ kind: 'holding', accountId: account.id })}
          >
            <Plus size={14} /> Add holding
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/accounts/${account.id}`} className="font-medium text-text hover:underline">
            {account.name}
          </Link>
          <p className="text-xs text-text-tertiary">{accountTypeLabel(account.type)}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-text-secondary">
            Holdings{' '}
            <span className="font-semibold tabular-nums text-text">
              {account.holdingsValue === null ? '—' : formatMoney(account.holdingsValue, currency)}
            </span>
          </p>
          <p className="text-xs text-text-tertiary">
            Recorded balance {formatMoney(account.recordedBalance, currency)}
          </p>
        </div>
      </div>
      {account.difference !== null && account.difference !== 0 && (
        <div className="mx-5 mb-4 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-text flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0 flex-1 basis-64">
            The holdings are worth {formatMoney(Math.abs(account.difference), currency)}{' '}
            {account.difference > 0 ? 'more' : 'less'} than the recorded balance. The balance only
            changes if you record it.
          </span>
          <Button
            size="sm"
            onClick={() =>
              onDialog({ kind: 'record', accountId: account.id, value: account.holdingsValue! })
            }
          >
            Record as value
          </Button>
        </div>
      )}
      {account.holdings.length > 0 && account.holdingsValue === null && (
        <p className="mx-5 mb-3 text-xs text-caution">
          Some holdings have no price or no exchange rate, so the account's holdings total isn't
          shown.
        </p>
      )}
      {held.length ? (
        <HoldingsTable holdings={held} onDialog={onDialog} />
      ) : (
        <p className="px-5 pb-4 text-sm text-text-tertiary">
          {sold.length ? 'Nothing held now.' : 'No holdings recorded.'}
        </p>
      )}
      {sold.length > 0 && (
        <details className="px-5 pb-2">
          <summary className="cursor-pointer py-2 text-sm text-text-secondary">
            Sold ({sold.length})
          </summary>
          <HoldingsTable holdings={sold} onDialog={onDialog} inset />
        </details>
      )}
      <div className="px-5 py-3 border-t border-border-light">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDialog({ kind: 'holding', accountId: account.id })}
        >
          <Plus size={14} /> Add holding
        </Button>
      </div>
    </Card>
  );
}

export default function InvestmentsPage() {
  const { data, isLoading, error } = useInvestments();
  const { data: allAccounts = [] } = useAccounts();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [securitiesOpen, setSecuritiesOpen] = useState(false);
  const removeHolding = useDeleteHolding();
  const removeSecurity = useDeleteSecurity();
  const refresh = useRefreshInvestments();
  const close = () => setDialog(null);

  const budget = data?.budgetCurrency ?? null;
  const totals = data?.totals;
  const cards: StatCard[] = totals
    ? [
        {
          label: 'Priced holdings',
          value: formatMoney(totals.value, budget),
          sub: totals.unvalued
            ? `${holdingsCount(totals.unvalued)} without a price or rate left out`
            : `As of ${formatDay(data.asOf)}`,
        },
        {
          label: 'Known cost basis',
          value: formatMoney(totals.costBasis, budget),
          sub: totals.withoutBasis ? `${holdingsCount(totals.withoutBasis)} left out` : undefined,
        },
        {
          label: 'Unrealized gain',
          value: signed(totals.unrealizedGain, budget),
          tone:
            totals.unrealizedGain > 0
              ? 'positive'
              : totals.unrealizedGain < 0
                ? 'negative'
                : undefined,
          sub: 'Before tax; only holdings with every cost known',
        },
      ]
    : [];

  // Accounts with something to look at lead; empty ones follow as one-line rows
  const accountsInOrder = [...(data?.accounts ?? [])].sort(
    (a, b) => Number(!a.holdings.length) - Number(!b.holdings.length),
  );
  // A single total only means something when every balance is in the budget's currency
  const recordedTotal =
    data && data.accounts.every((a) => a.currency === budget)
      ? data.accounts.reduce((sum, a) => sum + a.recordedBalance, 0)
      : null;

  const holdingFor = (id: string) =>
    data?.accounts.flatMap((a) => a.holdings).find((h) => h.id === id) ?? null;
  const lotsHolding = dialog?.kind === 'lots' ? holdingFor(dialog.holdingId) : null;
  const sellHolding = dialog?.kind === 'sell' ? holdingFor(dialog.holdingId) : null;
  const salesHolding = dialog?.kind === 'sales' ? holdingFor(dialog.holdingId) : null;
  const splitHolding = dialog?.kind === 'split' ? holdingFor(dialog.holdingId) : null;
  const incomeHolding =
    dialog?.kind === 'income' || dialog?.kind === 'income-list'
      ? holdingFor(dialog.holdingId)
      : null;
  const recordAccount =
    dialog?.kind === 'record' ? allAccounts.find((a) => a.id === dialog.accountId) : undefined;

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="border-b border-border shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 max-md:px-4 flex flex-wrap items-center justify-between gap-3">
          <div data-guide="investments.header" className="min-w-0">
            <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
              Investments
            </h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              Holdings you record and price yourself. Balances stay as they are until you record a
              value.{' '}
              <GuideLink
                page="investments"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                How investments work
              </GuideLink>
            </p>
          </div>
          {!!data?.accounts.length && (
            <Button onClick={() => setDialog({ kind: 'holding' })} data-guide="investments.add">
              <Plus size={16} /> Add holding
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 max-md:px-4 space-y-6">
          <PrivateSection title="Investments are hidden in Safe mode">
            {isLoading ? (
              <div className="h-24 bg-surface-alt rounded-lg animate-pulse" />
            ) : error ? (
              <p role="alert" className="text-sm text-negative">
                {(error as Error).message}
              </p>
            ) : !data?.accounts.length ? (
              <EmptyState
                icon={<CandlestickChart size={24} />}
                title="No investment accounts yet"
                description="Add an investment, retirement or crypto account, then record what it holds here."
                actions={
                  <Link to="/accounts">
                    <Button>Go to accounts</Button>
                  </Link>
                }
              />
            ) : (
              <>
                <SummaryStrip cards={cards} recorded={recordedTotal} budget={budget} />
                <div className="space-y-4">
                  {accountsInOrder.map((a) => (
                    <AccountCard key={a.id} account={a} onDialog={setDialog} />
                  ))}
                </div>

                <section aria-labelledby="securities-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="securities-heading" className="text-sm font-semibold text-text">
                      <button
                        type="button"
                        aria-expanded={securitiesOpen}
                        aria-controls="securities-list"
                        onClick={() => setSecuritiesOpen((o) => !o)}
                        className="inline-flex items-center gap-1.5 py-1.5 hover:text-brand-700"
                      >
                        <ChevronDown
                          size={16}
                          aria-hidden
                          className={`transition-transform ${securitiesOpen ? '' : '-rotate-90'}`}
                        />
                        Securities ({data.securities.length})
                      </button>
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDialog({ kind: 'security' })}
                    >
                      <Plus size={14} /> Add security
                    </Button>
                  </div>
                  <div id="securities-list" hidden={!securitiesOpen} className="mt-2">
                    {data.securities.length ? (
                      <Card padding="none">
                        <ul className="divide-y divide-border-light">
                          {data.securities.map((s) => (
                            <li
                              key={s.id}
                              className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-text">
                                  {s.symbol}{' '}
                                  <span className="text-text-tertiary font-normal">
                                    {s.name} · {KIND_LABEL[s.kind]} · {s.currency}
                                  </span>
                                </p>
                                <p className="text-xs text-text-tertiary">
                                  {s.latestPrice === null
                                    ? 'No price entered'
                                    : `${formatMoney(s.latestPrice, s.currency)} on ${formatDay(s.latestPriceDate!)}`}
                                  {' · '}
                                  {s.holdingCount === 1
                                    ? '1 holding'
                                    : `${s.holdingCount} holdings`}
                                </p>
                              </div>
                              <RowMenu
                                label={`Actions for ${s.symbol}`}
                                items={[
                                  {
                                    label: 'Update price',
                                    onClick: () => setDialog({ kind: 'price', security: s }),
                                  },
                                  {
                                    label: 'Edit',
                                    onClick: () => setDialog({ kind: 'security', security: s }),
                                  },
                                  {
                                    label: 'Delete',
                                    danger: true,
                                    hidden: s.holdingCount > 0,
                                    onClick: () =>
                                      setDialog({ kind: 'remove-security', security: s }),
                                  },
                                ]}
                              />
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : (
                      <p className="text-sm text-text-tertiary">
                        Add the shares, funds or coins you hold, then record holdings of them.
                      </p>
                    )}
                  </div>
                </section>

                <p className="text-xs text-text-tertiary">
                  Values use the latest price you entered on or before today, converted at the
                  latest exchange rate. Gains are unrealized and before tax. Sales' capital gains,
                  dividends, distributions and interest are on Tax time; fees outside a lot's cost
                  and time-weighted returns aren't calculated.
                </p>
              </>
            )}
          </PrivateSection>
        </div>
      </div>

      {dialog?.kind === 'security' && (
        <SecurityModal
          security={dialog.security}
          defaultCurrency={budget}
          onClose={() => (dialog.then ? setDialog({ kind: 'holding', ...dialog.then }) : close())}
          onCreated={(created) =>
            dialog.then
              ? setDialog({ kind: 'holding', ...dialog.then, securityId: created.id })
              : close()
          }
        />
      )}
      {dialog?.kind === 'price' && <PriceModal security={dialog.security} onClose={close} />}
      {dialog?.kind === 'holding' && data && (
        <HoldingModal
          holding={dialog.holding}
          accountId={dialog.accountId}
          accounts={data.accounts}
          securities={data.securities}
          onClose={close}
          securityId={dialog.securityId}
          onAddSecurity={() =>
            setDialog({ kind: 'security', then: { accountId: dialog.accountId } })
          }
        />
      )}
      {lotsHolding && <LotsModal holding={lotsHolding} onClose={close} />}
      {splitHolding && <SplitModal holding={splitHolding} onClose={close} />}
      {sellHolding && dialog?.kind === 'sell' && (
        <SellModal
          holding={sellHolding}
          sale={dialog.sale}
          budgetCurrency={budget}
          onClose={() =>
            dialog.sale ? setDialog({ kind: 'sales', holdingId: sellHolding.id }) : close()
          }
        />
      )}
      {incomeHolding && dialog?.kind === 'income' && (
        <IncomeModal
          holding={incomeHolding}
          income={dialog.income}
          onClose={() =>
            dialog.income
              ? setDialog({ kind: 'income-list', holdingId: incomeHolding.id })
              : close()
          }
        />
      )}
      {incomeHolding && dialog?.kind === 'income-list' && (
        <IncomeListModal
          holding={incomeHolding}
          onEdit={(income) => setDialog({ kind: 'income', holdingId: incomeHolding.id, income })}
          onClose={close}
        />
      )}
      {salesHolding && (
        <SalesModal
          holding={salesHolding}
          budgetCurrency={budget}
          onEdit={(sale) => setDialog({ kind: 'sell', holdingId: salesHolding.id, sale })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'record' && recordAccount && (
        <UpdateValueModal
          account={recordAccount}
          initialValue={dialog.value}
          onClose={() => {
            void refresh();
            close();
          }}
        />
      )}
      <ConfirmModal
        isOpen={dialog?.kind === 'remove-holding'}
        onClose={close}
        onConfirm={() => {
          if (dialog?.kind === 'remove-holding') removeHolding.mutate(dialog.holding.id);
          close();
        }}
        title="Remove holding"
        message="Removes this holding and its purchases. The account's transactions and balance stay as they are."
        confirmLabel="Remove"
        danger
      />
      <ConfirmModal
        isOpen={dialog?.kind === 'remove-security'}
        onClose={close}
        onConfirm={() => {
          if (dialog?.kind === 'remove-security') removeSecurity.mutate(dialog.security.id);
          close();
        }}
        title="Delete security"
        message="Deletes this security and every price entered for it."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
