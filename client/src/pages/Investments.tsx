import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CandlestickChart, Plus } from 'lucide-react';
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
import { StatCardRow, type StatCard } from '../components/reports/ChartHelpers';
import { UpdateValueModal } from '../components/accounts/UpdateValueModal';
import {
  HoldingModal,
  KIND_LABEL,
  LotsModal,
  PriceModal,
  SecurityModal,
  basisSummary,
} from '../components/investments/InvestmentModals';
import type { Holding, InvestmentAccount, Security, SecuritySummary } from '../api/investments';
import { formatMoney } from '../utils/currency';
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
  | { kind: 'record'; accountId: string; value: number }
  | { kind: 'remove-holding'; holding: Holding }
  | { kind: 'remove-security'; security: SecuritySummary };

function signed(amount: number, currency: string | null) {
  return `${amount > 0 ? '+' : ''}${formatMoney(amount, currency)}`;
}

const holdingsCount = (n: number) => (n === 1 ? '1 holding' : `${n} holdings`);

const toneOf = (n: number | null) =>
  n === null || n === 0 ? 'text-text' : n > 0 ? 'text-positive' : 'text-negative';

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
          items={[
            {
              label: 'Update price',
              onClick: () => onDialog({ kind: 'price', security: holding.security }),
            },
            {
              label: 'Purchases and cost',
              onClick: () => onDialog({ kind: 'lots', holdingId: holding.id }),
            },
            { label: 'Edit units', onClick: () => onDialog({ kind: 'holding', holding }) },
            {
              label: 'Remove holding',
              danger: true,
              onClick: () => onDialog({ kind: 'remove-holding', holding }),
            },
          ]}
        />
      </td>
    </tr>
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
        <div className="mx-5 mb-3 rounded-lg bg-surface-alt px-3 py-2 text-xs text-text-secondary flex flex-wrap items-center justify-between gap-2">
          <span>
            The holdings are worth {formatMoney(Math.abs(account.difference), currency)}{' '}
            {account.difference > 0 ? 'more' : 'less'} than the recorded balance. The balance only
            changes if you record it.
          </span>
          <Button
            size="sm"
            variant="secondary"
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
      {account.holdings.length ? (
        <div className="overflow-x-auto px-5 pb-2">
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
              {account.holdings.map((h) => (
                <HoldingRow key={h.id} holding={h} onDialog={onDialog} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-4 text-sm text-text-tertiary">No holdings recorded.</p>
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
  const removeHolding = useDeleteHolding();
  const removeSecurity = useDeleteSecurity();
  const refresh = useRefreshInvestments();
  const close = () => setDialog(null);

  const budget = data?.budgetCurrency ?? null;
  const totals = data?.totals;
  const cards: StatCard[] = totals
    ? [
        {
          label: 'Holdings value',
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

  const holdingFor = (id: string) =>
    data?.accounts.flatMap((a) => a.holdings).find((h) => h.id === id) ?? null;
  const lotsHolding = dialog?.kind === 'lots' ? holdingFor(dialog.holdingId) : null;
  const recordAccount =
    dialog?.kind === 'record' ? allAccounts.find((a) => a.id === dialog.accountId) : undefined;

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 max-md:px-4 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
            Investments
          </h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Holdings you record and price yourself. They don't change account balances, your budget
            or net worth until you record a value.
          </p>
        </div>
        {!!data?.accounts.length && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setDialog({ kind: 'security' })}>
              Add security
            </Button>
            <Button onClick={() => setDialog({ kind: 'holding' })}>
              <Plus size={16} /> Add holding
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 max-md:px-4 space-y-6">
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
                  <Button>Go to Accounts</Button>
                </Link>
              }
            />
          ) : (
            <>
              <StatCardRow cards={cards} />
              {data.accounts.map((a) => (
                <AccountCard key={a.id} account={a} onDialog={setDialog} />
              ))}

              <section aria-labelledby="securities-heading">
                <h2 id="securities-heading" className="text-sm font-semibold text-text mb-2">
                  Securities
                </h2>
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
                              {s.holdingCount === 1 ? '1 holding' : `${s.holdingCount} holdings`}
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
                                onClick: () => setDialog({ kind: 'remove-security', security: s }),
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
              </section>

              <p className="text-xs text-text-tertiary">
                Values use the latest price you entered on or before today, converted at the latest
                exchange rate. Gains are unrealized and before tax: sales, dividends, fees outside a
                lot's cost and time-weighted returns aren't calculated.
              </p>
            </>
          )}
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
