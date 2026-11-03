import { GuideLink } from '../guide/GuideLink';
import type { DocsPage } from '../../utils/project';
import { useOnboardingActive } from '../dashboard/onboarding';

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Buttons or links: what the user can do about it */
  actions?: React.ReactNode;
  /** The page of Allotment's guide that explains this part of the app */
  learnMore?: DocsPage;
  /** Smaller, for inside a dashboard card */
  compact?: boolean;
  /** Keep the buttons even while the Get started checklist holds the next steps */
  keepActions?: boolean;
  className?: string;
}

/**
 * What a page or card shows when there's nothing in it yet: what goes here, and a button
 * to add the first one, so nobody is left looking at a blank screen.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  learnMore,
  compact = false,
  keepActions = false,
  className = '',
}: Props) {
  // On the dashboard of a new budget the Get started checklist holds the next steps
  const onboarding = useOnboardingActive();
  const shownActions = onboarding && !keepActions ? undefined : actions;
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'py-6 px-2' : 'py-14 px-6'} ${className}`}
    >
      {icon && (
        <div
          aria-hidden
          className={`flex items-center justify-center rounded-full bg-brand-50 text-brand-600 ${
            compact ? 'w-10 h-10 mb-3' : 'w-14 h-14 mb-4'
          }`}
        >
          {icon}
        </div>
      )}
      <p className={`font-semibold text-text ${compact ? 'text-sm' : 'text-base'}`}>{title}</p>
      {description && (
        <p
          className={`text-text-tertiary mt-1 max-w-sm leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {description}
        </p>
      )}
      {shownActions && (
        <div
          className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'mt-3' : 'mt-5'}`}
        >
          {shownActions}
        </div>
      )}
      {learnMore && (
        <GuideLink
          page={learnMore}
          className={`text-xs font-medium text-brand-600 hover:text-brand-700 ${compact ? 'mt-2' : 'mt-4'}`}
        >
          Learn more
        </GuideLink>
      )}
    </div>
  );
}
