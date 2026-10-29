import { EyeOff } from 'lucide-react';
import { HIDDEN_AMOUNT, useHideBalances } from '../../utils/safeMode';
import { EmptyState } from './EmptyState';

/** A blurred stand-in for an amount Safe mode hides */
export function HiddenAmount({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Hidden"
      title="Hidden in Safe mode"
      className={`safe-mode-mask ${className}`}
    >
      {HIDDEN_AMOUNT}
    </span>
  );
}

/**
 * A balance or total: shown as is, or hidden while Safe mode is on. The children aren't
 * rendered at all when hidden, so the figure can't be read from the page.
 */
export function Private({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return useHideBalances() ? <HiddenAmount className={className} /> : <>{children}</>;
}

/** A chart of balances (net worth, investments, super): its shape gives the figures away too */
export function PrivateChart({
  children,
  height,
  className = '',
}: {
  children: React.ReactNode;
  /** Of the space the chart takes, so the page doesn't jump */
  height: number | string;
  className?: string;
}) {
  if (!useHideBalances()) return <>{children}</>;
  return (
    <div
      style={{ height }}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-md bg-page text-text-tertiary text-xs ${className}`}
    >
      <EyeOff size={18} aria-hidden />
      Hidden in Safe mode
    </div>
  );
}

/** What a part of the app that Safe mode hides shows instead */
export function SafeModeNotice({ title }: { title: string }) {
  return (
    <EmptyState
      icon={<EyeOff size={24} />}
      title={title}
      description="Safe mode hides balances and totals. The eye button at the top of the menu, or Alt+Shift+H, turns it off."
    />
  );
}

/** A part of the app that is all balances (investments, forecasts): hidden as a whole */
export function PrivateSection({ children, title }: { children: React.ReactNode; title: string }) {
  return useHideBalances() ? <SafeModeNotice title={title} /> : <>{children}</>;
}
