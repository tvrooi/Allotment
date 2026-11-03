import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { RefObject } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PULL_THRESHOLD } from '../../utils/pullToRefresh';

/**
 * The phone's pull to refresh: drag the page down from the top and let go to fetch everything
 * on screen again (balances, transactions, the budget). It refetches rather than reloading, so
 * a half-filled form elsewhere and the in-browser demo's sample budget survive.
 */
export function PullToRefresh({ scroller }: { scroller: RefObject<HTMLElement | null> }) {
  const queryClient = useQueryClient();
  const { distance, refreshing } = usePullToRefresh(scroller, () =>
    queryClient.refetchQueries({ type: 'active' }),
  );
  if (distance === 0 && !refreshing) return null;
  const progress = Math.min(1, distance / PULL_THRESHOLD);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
      style={{ transform: `translateY(${distance - 40}px)` }}
    >
      <div
        role="status"
        aria-live="polite"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-hover border border-border"
      >
        <RefreshCw
          size={18}
          aria-hidden
          className={`text-text-secondary ${refreshing ? 'animate-spin' : ''}`}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }
          }
        />
        <span className="sr-only">
          {refreshing ? 'Refreshing' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
