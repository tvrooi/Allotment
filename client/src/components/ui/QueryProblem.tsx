import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';

/** The parts of a react-query result this needs; pass the query itself */
interface QueryLike {
  isError: boolean;
  error: unknown;
  data: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

/**
 * A read that failed with nothing loaded yet. A page checks this before deciding it's empty:
 * an unavailable list is not an empty one, and unknown amounts are not zero (UX audit AU-004).
 */
export const loadFailed = (q: QueryLike) => q.isError && q.data === undefined;

const reason = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Something went wrong.';

/**
 * What a page shows when its data couldn't be fetched. With nothing loaded: a panel saying
 * so, why, and Retry. With earlier data still on screen: a one-line notice above it that this
 * is what was loaded before. Otherwise nothing.
 *
 *   const goals = useGoals();
 *   <QueryProblem what="goals" query={goals} />
 */
export function QueryProblem({
  what,
  query,
  className = '',
}: {
  /** Plural noun as people say it: "goals", "payees", "files" */
  what: string;
  query: QueryLike;
  className?: string;
}) {
  if (!query.isError) return null;
  const retry = (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => void query.refetch()}
      disabled={query.isFetching}
    >
      <RotateCw size={14} /> {query.isFetching ? 'Retrying…' : 'Retry'}
    </Button>
  );

  if (query.data !== undefined) {
    return (
      <div
        role="status"
        className={`flex items-center gap-3 flex-wrap rounded-md border border-caution/30 bg-caution-subtle px-3 py-2 text-sm text-text ${className}`}
      >
        <AlertTriangle size={16} className="text-caution shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          Couldn&rsquo;t refresh your {what}. Showing what was loaded earlier.
        </span>
        {retry}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center gap-3 py-14 px-6 ${className}`}
    >
      <AlertTriangle size={26} className="text-caution" aria-hidden="true" />
      <p className="font-medium text-text">Couldn&rsquo;t load your {what}.</p>
      <p className="text-sm text-text-secondary max-w-md">
        {reason(query.error)} Nothing has been changed.
      </p>
      {retry}
    </div>
  );
}
