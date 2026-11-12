import { useState, useMemo, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Landmark,
  Link2,
} from 'lucide-react';
import { useAccounts, useBalancesAgo } from '../hooks/useAccounts';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { AssetLiabilitySummary } from '../components/accounts/AssetLiabilitySummary';
import { UpSyncBadge } from '../components/up/UpSyncBadge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { QueryProblem, loadFailed } from '../components/ui/QueryProblem';
import { EmptyState } from '../components/ui/EmptyState';
import { useOpenFromLink } from '../hooks/useOpenFromLink';
import { formatCurrency, formatMoney } from '../utils/currency';
import { useHideBalances } from '../utils/safeMode';
import { Private } from '../components/ui/Private';
import {
  balanceValue,
  earlierValue,
  totalValue,
  unconvertedCurrencies,
} from '../utils/accountMoney';
import { UnconvertedNote } from '../components/currency/UnconvertedNote';
import NetWorthMini from '../components/dashboard/NetWorthMini';
import { ACCOUNT_GROUPS, type Account, type AccountGroup } from '../types';
import { AccountIcon } from '../components/accounts/AccountIcon';
import { accountTypeInfo, accountTypeLabel } from '../utils/accountTypes';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

function groupAccountsByType(accounts: Account[]) {
  const groups = new Map<AccountGroup, Account[]>();
  for (const a of accounts) {
    const group = accountTypeInfo(a.type).group;
    const list = groups.get(group) ?? [];
    list.push(a);
    groups.set(group, list);
  }
  return ACCOUNT_GROUPS.filter((g) => groups.has(g.value)).map((g) => ({
    label: g.label,
    accounts: groups.get(g.value)!,
  }));
}

interface AccountGroupProps {
  label: string;
  accounts: Account[];
  balancesAgo: Record<string, number> | undefined;
}

function AccountGroup({ label, accounts, balancesAgo }: AccountGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const groupId = useId();
  // In the budget's currency, at today's rate (so the change is the accounts', not the rate's)
  const groupTotal = totalValue(accounts);
  const groupTotalAgo = accounts.reduce((sum, a) => {
    const now = balanceValue(a) ?? 0;
    const ago = balancesAgo?.[a.id];
    return sum + (ago === undefined ? now : (earlierValue(a, ago) ?? now));
  }, 0);
  const missing = unconvertedCurrencies(accounts);
  const change = groupTotal - groupTotalAgo;
  const changePct = groupTotalAgo !== 0 ? (change / Math.abs(groupTotalAgo)) * 100 : 0;
  const hide = useHideBalances();

  return (
    <Card padding="none">
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls={groupId}
        className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3.5 hover:bg-hover transition-colors ${
          collapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-border'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5 text-left">
          <span className="shrink-0 text-text-tertiary" aria-hidden>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="text-base font-semibold text-text break-words">{label}</span>
        </span>
        <span className="text-right">
          <span
            className={`block whitespace-nowrap text-base font-semibold tabular-nums ${groupTotal < 0 && !hide ? 'text-negative' : 'text-text'}`}
          >
            <Private>{formatCurrency(groupTotal)}</Private>
          </span>
          <UnconvertedNote currencies={missing} link={false} />
        </span>
        {balancesAgo && change !== 0 && !hide && (
          <span
            className={`col-span-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 pl-[26px] text-left text-sm tabular-nums ${change >= 0 ? 'text-positive' : 'text-negative'}`}
          >
            {change >= 0 ? (
              <TrendingUp size={14} aria-hidden />
            ) : (
              <TrendingDown size={14} aria-hidden />
            )}
            <span>
              {change >= 0 ? '+' : ''}
              {formatCurrency(change)} ({Math.abs(changePct).toFixed(1)}%)
            </span>
            <span className="text-text-tertiary">past month</span>
          </span>
        )}
      </button>
      <div id={groupId} hidden={collapsed} className="divide-y divide-border-light">
        {accounts.map((account) => (
          <Link
            key={account.id}
            to={`/accounts/${account.id}`}
            className="flex items-center justify-between px-5 py-4 hover:bg-hover gap-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 group transition-colors last:rounded-b-lg"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <AccountIcon
                  name={account.name}
                  type={account.type}
                  logo={account.logo}
                  size="md"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text truncate block">
                    {account.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1 text-xs text-text-tertiary">
                    <span>{accountTypeLabel(account.type)}</span>
                    <span aria-hidden>·</span>
                    <span className="break-words min-w-0">
                      {account.householdPool
                        ? `Household: ${account.householdPool}`
                        : account.isOffBudget
                          ? 'Off budget'
                          : 'For budget'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-right">
              <span>
                <span className="block text-sm font-medium tabular-nums text-text">
                  <Private>{formatMoney(account.balance, account.currency)}</Private>
                </span>
                {account.rateDate && account.mainBalance !== null && !hide && (
                  <span className="block text-xs tabular-nums text-text-tertiary">
                    ≈ {formatCurrency(account.mainBalance)}
                  </span>
                )}
              </span>
              <ChevronRight size={16} className="text-text-tertiary" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default function AccountsPage() {
  // Back and Forward return to where this list was (#245)
  const scrollMemory = useScrollMemory('accounts');
  const accountsQuery = useAccounts();
  const { data: accounts = [], isLoading } = accountsQuery;
  const balancesQuery = useBalancesAgo();
  const [addOpen, setAddOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overviewId = useId();
  useOpenFromLink('add', () => setAddOpen(true));
  const allGroups = useMemo(() => groupAccountsByType(accounts), [accounts]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className={`py-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
          <div className="h-5 w-32 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className={`py-6 space-y-2 ${PAGE_GUTTER}`}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div
        className={`py-4 border-b border-border shrink-0 flex items-center justify-between ${PAGE_GUTTER}`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">
            Accounts
          </h1>
          <UpSyncBadge />
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} data-guide="accounts.add">
          <Plus size={14} /> Add account
        </Button>
      </div>

      {accountsQuery.isError && (
        <QueryProblem what="accounts" query={accountsQuery} className="m-6" />
      )}
      {loadFailed(accountsQuery) ? null : accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <EmptyState
            icon={<Landmark size={26} />}
            title="Add the accounts you want to track"
            description="Everyday and savings accounts, cards, loans, super or your home: each account keeps its own balance and transactions, and together they make up your net worth."
            learnMore="accounts"
            actions={
              <>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus size={14} /> Add your first account
                </Button>
                <ButtonLink variant="secondary" to="/settings?tab=connections">
                  <Link2 size={14} /> Connect a bank
                </ButtonLink>
              </>
            }
          />
        </div>
      ) : (
        <div ref={scrollMemory} className="flex-1 overflow-y-auto">
          <div className={`pt-5 pb-3 ${PAGE_GUTTER}`}>
            <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
              <div className="min-w-0">
                <p className="text-sm text-text-secondary">Net worth</p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums break-words text-text">
                  <Private>{formatCurrency(totalValue(accounts))}</Private>
                </p>
                <UnconvertedNote currencies={unconvertedCurrencies(accounts)} />
              </div>
              <button
                type="button"
                aria-expanded={overviewOpen}
                aria-controls={overviewId}
                onClick={() => setOverviewOpen(!overviewOpen)}
                className="min-h-11 shrink-0 flex items-center gap-1 rounded-md px-2 text-sm font-medium text-text-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                {overviewOpen ? 'Hide overview' : 'Show overview'}
                {overviewOpen ? (
                  <ChevronDown size={16} aria-hidden />
                ) : (
                  <ChevronRight size={16} aria-hidden />
                )}
              </button>
            </div>
            <div
              id={overviewId}
              data-guide="accounts.summary"
              className={`${overviewOpen ? 'grid' : 'hidden md:grid'} grid-cols-1 lg:grid-cols-2 gap-5`}
            >
              <NetWorthMini />
              <Card>
                <AssetLiabilitySummary accounts={accounts} />
              </Card>
            </div>
          </div>

          <QueryProblem
            what="account balance comparisons"
            query={balancesQuery}
            className="mx-6 mb-4"
          />
          <div data-guide="accounts.list" className={`pb-6 space-y-4 ${PAGE_GUTTER}`}>
            {allGroups.map((g) => (
              <AccountGroup
                key={g.label}
                label={g.label}
                accounts={g.accounts}
                balancesAgo={balancesQuery.isError ? undefined : balancesQuery.data}
              />
            ))}
          </div>
        </div>
      )}

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
