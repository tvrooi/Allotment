import { useLocation } from 'react-router-dom';
import { useUpConnection } from '../../hooks/useUp';
import { usePlaidItems } from '../../hooks/usePlaid';
import { useSimplefinConnections } from '../../hooks/useSimplefin';
import { useEnableBankingConnections } from '../../hooks/useEnableBanking';
import { useHousehold, useHouseholds } from '../../hooks/useHouseholds';
import { useGuideProgress } from '../../hooks/useGuides';
import { featureShown } from '../../utils/navFeatures';
import { bankFeeds, type BankConnectionState } from '../../utils/bankSync';
import { formatMoney } from '../../utils/currency';
import { balanceHeadline, householdToShow, unsharedPayments } from '../household/balanceHeadline';
import { BankSyncPill } from '../up/UpSyncBadge';
import { StatusPill } from '../ui/StatusPill';
import { Private } from '../ui/Private';
import { DataFeedback } from './DataFeedback';

/**
 * What only Allotment knows, under the dashboard's opening line: how fresh each bank feed is,
 * and the household balance the Household page leads with. Each item shows only when it
 * applies and links to its page; with none, nothing renders. It reads the hooks Settings →
 * Connections and the Household page use, through their existing routes. A bank feed that
 * can't be read is left out, as the Up badge always was; a household balance that can't be
 * read says so rather than show nothing owed.
 */
export function StatusStrip() {
  const { pathname } = useLocation();
  const up = useUpConnection();
  const plaid = usePlaidItems();
  const simplefin = useSimplefinConnections();
  const enableBanking = useEnableBankingConnections();
  const progress = useGuideProgress();
  const households = useHouseholds();
  const shown = featureShown('household', progress.data, pathname, progress.isError);
  const household = householdToShow(households.data ?? [], shown);
  const detail = useHousehold(household?.id ?? '');

  const connections: BankConnectionState[] = [
    ...(up.data ? [{ provider: 'Up', ...up.data }] : []),
    ...(plaid.data ?? []).map((c) => ({ provider: 'Plaid', ...c })),
    ...(simplefin.data ?? []).map((c) => ({ provider: 'SimpleFIN', ...c })),
    ...(enableBanking.data ?? []).map((c) => ({ provider: 'Enable Banking', ...c })),
  ];
  const feeds = bankFeeds(connections);

  const householdSources = shown ? [households, ...(household ? [detail] : [])] : [];
  const problem = householdSources.some((q) => q.isError);
  const state = detail.data;
  const headline =
    household && state
      ? balanceHeadline(
          state.people,
          state.balances,
          unsharedPayments(state.recurringBills, state.group.includeBills !== 0).count,
        )
      : null;

  if (!feeds.length && !headline && !problem) return null;
  return (
    <section aria-label="Budget status" className="flex flex-col gap-2">
      <DataFeedback title="household balance" sources={householdSources} />
      {(feeds.length > 0 || headline) && (
        <ul className="flex flex-wrap gap-2">
          {feeds.map((feed) => (
            <li key={feed.provider}>
              <BankSyncPill feed={feed} className="max-md:min-h-11" />
            </li>
          ))}
          {headline && state && (
            <li>
              <StatusPill
                to={`/household?household=${encodeURIComponent(state.group.id)}`}
                className="max-md:min-h-11"
              >
                <span className="text-text-tertiary">{state.group.name}</span>{' '}
                <span className="text-text">
                  {headline.text}
                  {headline.amount !== undefined && (
                    <>
                      {' '}
                      <span className="tabular-nums">
                        <Private>{formatMoney(headline.amount, state.group.currency)}</Private>
                      </span>
                    </>
                  )}
                </span>
              </StatusPill>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
