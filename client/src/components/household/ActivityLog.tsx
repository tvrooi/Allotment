import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getHouseholdActivity, type HouseholdActivityLine } from '../../api/households';
import { formatDayTime } from '../../utils/dates';

const SOURCE: Record<HouseholdActivityLine['source'], string> = {
  owner: 'You',
  rule: 'A rule',
  recurring_bill: 'A shared recurring bill',
};

/**
 * Household → Activity (SPL-04): what was added, changed, removed or settled, newest first.
 * A removed entry keeps its line here after it has gone from the history.
 */
export function ActivityLog({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const { data: lines = [] } = useQuery({
    queryKey: ['households', groupId, 'activity'],
    queryFn: () => getHouseholdActivity(groupId),
    enabled: open,
  });
  return (
    <section className="bg-surface rounded-lg shadow-card border border-border-light p-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-text"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Activity
      </button>
      {open &&
        (lines.length ? (
          <ul className="mt-3 divide-y divide-border-light" aria-label="Household activity">
            {lines.map((l) => (
              <li key={l.id} className="py-2 text-sm">
                <span className="text-text">{l.summary}</span>
                <span className="block text-xs text-text-tertiary">
                  {SOURCE[l.source]} · {formatDayTime(l.time)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-tertiary">
            Nothing yet. Entries added, changed, removed or repaid from now on are listed here.
          </p>
        ))}
    </section>
  );
}
