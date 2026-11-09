import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/budget';
import type { BudgetSummary } from '../../types';
import { useSetBudget } from '../../hooks/useBudget';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency, parseCents, isUnreadableAmount } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { GuideLink } from '../guide/GuideLink';
import { formatAsOfDay } from '../../utils/dates';
import { cardNotes } from '../../utils/cardRows';

export function CardPayments({
  month,
  summary,
  loading = false,
}: {
  month: string;
  summary?: BudgetSummary;
  loading?: boolean;
}) {
  const qc = useQueryClient(),
    canSave = useCanSave(),
    setBudget = useSetBudget();
  const [open, setOpen] = useState(false),
    [accountId, setAccount] = useState(''),
    [amount, setAmount] = useState('0');
  const [preview, setPreview] = useState<api.CardSetupPreview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(''),
    [fundAmount, setFundAmount] = useState(''),
    [fundPreview, setFundPreview] = useState<api.CardFundingPreview | null>(null);
  const data = useQuery({ queryKey: ['card-funding'], queryFn: api.getCardFunding });
  const refresh = () => {
    for (const key of ['budget', 'budget-summary', 'card-funding', 'payday'])
      qc.invalidateQueries({ queryKey: [key] });
  };
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update card funding');
      setPreview(null);
      setFundPreview(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  const number = (raw: string) => {
    if (isUnreadableAmount(raw)) throw new Error('Enter a valid amount');
    const n = parseCents(raw);
    if (n < 0 || !Number.isSafeInteger(n)) throw new Error('Enter a nonnegative amount');
    return n;
  };
  if (!data.data?.accounts.length) return null;
  return (
    <section
      aria-label="Card payment funding"
      className="mb-4 bg-surface rounded-lg shadow-card border border-border-light p-4 text-sm space-y-3"
    >
      <h2 className="text-base font-semibold text-text">Card payments</h2>
      <p className="text-xs text-text-secondary">
        Payment reserves as of {summary?.asOf ? formatAsOfDay(summary.asOf) : 'today'}. Record bank
        repayments as linked transfers.{' '}
        <GuideLink page="card-payments" className="font-medium text-brand-600 hover:text-brand-700">
          How card payments work
        </GuideLink>
      </p>
      {summary?.cards?.map((card) => (
        <div
          key={card.accountId}
          className="border-t border-border-light pt-2 space-y-1"
          data-testid="card-payment"
        >
          <h3 className="font-semibold">{card.name}</h3>
          {cardNotes(card, { showZero: true }).map((n) => (
            <Fragment key={n.key}>
              <p className={n.tone === 'problem' ? 'text-negative' : ''}>{n.text}</p>
              {n.key === 'debt' && <p>Available for payment: {formatCurrency(card.available)}</p>}
            </Fragment>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={
              !canSave ||
              busy ||
              loading ||
              summary?.month !== month ||
              month !== data.data.asOf.slice(0, 7)
            }
            title={
              month !== data.data.asOf.slice(0, 7)
                ? 'Select the current month to add payment funding'
                : undefined
            }
            onClick={() => {
              setFunding(card.accountId);
              setFundAmount('');
              setFundPreview(null);
              setError('');
            }}
          >
            Fund debt
          </Button>
          {funding === card.accountId && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (loading || summary?.month !== month)
                    throw new Error('Wait for this month to finish loading');
                  const value = number(fundAmount);
                  if (value <= 0) throw new Error('Enter a positive amount');
                  if (fundPreview === null) {
                    setFundPreview(await api.previewCardAssignment(card.accountId, month, value));
                    return;
                  }
                  await setBudget.mutateAsync({
                    month,
                    categoryId: fundPreview.categoryId,
                    budgeted: fundPreview.budgeted,
                    revision: fundPreview.revision,
                  });
                  setFunding('');
                  refresh();
                });
              }}
            >
              <label className="block">
                Additional payment funding
                <input
                  disabled={busy}
                  aria-label={`Additional funding for ${card.name}`}
                  className="block w-full border border-border rounded bg-surface p-2"
                  value={fundAmount}
                  inputMode="decimal"
                  onChange={(e) => {
                    setFundAmount(e.target.value);
                    setFundPreview(null);
                  }}
                />
              </label>
              {fundPreview !== null && (
                <p role="status">
                  Payment availability after assignment: {formatCurrency(fundPreview.available)}.
                  Shortfall: {formatCurrency(fundPreview.shortfall)}. Ready to assign after funding:{' '}
                  {formatCurrency(fundPreview.unassigned)}.
                </p>
              )}
              <Button type="submit" size="sm" disabled={busy || !canSave}>
                {fundPreview === null ? 'Preview funding' : 'Assign payment funds'}
              </Button>
            </form>
          )}
        </div>
      ))}
      {data.data.accounts
        .filter((a) => !a.configured)
        .map((a) => (
          <div key={a.id}>
            <p>
              {a.name} isn’t set up for card payments yet: its purchases count like cash spending,
              and what you owe comes off Ready to assign.
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canSave || busy}
              onClick={() => {
                setAccount(a.id);
                setAmount('0');
                setPreview(null);
                setError('');
                setOpen(true);
              }}
            >
              Review {a.name} setup
            </Button>
          </div>
        ))}
      {error && !open && (
        <p role="alert" className="text-negative">
          {error}
        </p>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Review card payment funding">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (preview) {
                await api.applyCardSetup(preview);
                setOpen(false);
                setPreview(null);
                refresh();
              } else setPreview(await api.previewCardSetup(accountId, number(amount)));
            });
          }}
        >
          <p>
            Existing purchases remain part of opening debt. This setup creates a payment envelope
            and changes how future purchases reserve cash.
          </p>
          <label className="block">
            Cash to reserve for existing debt
            <input
              disabled={busy}
              aria-label="Initial card payment funding"
              className="block w-full border border-border rounded bg-surface p-2"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          {preview && (
            <div role="status" className="space-y-2">
              <p>Existing debt: {formatCurrency(preview.card.debt)}</p>
              <p>Payment reserve: {formatCurrency(preview.card.available)}</p>
              <p>Unfunded debt: {formatCurrency(preview.card.shortfall)}</p>
              <p>
                Ready to assign before: {formatCurrency(preview.beforeUnassigned)}. After:{' '}
                {formatCurrency(preview.unassigned)}.
              </p>
              <p>
                Previous transactions and assignments are preserved. Unfunded card debt needs a
                repayment plan; it is not spendable cash.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-negative">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !canSave}>
            {preview ? 'Enable payment funding' : 'Preview card setup'}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
