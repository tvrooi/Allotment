import { useMemo } from 'react';
import { CategoryIcon } from '../ui/CategoryIcon';
import { Link } from 'react-router-dom';
import { useSpendingByCategory } from '../../hooks/useReports';
import { formatCurrency } from '../../utils/currency';
import { usePreferencesStore } from '../../store/preferencesStore';
import { PieChart } from 'lucide-react';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { CATEGORY_COLORS } from '../../utils/chartColors';

interface Props {
  currentMonth: string;
}

export default function SpendingBreakdown({ currentMonth }: Props) {
  const showCategoryIcons = usePreferencesStore((s) => s.showCategoryIcons);
  const { data = [], isLoading } = useSpendingByCategory(currentMonth, currentMonth);

  const topCategories = useMemo(() => {
    return data
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 7)
      .map((c) => ({ ...c, amount: c.totalSpent }));
  }, [data]);

  const maxAmount = topCategories.length > 0 ? topCategories[0].amount : 1;

  if (isLoading) {
    return (
      <Card>
        <div className="h-5 w-40 bg-surface-alt rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-6 bg-surface-alt rounded animate-pulse"
              style={{ width: `${90 - i * 8}%` }}
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Spending by category</h2>
        <Link
          to="/reports"
          aria-label="View all spending reports"
          className="text-xs text-brand-600 hover:text-brand-700 font-medium max-md:min-h-11 max-md:inline-flex max-md:items-center"
        >
          View all
        </Link>
      </div>

      {topCategories.length === 0 ? (
        <EmptyState
          compact
          className="flex-1 justify-center"
          icon={<PieChart size={20} />}
          title="No spending this month"
          description="As you spend, your biggest categories show up here."
        />
      ) : (
        <div className="space-y-2.5">
          {topCategories.map((cat, i) => {
            const pct = (cat.amount / maxAmount) * 100;
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <div key={cat.categoryId ?? i}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm text-text-secondary truncate mr-2 inline-flex items-center gap-1.5">
                    {showCategoryIcons && <CategoryIcon icon={cat.categoryIcon} size={14} />}
                    {cat.categoryName || 'Uncategorised'}
                  </span>
                  <span className="text-xs text-text-tertiary tabular-nums whitespace-nowrap">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
