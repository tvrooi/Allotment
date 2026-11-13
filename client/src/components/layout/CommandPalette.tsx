import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  FileText,
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
import { useAccountName, useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { useGoals } from '../../hooks/useGoals';
import { useGuideProgress } from '../../hooks/useGuides';
import { useCanAddTransaction } from '../../hooks/useOffline';
import { useCanSave } from '../../hooks/useConnection';
import { useDebounce } from '../../hooks/useDebounce';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { getTransactions } from '../../api/transactions';
import { listFiles } from '../../api/files';
import { IS_DEMO } from '../../demo/isDemo';
import { formatDay } from '../../utils/dates';
import { Private } from '../ui/Private';
import { useIsPhone } from '../../hooks/useIsPhone';
import { useAddTransactionStore } from '../../store/addTransactionStore';
import { useGuideStore } from '../../store/guideStore';
import { useSafeModeStore } from '../../store/safeModeStore';
import { featureState } from '../../utils/navFeatures';
import {
  PALETTE_SEARCH_LABEL,
  paletteCanSearch,
  paletteResultCount,
  paletteSections,
  paletteTransactionResult,
  type PaletteEntry,
} from '../../utils/commandPalette';
import { readRecents, rememberRecent } from '../../utils/paletteRecents';
import { transactionsLink } from '../../utils/transactionFilters';
import { MORE_FEATURES_LINK, NAV_PAGES } from './navPages';

// Cached destinations work offline; server search is read-only and stays in this lazy chunk.

interface Result extends PaletteEntry {
  icon: LucideIcon;
  amount?: string;
  /** A second, quieter line: a category's group, where a recent goes */
  detail?: string;
  /** "Set up": a page for a feature the sidebar leaves out */
  badge?: string;
  /** The key that does the same, shown beside it */
  shortcut?: string;
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
  const canSave = useCanSave();
  const accountCurrency = useAccountCurrency();
  const accountNameOf = useAccountName();
  const safeModeOn = useSafeModeStore((s) => s.on);
  const [recents] = useState(readRecents);

  const entries = useMemo<Result[]>(() => {
    const pages: Result[] = NAV_PAGES.map((p) => {
      // Still loading: listed as it is, not as "Set up", so nothing flips while it loads
      const state = p.feature
        ? featureState(p.feature, progress, pathname, progressFailed)
        : 'shown';
      const hidden = state === 'hidden' && !!progress;
      return state === 'setup' || hidden
        ? {
            id: `page:${p.path}`,
            group: 'pages',
            label: p.label,
            icon: p.icon,
            badge: 'Set up',
            to: hidden ? MORE_FEATURES_LINK.to : p.path,
            state: hidden ? MORE_FEATURES_LINK.state : undefined,
            remember: !hidden,
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
        detail: 'Payee',
        icon: Users,
        // Its own page (#235): spending, default category, rules and transactions
        to: `/payees/${p.id}`,
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

  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, 250);
  const ready = paletteCanSearch(trimmed) && trimmed === debounced;
  // The same visibility rule as the Files page row; wait for progress before asking for files.
  const filesShown = featureState('files', progress, pathname, progressFailed) === 'shown';
  const transactions = useQuery({
    queryKey: ['palette-search', 'transactions', debounced],
    queryFn: () => getTransactions({ search: debounced, limit: 8 }),
    enabled: ready && canSave,
    retry: false,
    gcTime: 0,
  });
  const files = useQuery({
    queryKey: ['palette-search', 'files', debounced],
    queryFn: () => listFiles({ q: debounced, limit: 5 }),
    enabled: ready && canSave && filesShown && !IS_DEMO,
    retry: false,
    gcTime: 0,
  });
  const serverResults: Result[] = [];
  const message = (group: 'transactions' | 'files', label: string): Result => ({
    id: `${group}:message`,
    group,
    label,
    icon: group === 'files' ? FileText : Search,
    message: true,
    unavailable: label,
  });
  const searchLink = transactionsLink({ search: trimmed, datePreset: 'all' });
  if (paletteCanSearch(trimmed)) {
    if (!canSave) serverResults.push(message('transactions', 'Not available offline'));
    else if (!ready || transactions.isPending)
      serverResults.push(message('transactions', 'Searching…'));
    else if (transactions.isError) serverResults.push(message('transactions', 'Search failed'));
    else if (transactions.data.length) {
      serverResults.push(
        ...transactions.data.slice(0, 8).map<Result>((tx) => ({
          ...paletteTransactionResult(tx, trimmed, accountNameOf, accountCurrency(tx.accountId)),
          icon: ArrowLeftRight,
          to: searchLink,
        })),
        {
          id: 'transactions:all',
          group: 'transactions',
          label: 'See all in Transactions',
          icon: ArrowLeftRight,
          to: searchLink,
        },
      );
    }
    if (filesShown) {
      if (!canSave) serverResults.push(message('files', 'Not available offline'));
      else if (IS_DEMO) serverResults.push(message('files', 'Files are not available in the demo'));
      else if (!ready || files.isPending) serverResults.push(message('files', 'Searching…'));
      else if (files.isError) serverResults.push(message('files', 'Search failed'));
      else
        serverResults.push(
          ...files.data.documents.slice(0, 5).map<Result>((file) => ({
            id: `file:${file.id}`,
            group: 'files',
            label: file.fileName,
            icon: FileText,
            detail: formatDay(file.date),
            to: `/files?file=${encodeURIComponent(file.id)}`,
          })),
        );
    }
  }

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

  const sections = paletteSections([...entries, ...serverResults], query, recentResults);
  const count = paletteResultCount(sections);
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
          aria-label={PALETTE_SEARCH_LABEL}
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
                          <span
                            className={
                              item.group === 'transactions' || item.group === 'files'
                                ? 'block truncate text-xs text-text-tertiary'
                                : 'text-text-tertiary'
                            }
                          >
                            {item.group !== 'transactions' && item.group !== 'files' && ' · '}
                            {item.detail}
                          </span>
                        )}
                        {item.unavailable && !item.message && (
                          <span className="block truncate text-xs text-text-tertiary">
                            {item.unavailable}
                          </span>
                        )}
                      </span>
                      {item.amount && (
                        <span className="shrink-0 text-sm tabular-nums text-text">
                          <Private>{item.amount}</Private>
                        </span>
                      )}
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
        {count === 1 ? '1 result' : `${count} results`}
      </p>
    </div>
  );
}
