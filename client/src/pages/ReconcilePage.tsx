import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReconciliation, saveReconciliation } from '../api/accounts';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { AmountFields, useAmountValidity } from '../components/ui/amountValidity';
import { formatMoney } from '../utils/currency';
import { useHideBalances } from '../utils/safeMode';
import { SafeModeNotice } from '../components/ui/Private';
import type { Transaction } from '../types';
import { formatDay } from '../utils/dates';

export default function ReconcilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const qc = useQueryClient();
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['reconciliation', id],
    queryFn: () => getReconciliation(id!),
    enabled: !!id,
  });
  const account = snapshot?.account;
  const unreconciledTxns = snapshot?.transactions ?? [];
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (createAdjustment: boolean) =>
      saveReconciliation(id!, {
        transactionIds: [...checkedIds],
        statementBalance,
        expectedBalance: account!.balance,
        revision: snapshot!.revision,
        createAdjustment,
      }),
    onSuccess: () => {
      for (const key of [
        'accounts',
        'transactions',
        'budget',
        'budget-summary',
        'reconciliation',
        'review',
        'reports',
      ])
        qc.invalidateQueries({ queryKey: [key] });
      navigate(account?.closedAt ? '/settings?tab=accounts' : `/accounts/${id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [statementBalance, setStatementBalance] = useState(0);
  // A statement balance that can't be read would reconcile against the one from before
  const { allValid: statementValid, report } = useAmountValidity();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const hideBalances = useHideBalances();

  function startStep2() {
    if (!statementValid) return;
    setCheckedIds(new Set(unreconciledTxns.map((t) => t.id)));
    setError('');
    setStep(2);
  }

  const reconciledBase = snapshot?.reconciledBase ?? 0;
  const checkedSum = unreconciledTxns
    .filter((t) => checkedIds.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0);
  const allChecked = checkedIds.size === unreconciledTxns.length;
  const registerToday = reconciledBase + unreconciledTxns.reduce((sum, t) => sum + t.amount, 0);

  const selectedBalance = reconciledBase + checkedSum;
  const difference = selectedBalance - statementBalance;
  const isBalanced = difference === 0;

  function toggleRow(tx: Transaction) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(tx.id) ? next.delete(tx.id) : next.add(tx.id);
      return next;
    });
  }

  if (!account) return null;

  // Reconciling is all balances: the bank's and the register's
  if (hideBalances) {
    return (
      <div className="flex-1 overflow-y-auto px-6 pt-5">
        <SafeModeNotice title="Reconciling is hidden in Safe mode" />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary mb-1">
            <Link to="/accounts" className="hover:text-brand-600 transition-colors">
              Accounts
            </Link>
            <ChevronRight size={11} />
            <Link to={`/accounts/${id}`} className="hover:text-brand-600 transition-colors">
              {account.name}
            </Link>
            <ChevronRight size={11} />
            <span className="text-text-secondary">Reconcile</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
              Reconcile: {account.name}
            </h1>
            <Badge variant={account.type} />
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center pt-16 px-6">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-base font-semibold text-text mb-1">
                Enter your bank's ending balance
              </h2>
              <p className="text-sm text-text-secondary">
                Check your bank statement or online banking for the current balance.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Statement Balance</label>
              <AmountFields report={report}>
                <CurrencyInput
                  currency={account.currency}
                  allowNegative
                  value={statementBalance}
                  onChange={setStatementBalance}
                  aria-label="Statement balance"
                  className="w-full text-lg"
                />
              </AmountFields>
            </div>

            <div className="rounded-lg border border-border-light bg-surface-alt px-4 py-3">
              <p className="text-xs text-text-tertiary">Current register balance</p>
              <p className="text-lg font-semibold text-text mt-0.5 tabular-nums">
                {formatMoney(registerToday, account.currency)}
              </p>
            </div>

            <Button onClick={startStep2} disabled={isLoading || !statementValid} className="w-full">
              Start Reconciliation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...unreconciledTxns].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary mb-1">
          <Link to="/accounts" className="hover:text-brand-600 transition-colors">
            Accounts
          </Link>
          <ChevronRight size={11} />
          <Link to={`/accounts/${id}`} className="hover:text-brand-600 transition-colors">
            {account.name}
          </Link>
          <ChevronRight size={11} />
          <span className="text-text-secondary">Reconcile</span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
            Reconcile: {account.name}
          </h1>
          <Badge variant={account.type} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-surface-alt border-b border-border z-10">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary w-24">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">
                  Payee
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-text-tertiary w-28">
                  Amount
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-text-tertiary w-12">
                  <input
                    type="checkbox"
                    aria-label="Select all current transactions"
                    checked={allChecked}
                    onChange={() =>
                      setCheckedIds(
                        allChecked ? new Set() : new Set(unreconciledTxns.map((t) => t.id)),
                      )
                    }
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    Loading...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    No unreconciled transactions.
                  </td>
                </tr>
              ) : (
                sorted.map((tx) => {
                  const checked = checkedIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => toggleRow(tx)}
                      className={`border-b border-border-light cursor-pointer transition-colors ${checked ? 'bg-positive-subtle hover:bg-positive-subtle' : 'hover:bg-hover'}`}
                    >
                      <td className="px-4 py-2 text-xs text-text-tertiary whitespace-nowrap">
                        {formatDay(tx.date)}
                      </td>
                      <td className="px-4 py-2 text-sm text-text">
                        {tx.payeeName ?? <span className="text-text-disabled italic">—</span>}
                      </td>
                      <td
                        className={`px-4 py-2 text-sm text-right tabular-nums font-medium ${tx.amount < 0 ? 'text-text' : 'text-positive'}`}
                      >
                        {formatMoney(tx.amount, account.currency)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Select transaction ${tx.id}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleRow(tx)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="w-64 shrink-0 border-l border-border flex flex-col">
          <div className="flex-1 px-5 py-6 space-y-5">
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Selected Balance</p>
              <p className="text-xl font-semibold text-text tabular-nums">
                {formatMoney(selectedBalance, account.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">Statement Balance</p>
              <p className="text-xl font-semibold text-text tabular-nums">
                {formatMoney(statementBalance, account.currency)}
              </p>
            </div>
            <div className="pt-3 border-t border-border-light">
              <p className="text-xs text-text-tertiary mb-0.5">Difference</p>
              <p
                className={`text-2xl font-semibold tabular-nums ${isBalanced ? 'text-positive' : 'text-negative'}`}
              >
                {formatMoney(difference, account.currency)}
              </p>
              {isBalanced && <p className="text-xs text-positive mt-1">Ready to finish!</p>}
            </div>
          </div>

          <div className="px-5 py-5 space-y-2 border-t border-border">
            {error && (
              <p role="alert" className="text-xs text-negative">
                {error}
              </p>
            )}
            {!allChecked && (
              <p className="text-xs text-caution">
                Check every current transaction before creating an adjustment. Unchecked entries are
                not missing money.
              </p>
            )}
            {!isBalanced && allChecked && (
              <p className="text-xs text-text-secondary">
                Adds a {formatMoney(-difference, account.currency)} balance correction. Review your
                statement first; income and spending stay unchanged.
              </p>
            )}

            <Button
              onClick={() => {
                setError('');
                save.mutate(false);
              }}
              disabled={!isBalanced || save.isPending || checkedIds.size === 0}
              className="w-full"
            >
              {save.isPending ? 'Saving...' : 'Finish'}
            </Button>
            {!isBalanced && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError('');
                  save.mutate(true);
                }}
                disabled={!allChecked || save.isPending}
                className="w-full"
              >
                Create Adjustment
              </Button>
            )}
            <button
              onClick={() => navigate(`/accounts/${id}`)}
              className="w-full py-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
