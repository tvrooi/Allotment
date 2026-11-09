import { QueryProblem, loadFailed } from '../ui/QueryProblem';
import { Card } from '../ui/Card';

type Source = Parameters<typeof loadFailed>[0];

/** All inputs must be available before a card can make claims about money or empty lists. */
export const dataUnavailable = (sources: Source[]) => sources.some(loadFailed);

/** Keep the shared unavailable/stale presentation, with one retry for all failed inputs. */
export function DataFeedback({ title, sources }: { title: string; sources: Source[] }) {
  const failed = sources.filter((source) => source.isError);
  if (!failed.length) return null;
  const unavailable = dataUnavailable(sources);
  const problem = (
    <QueryProblem
      what={title.toLowerCase()}
      query={{
        isError: true,
        error: failed[0].error,
        data: unavailable ? undefined : true,
        isFetching: failed.some((source) => source.isFetching),
        refetch: () => Promise.all(failed.map((source) => source.refetch())),
      }}
      className={unavailable ? '' : 'mb-3'}
    />
  );
  return unavailable ? <Card>{problem}</Card> : problem;
}
