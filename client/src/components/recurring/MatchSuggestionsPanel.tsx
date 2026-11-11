import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Link2, X } from 'lucide-react';
import { useMatchSuggestions, useMatchOccurrence, useDismissMatch } from '../../hooks/useSchedules';
import { formatCurrency } from '../../utils/currency';
import { formatShortDay } from '../../utils/dates';

export default function MatchSuggestionsPanel() {
  const { data: suggestions = [] } = useMatchSuggestions();
  const matchOcc = useMatchOccurrence();
  const dismissMatch = useDismissMatch();
  const [expanded, setExpanded] = useState(false);

  if (suggestions.length === 0) return null;

  const totalCandidates = suggestions.reduce((s, sg) => s + sg.candidates.length, 0);

  return (
    // A quiet inline callout (the shape of Forecast's no-income callout) on a tinted surface:
    // the brand fill stays for the page's own action (BRAND.md: Marigold is the one bright spot)
    <section
      aria-label="Possible matches"
      className="shrink-0 mx-6 mt-3 rounded-lg border border-border-light bg-surface-alt"
    >
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <Link2 size={16} className="shrink-0 text-brand-600" aria-hidden />
        <p className="flex-1 min-w-0 text-text">
          {totalCandidates} transaction{totalCandidates !== 1 ? 's' : ''} may match your recurring
          items
        </p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap max-md:min-h-11 font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
        >
          {expanded ? 'Hide' : 'Review now'}
          {expanded ? (
            <ChevronDown size={14} aria-hidden />
          ) : (
            <ChevronRight size={14} aria-hidden />
          )}
        </button>
      </div>

      {expanded && (
        <div className="bg-surface text-text border-t border-border-light rounded-b-lg max-h-80 overflow-y-auto divide-y divide-border-light">
          {suggestions.map((sg) => (
            <div key={sg.occurrenceId} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-text">{sg.scheduleName}</span>
                <span className="text-xs text-text-tertiary">
                  {formatShortDay(sg.expectedDate)} · {formatCurrency(sg.expectedAmount)}
                </span>
              </div>

              <div className="space-y-1.5 pl-3">
                {sg.candidates.map((c) => (
                  <div key={c.transactionId} className="flex items-center gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-text-secondary">{c.payeeName || '—'}</span>
                      <span className="text-text-tertiary ml-2 text-xs">
                        {formatShortDay(c.date)} · {formatCurrency(c.amount)}
                      </span>
                      <span className="text-text-tertiary ml-2 text-xs">({c.score}% match)</span>
                    </div>
                    <button
                      onClick={() =>
                        matchOcc.mutate({
                          occurrenceId: sg.occurrenceId,
                          transactionId: c.transactionId,
                        })
                      }
                      className="p-1 rounded text-positive hover:bg-positive-subtle transition-colors"
                      title="Accept match"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() =>
                        dismissMatch.mutate({
                          occurrenceId: sg.occurrenceId,
                          transactionId: c.transactionId,
                        })
                      }
                      className="p-1 rounded text-text-tertiary hover:text-negative hover:bg-negative-subtle transition-colors"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
