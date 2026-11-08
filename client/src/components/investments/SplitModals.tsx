import { useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmModal } from '../ui/ConfirmModal';
import { GuideLink } from '../guide/GuideLink';
import { Actions, ErrorText, Field } from './InvestmentModals';
import { useDeleteSplit, useRecordSplit, useSplitPreview } from '../../hooks/useInvestments';
import { SPLIT_RATIO_MAX, type Holding, type Split } from '../../api/investments';
import { formatDay } from '../../utils/dates';
import { formatUnits } from '../../utils/units';

// D3c splits and consolidations (docs/INVESTMENT-SALES-AND-INCOME.md §4): a split changes the
// units held, not their cost or when they were bought, and isn't a sale. Purchases keep what was
// recorded; their units today follow from the splits since.

const today = () => format(new Date(), 'yyyy-MM-dd');

/** A whole number in a ratio, or null */
function wholeNumber(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= 1 && n <= SPLIT_RATIO_MAX ? n : null;
}

/** "2 for 1" is a split; "1 for 3" a consolidation */
export const splitLabel = (s: Pick<Split, 'toUnits' | 'fromUnits'>) =>
  `${s.toUnits} for ${s.fromUnits} ${s.toUnits > s.fromUnits ? 'split' : 'consolidation'}`;

/** Record a split or consolidation on a holding, and see or remove the ones it has */
export function SplitModal({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [to, setTo] = useState('2');
  const [from, setFrom] = useState('1');
  const [removing, setRemoving] = useState<Split | null>(null);
  const record = useRecordSplit();
  const remove = useDeleteSplit();

  const toUnits = wholeNumber(to);
  const fromUnits = wholeNumber(from);
  const input =
    date && toUnits && fromUnits && toUnits !== fromUnits
      ? { effectiveOn: date, toUnits, fromUnits }
      : null;
  const preview = useSplitPreview(holding.id, input);
  const figures = input ? preview.data : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    await record.mutateAsync({ holdingId: holding.id, ...input });
    setRemoving(null);
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Split or consolidate ${holding.security.symbol}`}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-text-tertiary">
          For a split or consolidation the company announced. It changes how many units you hold,
          not what they cost or when you bought them, and it isn&apos;t a sale.{' '}
          <GuideLink page="investments" className="font-medium text-brand-600">
            How splits work
          </GuideLink>
        </p>
        <Field
          label="Effective on"
          htmlFor="split-date"
          hint="The first day the new units count. Sales from this day on must be recorded after the split."
        >
          <Input
            id="split-date"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="New units" htmlFor="split-to" hint="2 for 1: you now hold 2">
            <Input
              id="split-to"
              inputMode="numeric"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={to.trim() !== '' && toUnits === null}
              required
            />
          </Field>
          <Field label="For every old unit(s)" htmlFor="split-from" hint="2 for 1: for every 1">
            <Input
              id="split-from"
              inputMode="numeric"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-invalid={from.trim() !== '' && fromUnits === null}
              required
            />
          </Field>
        </div>
        {toUnits !== null && toUnits === fromUnits && (
          <p className="text-sm text-text-tertiary">Enter two different numbers.</p>
        )}
        {figures && (
          <div className="rounded-lg bg-surface-secondary p-3 text-sm space-y-1" aria-live="polite">
            <p className="text-text">
              You hold {formatUnits(figures.before)} units now; after the {splitLabel(input!)} you
              will hold {formatUnits(figures.after)}.
            </p>
            {figures.lots
              .filter((l) => l.scaled)
              .map((l) => (
                <p key={l.id} className="text-xs text-text-tertiary">
                  Bought {formatDay(l.acquiredOn)}: {formatUnits(l.before)} → {formatUnits(l.after)}{' '}
                  units
                </p>
              ))}
            {figures.lots.some((l) => !l.scaled) && (
              <p className="text-xs text-text-tertiary">
                Purchases on or after this date already count in the new units.
              </p>
            )}
            {figures.rounded && (
              <p className="text-xs text-caution">
                A unit that isn&apos;t whole after this is rounded down by less than a millionth of
                a unit.
              </p>
            )}
          </div>
        )}
        <ErrorText error={record.error ?? (input ? preview.error : null)} />
        <Actions
          onClose={onClose}
          pending={record.isPending}
          disabled={!input || !figures}
          label="Record"
        />
      </form>

      {holding.splits.length > 0 && (
        <section className="mt-5" aria-label="Recorded splits">
          <h3 className="text-sm font-medium text-text mb-1">Recorded</h3>
          <ErrorText error={remove.error} />
          <ul className="divide-y divide-border-light border-y border-border-light">
            {holding.splits.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span className="text-text-secondary">
                  {formatDay(s.effectiveOn)} · {splitLabel(s)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoving(s)}
                  aria-label={`Remove the ${splitLabel(s)} of ${formatDay(s.effectiveOn)}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutateAsync({ holdingId: holding.id, splitId: removing.id })
        }
        title="Remove split"
        message="Removes the split and scales the units held back. Sales dated on or after it must be removed first."
        confirmLabel="Remove"
        danger
      />
    </Modal>
  );
}
