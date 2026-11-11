import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Search,
  Tag,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useGoals } from '../../hooks/useGoals';
import { useGuideProgress } from '../../hooks/useGuides';
import { useCanAddTransaction } from '../../hooks/useOffline';
import { useIsPhone } from '../../hooks/useIsPhone';
import { useAddTransactionStore } from '../../store/addTransactionStore';
import { useGuideStore } from '../../store/guideStore';
import { useSafeModeStore } from '../../store/safeModeStore';
import { featureShown } from '../../utils/navFeatures';
import { paletteSections, type PaletteEntry } from '../../utils/commandPalette';
import { readRecents, rememberRecent } from '../../utils/paletteRecents';
import { transactionsLink } from '../../utils/transactionFilters';
import { MORE_FEATURES_LINK, NAV_PAGES } from './navPages';

// The search palette (issue #224): pages, actions and the lists the app already holds
// (accounts, categories, payees, goals), all searched in the browser, so it works offline and in
// the demo from what is cached. It writes nothing: the one action that saves opens the shared
// Add transaction dialog. No amounts are shown, so Safe mode has nothing to hide here.

interface Result extends PaletteEntry {
  icon: LucideIcon;
  /** A second, quieter line: a category's group, where a recent goes */
  detail?: string;
  /** "Set up": a page for a feature the sidebar leaves out */
  badge?: string;
  /** The key that does the same, shown beside it */
  shortcut?: string;
  /** Why it can't be used right now (it stays listed, unavailable) */
  unavailable?: string;
  /** Somewhere to go… */
  to?: string;
  state?: unknown;
  /** …remembered as a recent destination when chosen */
  remember?: boolean;
  /** …or something to do once the palette has closed */
  run?: () => void;
}

/** The page a path belongs to (longest match), to show where a recent goes */
const pageFor = (path: string) =>
  NAV_PAGES.filter(
    (p) => path === p.path || path.startsWith(`${p.path}/`) || path.startsWith(`${p.path}?`),
  ).sort((a, b) => b.path.length - a.path.length)[0];

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search" size="lg">
      {isOpen && <PaletteBody onClose={onClose} />}
    </Modal>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPhone = useIsPhone();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Into the search box as it opens (before the dialog's own effect, which then leaves it there)
  useEffect(() => inputRef.current?.focus(), []);

  const { data: accounts = [] } = useAccounts();
  const { data: categoryGroups = [] } = useCategories();
  const { data: payees = [] } = usePayees();
  const { data: goals = [] } = useGoals();
  const { data: progress, isError: progressFailed } = useGuideProgress();
  const add = useCanAddTransaction();
  const safeModeOn = useSafeModeStore((s) => s.on);
  const [recents] = useState(readRecents);

  const entries = useMemo<Result[]>(() => {
    const pages: Result[] = NAV_PAGES.map((p) => {
      // Still loading: listed as it is, not as "Set up", so nothing flips while it loads
      const setUp =
        !!p.feature && !!progress && !featureShown(p.feature, progress, pathname, progressFailed);
      return setUp
        ? {
            id: `page:${p.path}`,
            group: 'pages',
            label: p.label,
            icon: p.icon,
            badge: 'Set up',
            to: MORE_FEATURES_LINK.to,
            state: MORE_FEATURES_LINK.state,
          }
        : {
            id: `page:${p.path}`,
            group: 'pages',
            label: p.label,
            icon: p.icon,
            to: p.path,
            remember: true,
          };
    });
    const actions: Result[] = [
      {
        id: 'action:add',
        group: 'actions',
        label: 'Add a transaction',
        icon: Plus,
        shortcut: 'N',
        unavailable: add.allowed ? undefined : add.hint,
        run: () => useAddTransactionStore.getState().show(),
      },
      {
        id: 'action:safe-mode',
        group: 'actions',
        label: safeModeOn ? 'Turn Safe mode off' : 'Turn Safe mode on',
        icon: safeModeOn ? Eye : EyeOff,
        run: () => useSafeModeStore.getState().toggle(),
      },
      {
        id: 'action:guides',
        group: 'actions',
        label: 'Open guides and tips',
        icon: BookOpen,
        shortcut: '?',
        run: () => useGuideStore.getState().setListOpen(true),
      },
    ];
    const data: Result[] = [
      ...accounts
        .filter((a) => !a.closedAt)
        .map<Result>((a) => ({
          id: `account:${a.id}`,
          group: 'accounts',
          label: a.name,
          icon: Landmark,
          to: `/accounts/${a.id}`,
          remember: true,
        })),
      ...categoryGroups.flatMap((g) =>
        g.categories.map<Result>((c) => ({
          id: `category:${c.id}`,
          group: 'categories',
          label: c.name,
          detail: g.name,
          icon: Tag,
          to: `/budget/category/${c.id}`,
          remember: true,
        })),
      ),
      ...payees.map<Result>((p) => ({
        id: `payee:${p.id}`,
        group: 'payees',
        label: p.name,
        detail: 'Transactions',
        icon: Users,
        to: transactionsLink({ payeeIds: [p.id], datePreset: 'all' }),
        remember: true,
      })),
      // Goals have no page of their own: each opens Goals
      ...goals
        .filter((g) => g.status !== 'retired')
        .map<Result>((g) => ({
          id: `goal:${g.id}`,
          group: 'goals',
          label: g.name,
          icon: Target,
          to: '/goals',
          remember: true,
        })),
    ];
    return [...pages, ...actions, ...data];
  }, [
    accounts,
    categoryGroups,
    payees,
    goals,
    progress,
    progressFailed,
    pathname,
    add.allowed,
    add.hint,
    safeModeOn,
  ]);

  const recentResults = useMemo<Result[]>(
    () =>
      recents.map((r) => {
        const page = pageFor(r.path);
        return {
          id: `recent:${r.name}:${r.path}`,
          group: 'recent',
          label: r.name,
          detail: page && page.label !== r.name ? page.label : undefined,
          icon: page?.icon ?? Clock,
          to: r.path,
          remember: true,
        };
      }),
    [recents],
  );

  const sections = useMemo(
    () => paletteSections(entries, query, recentResults),
    [entries, query, recentResults],
  );
  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, flat.length - 1);
  const optionId = (i: number) => `${listId}-option-${i}`;

  // The highlighted result stays in view as the arrow keys move it
  useEffect(() => {
    if (current < 0) return;
    document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' });
  });

  function choose(item: Result | undefined) {
    if (!item || item.unavailable) return;
    onClose();
    if (item.to) {
      navigate(item.to, { state: item.state });
      if (item.remember) rememberRecent({ name: item.label, path: item.to });
    } else if (item.run) {
      // A dialog an action opens waits until focus is back where the palette was opened from,
      // so closing that dialog returns there too (the palette's own return runs a tick after
      // it closes)
      const run = item.run;
      setTimeout(() => setTimeout(run));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const last = flat.length - 1;
    if (e.key === 'ArrowDown') setActive(current >= last ? 0 : current + 1);
    else if (e.key === 'ArrowUp') setActive(current <= 0 ? last : current - 1);
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter') choose(flat[current]);
    else return;
    e.preventDefault();
  }

  let index = -1;
  return (
    <div className="-mt-1">
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search pages, accounts, categories, payees and goals"
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search pages, accounts, payees…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="block w-full h-11 rounded-md border border-border pl-9 pr-3 text-sm max-md:text-base bg-surface text-text placeholder:text-text-tertiary focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>
      {flat.length === 0 ? (
        <p className="mt-3 px-2 py-6 text-center text-sm text-text-tertiary">
          Nothing matches “{query.trim()}”.
        </p>
      ) : (
        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          className="mt-3 -mx-2 max-h-[min(60vh,28rem)] max-md:max-h-[45dvh] overflow-y-auto overscroll-contain"
        >
          {sections.map((section) => {
            const headingId = `${listId}-${section.group}`;
            return (
              <div key={section.group} role="group" aria-labelledby={headingId} className="pb-2">
                <div
                  id={headingId}
                  role="presentation"
                  className="px-2 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wide text-text-tertiary"
                >
                  {section.label}
                </div>
                {section.items.map((item) => {
                  index += 1;
                  const i = index;
                  const selected = i === current;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={item.unavailable ? true : undefined}
                      title={item.unavailable}
                      // Reached through the search box (aria-activedescendant), not by Tab; a
                      // screen reader's own cursor can still focus one and press Enter
                      tabIndex={-1}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        choose(item);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => i !== current && setActive(i)}
                      onClick={() => choose(item)}
                      className={`flex items-center gap-3 min-h-10 max-md:min-h-11 px-2 rounded-md text-sm cursor-pointer ${
                        selected ? 'bg-surface-alt text-text' : 'text-text-secondary'
                      } ${item.unavailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <Icon size={16} aria-hidden className="shrink-0 text-text-tertiary" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-text">{item.label}</span>
                        {item.detail && (
                          <span className="text-text-tertiary"> · {item.detail}</span>
                        )}
                        {item.unavailable && (
                          <span className="block truncate text-xs text-text-tertiary">
                            {item.unavailable}
                          </span>
                        )}
                      </span>
                      {item.badge && (
                        <span className="shrink-0 rounded-full border border-border px-2 text-2xs leading-5 text-text-secondary">
                          {item.badge}
                        </span>
                      )}
                      {item.shortcut && !isPhone && (
                        <kbd
                          aria-hidden
                          className="shrink-0 rounded border border-border px-1.5 font-sans text-2xs leading-5 text-text-tertiary"
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {flat.length === 1 ? '1 result' : `${flat.length} results`}
      </p>
    </div>
  );
}
