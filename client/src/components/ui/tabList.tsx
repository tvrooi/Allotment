import type { HTMLAttributes, KeyboardEvent } from 'react';

/**
 * Keyboard for a role="tablist": Left and Right move to the next tab (wrapping round), Home
 * and End to the first and last, and the tab reached is opened, as in a desktop app. Only
 * the open tab is in the Tab order (tabIndex 0 on it, -1 on the rest).
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not(:disabled)'),
  );
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? tabs.length - 1
        : (at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}

/**
 * Matching ids for a tab and the panel it shows: the tab gets `id={tab}` and
 * `aria-controls={panel}`, the panel `role="tabpanel"`, `id={panel}` and
 * `aria-labelledby={tab}`, so a screen reader names what the content belongs to.
 */
export const tabIds = (prefix: string, id: string) => ({
  tab: `${prefix}-tab-${id}`,
  panel: `${prefix}-panel-${id}`,
});

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
