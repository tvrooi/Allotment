import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { EventKind, Plan, PlanEvent } from '../../api/longTerm';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EVENT_KINDS, eventYear, kindLabel } from '../../utils/longTerm';
import { MARKER_GLYPH } from './NetWorthChart';

/** The plan's life events, each with a marker on the line. Add, edit, switch off or delete. */
export function EventList({
  plan,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  plan: Plan;
  onAdd: (kind: EventKind) => void;
  onEdit: (event: PlanEvent) => void;
  onToggle: (event: PlanEvent) => void;
  onDelete: (event: PlanEvent) => void;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PlanEvent | null>(null);
  const birthYear = plan.settings.birthYear;
  const events = [...plan.events].sort(
    (a, b) => eventYear(a.start, birthYear) - eventYear(b.start, birthYear),
  );
  return (
    <section aria-label="Life events" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Life events change income, spending and savings from the year they happen. Each shows as a
          marker on the line.
        </p>
        <Button size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          <Plus size={14} /> Add an event
        </Button>
      </div>
      {adding && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Kinds of event">
          {EVENT_KINDS.map((k) => (
            <li key={k.kind}>
              <button
                type="button"
                className="w-full text-left rounded-md border border-border p-3 hover:bg-surface-alt max-md:min-h-11"
                onClick={() => {
                  setAdding(false);
                  onAdd(k.kind);
                }}
              >
                <span className="block text-sm font-medium">{k.label}</span>
                <span className="block text-xs text-text-tertiary">{k.help}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-text-tertiary">
          No events yet. Try adding your retirement to see when your savings and super start being
          drawn on.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const year = eventYear(e.start, birthYear);
            return (
              <li
                key={e.id}
                className={`flex items-center gap-3 rounded-md border border-border-light p-3 ${e.enabled ? '' : 'opacity-60'}`}
              >
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-brand-contrast"
                >
                  {MARKER_GLYPH[e.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {kindLabel(e.kind)} · {year} (age {year - birthYear})
                    {e.enabled ? '' : ' · left out'}
                  </p>
                </div>
                <label className="relative flex items-center gap-1 text-xs text-text-secondary max-md:min-h-11">
                  <input
                    type="checkbox"
                    aria-label={`Include ${e.name}`}
                    checked={e.enabled}
                    disabled={busy}
                    onChange={() => onToggle(e)}
                  />
                  <span className="max-sm:sr-only">Include</span>
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Edit ${e.name}`}
                  onClick={() => onEdit(e)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Delete ${e.name}`}
                  onClick={() => setDeleting(e)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && onDelete(deleting)}
        title="Delete this event?"
        message={`"${deleting?.name ?? ''}" is removed from this plan only. Your budget is not touched.`}
        confirmLabel="Delete"
        danger
      />
    </section>
  );
}
