import { CategoryManager } from '../components/settings/CategoryManager';
import { PageHeader } from '../components/ui/PageHeader';
import { PAGE_GUTTER } from '../components/ui/pageGutter';
import { useScrollMemory } from '../hooks/useScrollMemory';

/**
 * Categories, a page under Budget (#244; it was a Settings tab). The page is the lazy chunk, so
 * the manager is imported directly. The breadcrumb is the way back, to the month last viewed.
 */
export default function BudgetCategoriesPage() {
  const scrollMemory = useScrollMemory('budget-categories');

  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        breadcrumbs={[{ label: 'Budget', to: '/budget' }, { label: 'Categories' }]}
        title="Categories"
        subtitle="Add, edit and reorder the groups and categories your budget uses."
      />
      <div ref={scrollMemory} className={`flex-1 overflow-y-auto py-6 ${PAGE_GUTTER}`}>
        <div className="max-w-2xl">
          <CategoryManager />
        </div>
      </div>
    </div>
  );
}
