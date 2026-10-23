import { useEffect, useMemo, useState } from 'react';
import { Check, EyeOff, Plus, Tag as TagIcon, X } from 'lucide-react';
import {
  useCreateTag,
  useSetTransactionFlags,
  useSetTransactionTags,
  useTags,
} from '../../hooks/useTags';
import type { Tag, Transaction } from '../../types';

// Phase 9 marks in the transaction details: Reviewed, Hide from reports and tags. They live on
// the whole transaction (a split's parts share them) and change no amounts, so they stay
// available on reconciled transactions.

const TAG_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#64748b'];

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white max-w-40"
      style={{ backgroundColor: tag.color }}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
          className="opacity-80 hover:opacity-100 max-md:min-w-6 max-md:min-h-6 flex items-center justify-center"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/** Compact marks for a register row or phone card: tags, hidden from reports, reviewed */
export function RowMarks({ tx }: { tx: Transaction }) {
  const { data: tags = [] } = useTags();
  const shown = (tx.tagIds ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  if (!shown.length && !tx.hiddenFromReports && !tx.reviewedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {shown.slice(0, 2).map((t) => (
        <TagChip key={t.id} tag={t} />
      ))}
      {shown.length > 2 && (
        <span className="text-[11px] text-text-tertiary">+{shown.length - 2}</span>
      )}
      {tx.hiddenFromReports ? (
        <EyeOff size={12} className="text-caution" aria-label="Hidden from reports" role="img">
          <title>Hidden from reports</title>
        </EyeOff>
      ) : null}
      {tx.reviewedAt ? (
        <Check size={12} className="text-text-disabled" aria-label="Reviewed" role="img">
          <title>Reviewed</title>
        </Check>
      ) : null}
    </span>
  );
}

function TagPicker({ tx }: { tx: Transaction }) {
  const { data: tags = [] } = useTags();
  const setTags = useSetTransactionTags();
  const createTag = useCreateTag();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const current = tx.tagIds ?? [];
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const matches = tags.filter(
    (t) => !current.includes(t.id) && t.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const exact = tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());
  const save = (tagIds: string[]) => setTags.mutate({ id: tx.id, tagIds });

  async function create() {
    const name = query.trim();
    if (!name) return;
    const tag = await createTag.mutateAsync({
      name,
      color: TAG_COLORS[tags.length % TAG_COLORS.length],
    });
    save([...current, tag.id]);
    setQuery('');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {current.map((id) => {
          const tag = byId.get(id);
          return tag ? (
            <TagChip key={id} tag={tag} onRemove={() => save(current.filter((t) => t !== id))} />
          ) : null;
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 max-md:min-h-8"
        >
          <Plus size={12} /> Add tag
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-surface p-2 space-y-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matches.length === 1 && !exact) save([...current, matches[0].id]);
                else if (!exact) void create();
              }
            }}
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
            maxLength={60}
            className="w-full px-2 py-1 text-sm border border-border rounded bg-surface text-text focus:border-brand-600 focus:outline-none"
          />
          <div className="max-h-36 overflow-y-auto">
            {matches.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => save([...current, t.id])}
                className="flex w-full items-center gap-2 px-1.5 py-1 text-sm text-text rounded hover:bg-surface-alt"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
            {query.trim() && !exact && (
              <button
                type="button"
                onClick={() => void create()}
                disabled={createTag.isPending}
                className="flex w-full items-center gap-2 px-1.5 py-1 text-sm text-brand-600 rounded hover:bg-surface-alt"
              >
                <Plus size={12} /> Create “{query.trim()}”
              </button>
            )}
          </div>
          {(createTag.error || setTags.error) && (
            <p role="alert" className="text-xs text-negative">
              {(createTag.error ?? setTags.error)?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionMarks({ tx }: { tx: Transaction }) {
  const flags = useSetTransactionFlags();
  // Shown at once, then confirmed by the server (put back if saving fails)
  const [reviewed, setReviewed] = useState(Boolean(tx.reviewedAt));
  const [hidden, setHidden] = useState(Boolean(tx.hiddenFromReports));
  useEffect(() => setReviewed(Boolean(tx.reviewedAt)), [tx.reviewedAt]);
  useEffect(() => setHidden(Boolean(tx.hiddenFromReports)), [tx.hiddenFromReports]);
  const toggle = (patch: { reviewed?: boolean; hiddenFromReports?: boolean }) => {
    if (patch.reviewed !== undefined) setReviewed(patch.reviewed);
    if (patch.hiddenFromReports !== undefined) setHidden(patch.hiddenFromReports);
    flags.mutate(
      { id: tx.id, ...patch },
      {
        onError: () => {
          setReviewed(Boolean(tx.reviewedAt));
          setHidden(Boolean(tx.hiddenFromReports));
        },
      },
    );
  };
  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1">
          <TagIcon size={12} aria-hidden /> Tags
        </span>
        <TagPicker tx={tx} />
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => toggle({ reviewed: e.target.checked })}
          className="mt-0.5 rounded border-border text-brand-600 focus:ring-brand-600"
        />
        <span className="text-sm text-text">
          Reviewed
          <span className="block text-xs text-text-tertiary">
            Your own checklist mark. It does not reconcile anything.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => toggle({ hiddenFromReports: e.target.checked })}
          className="mt-0.5 rounded border-border text-brand-600 focus:ring-brand-600"
        />
        <span className="text-sm text-text">
          Hide from reports
          <span className="block text-xs text-text-tertiary">
            Leaves it out of Cash Flow, spending and income reports and the savings rate. Your
            balances and budget still count it.
          </span>
        </span>
      </label>
      {flags.error && (
        <p role="alert" className="text-xs text-negative">
          {flags.error.message}
        </p>
      )}
    </div>
  );
}
