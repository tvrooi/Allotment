import { format } from 'date-fns';
import { Hourglass } from 'lucide-react';
import { useEndSchedule, useUpdateSchedule } from '../../hooks/useSchedules';
import { Button } from '../ui/Button';
import type { Schedule } from '../../types';

/**
 * Recurring items whose last two payments never arrived: a subscription that stopped would
 * otherwise show as Missed every month and keep being forecast. Cancelling keeps its paid
 * history and skips the payments that never came; either choice can be undone.
 */
export default function PossiblyEndedPanel({ allRecurring }: { allRecurring: Schedule[] }) {
  const ended = allRecurring.filter((s) => s.status === 'active' && s.possiblyEnded);
  const updateSchedule = useUpdateSchedule();
  const endSchedule = useEndSchedule();
  if (!ended.length) return null;
  return (
    <section
      aria-label="Possibly ended"
      className="shrink-0 border-b border-border bg-caution-subtle px-6 py-2.5"
    >
      <p className="text-sm font-medium text-text flex items-center gap-2">
        <Hourglass size={14} className="text-caution" aria-hidden />
        {ended.length === 1 ? '1 recurring item' : `${ended.length} recurring items`} may have
        ended: the last two payments didn't arrive. The forecast leaves{' '}
        {ended.length === 1 ? 'it' : 'them'} out.
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {ended.map((s) => (
          <li key={s.id} className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-text-secondary min-w-0 flex-1 truncate">{s.name}</span>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`${s.name} is still active`}
              onClick={() =>
                updateSchedule.mutate({
                  id: s.id,
                  confirmedActiveAt: format(new Date(), 'yyyy-MM-dd'),
                })
              }
            >
              Still active
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Cancel ${s.name}`}
              onClick={() => endSchedule.mutate(s)}
            >
              Cancel recurring
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
