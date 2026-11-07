import type { HTMLAttributes } from 'react';
import { onTabListKeyDown } from './tabList';

/**
 * The row of tabs for a page's views (UX audit AU-010): role="tablist" with its label and the
 * arrow-key, Home and End keyboard from onTabListKeyDown. Its children are role="tab" buttons
 * with aria-selected and a roving tabIndex; the panel uses tabIds() for its labels.
 *
 * The list itself is deliberately not focusable: its open tab is the Tab stop (WAI-ARIA tabs
 * pattern). The role is set here once, so a lint rule that expects focusable interactive
 * roles doesn't flag every page that lists tabs.
 */
export function TabList({
  label,
  children,
  ...rest
}: { label: string } & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onKeyDown'>) {
  const list = { role: 'tablist', 'aria-label': label, onKeyDown: onTabListKeyDown };
  return (
    <div {...rest} {...list}>
      {children}
    </div>
  );
}
