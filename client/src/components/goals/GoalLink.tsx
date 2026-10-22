import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { getGoals } from '../../api/goals';

/**
 * "Counts toward goal X" for a transaction in a goal's funding category. Derived only from the
 * goal's category link (phase 6C): a transaction never has its own goal or progress.
 */
export function GoalLink({ categoryIds }: { categoryIds: (string | null | undefined)[] }) {
  // Shares the Goals page's cache without refetching every time a transaction is opened
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 60_000,
  });
  const linked = goals.filter((g) => g.categoryId && categoryIds.includes(g.categoryId));
  if (!linked.length) return null;
  return (
    <p className="text-xs text-text-secondary flex items-center gap-1.5">
      <Target size={12} className="text-text-tertiary shrink-0" aria-hidden />
      <span>
        Its category funds{' '}
        {linked.map((g, i) => (
          <span key={g.id}>
            {i > 0 && ', '}
            <Link to="/goals" className="text-brand-600 hover:text-brand-700">
              {g.name}
            </Link>
          </span>
        ))}
        . Goal progress follows the category's available money.
      </span>
    </p>
  );
}
