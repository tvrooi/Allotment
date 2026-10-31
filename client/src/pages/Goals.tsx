import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { differenceInCalendarDays, differenceInCalendarMonths, parseISO } from 'date-fns';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '../hooks/useGoals';
import { useAccounts } from '../hooks/useAccounts';
import { GoalFormModal } from '../components/goals/GoalFormModal';
import { GoalStatusModal } from '../components/goals/GoalStatusModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useModalValue } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { docsUrl } from '../utils/project';
import { Card } from '../components/ui/Card';
import { StatCardRow } from '../components/reports/ChartHelpers';
import RowMenu from '../components/ui/RowMenu';
import { transactionsLink } from '../utils/transactionFilters';
import { formatCurrency } from '../utils/currency';
import { useHideBalances } from '../utils/safeMode';
import { SafeModeNotice } from '../components/ui/Private';
import { usePreferencesStore } from '../store/preferencesStore';
import type { Goal, GoalStatus } from '../types';
import { formatDay } from '../utils/dates';

function amountOf(goal: Goal) {
  return goal.categoryId ? (goal.fundedAmount ?? 0) : goal.currentAmount;
}
function progressOf(goal: Goal) {
  const pct =
    goal.targetAmount > 0
      ? Math.min(100, (Math.max(0, amountOf(goal)) / goal.targetAmount) * 100)
      : 0;
  return { pct, remaining: Math.max(0, goal.targetAmount - amountOf(goal)) };
}

/** Target date status, plus the monthly amount needed to get there on time (Monarch-style). */
function scheduleOf(goal: Goal, remaining: number) {
  if (!goal.targetDate) return null;
  const target = parseISO(goal.targetDate);
  const today = new Date();
  const days = differenceInCalendarDays(target, today);
  const date = formatDay(target);
  if (remaining === 0) return { date, overdue: false, perMonth: null };
  if (days < 0) return { date, overdue: true, perMonth: null };
  const months = Math.max(1, differenceInCalendarMonths(target, today));
  // Rounded up to whole dollars, so following it always gets there on time
  return { date, overdue: false, perMonth: Math.ceil(remaining / months / 100) * 100 };
}

function GoalIcon({ goal }: { goal: Goal }) {
  const showIcons = usePreferencesStore((s) => s.showCategoryIcons);
  return (
    <div className="w-9 h-9 rounded-lg bg-surface-alt border border-border-light flex items-center justify-center shrink-0">
      {showIcons ? (
        <span className="text-lg leading-none">{goal.icon}</span>
      ) : (
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: goal.color }} />
      )}
    </div>
  );
}

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  retired: 'Retired',
};

function GoalRow({
  goal,
  accountName,
  replacementName,
  onEdit,
  onDelete,
  onStatus,
}: {
  goal: Goal;
  accountName: string | null;
  replacementName: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: GoalStatus) => void;
}) {
  const { pct, remaining } = progressOf(goal);
  const complete = remaining === 0 && goal.targetAmount > 0 && goal.fundingComplete !== false;
  const schedule = scheduleOf(goal, remaining);
  const details = [
    goal.categoryId ? `Category funded: ${goal.categoryName ?? ''}` : 'Manual tracking',
    schedule && `Target ${schedule.date}`,
    accountName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onClick={onEdit}
      className="px-5 py-4 hover:bg-hover cursor-pointer transition-colors last:rounded-b-lg"
    >
      <div className="flex items-center gap-3">
        <GoalIcon goal={goal} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-text truncate flex items-center gap-2">
            {goal.name}
            {goal.status !== 'active' && (
              <span className="text-[11px] font-medium rounded px-1.5 py-0.5 bg-surface-alt text-text-secondary">
                {STATUS_LABEL[goal.status]}
              </span>
            )}
          </span>
          {details && <span className="text-xs text-text-tertiary mt-0.5 block">{details}</span>}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-medium tabular-nums text-text block">
            {formatCurrency(amountOf(goal))}
          </span>
          <span className="text-xs text-text-tertiary tabular-nums block mt-0.5">
            of {formatCurrency(goal.targetAmount)}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RowMenu
            items={[
              { label: 'Edit goal', onClick: onEdit },
              {
                label: goal.status === 'active' ? 'Pause goal' : 'Make active again',
                onClick: () => onStatus(goal.status === 'active' ? 'paused' : 'active'),
              },
              {
                label: 'Mark completed',
                onClick: () => onStatus('completed'),
                hidden: goal.status === 'completed',
              },
              {
                label: 'Retire goal',
                onClick: () => onStatus('retired'),
                hidden: goal.status === 'retired',
              },
              { label: 'Delete goal', onClick: onDelete, danger: true },
            ]}
          />
        </div>
      </div>

      {goal.status !== 'active' && (
        <p className="mt-2 text-xs text-text-secondary">
          {STATUS_LABEL[goal.status]}
          {goal.statusReason ? `: ${goal.statusReason}` : ''}
          {replacementName ? ` · Replaced by ${replacementName}` : ''}
          {goal.categoryId ? ' · Funding kept; no new funding suggested.' : ''}
        </p>
      )}
      {goal.categoryId && (
        <p className="mt-2 text-xs text-text-secondary">
          <span>
            {goal.fundingComplete === false
              ? 'Funding assessment incomplete — check exchange rates.'
              : `Assigned this month ${formatCurrency(goal.assignedThisMonth ?? 0)} · Activity ${formatCurrency(goal.activity ?? 0)} · Available ${formatCurrency(goal.available ?? 0)}`}
          </span>
          {/* Progress comes only from the category: these lead to where its money is moved */}
          <span className="ml-2 inline-flex gap-3" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/budget/category/${goal.categoryId}`}
              className="text-brand-600 hover:text-brand-700"
            >
              Assign or move money
            </Link>
            <Link
              to={transactionsLink({ categoryIds: [goal.categoryId], datePreset: 'all' })}
              className="text-brand-600 hover:text-brand-700"
            >
              Transactions
            </Link>
          </span>
        </p>
      )}
      <div className="mt-3 pl-12">
        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${complete ? 'bg-positive' : ''}`}
            style={complete ? { width: '100%' } : { width: `${pct}%`, backgroundColor: goal.color }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs">
          <span className={complete ? 'text-positive font-medium' : 'text-text-secondary'}>
            {complete ? (
              'Goal reached'
            ) : schedule?.overdue ? (
              <span className="text-negative">
                Past target date · {formatCurrency(remaining)} to go
              </span>
            ) : (
              <>
                {formatCurrency(remaining)} to go
                {schedule?.perMonth != null && (
                  <span className="text-text-tertiary">
                    {' '}
                    · {formatCurrency(schedule.perMonth)}/mo to reach it on time
                  </span>
                )}
              </>
            )}
          </span>
          <span className="tabular-nums text-text-tertiary">{Math.floor(pct)}%</span>
        </div>
      </div>
    </div>
  );
}

function GoalGroup({
  label,
  goals,
  accountNames,
  goalNames,
  onEdit,
  onDelete,
  onStatus,
  defaultCollapsed = false,
}: {
  label: string;
  goals: Goal[];
  accountNames: Map<string, string>;
  goalNames: Map<string, string>;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  onStatus: (g: Goal, status: GoalStatus) => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const saved = goals.reduce((s, g) => s + amountOf(g), 0);

  return (
    <Card padding="none">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-hover transition-colors ${
          collapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-border'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-text-tertiary">
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="text-base font-semibold text-text">{label}</span>
          <span className="text-xs text-text-tertiary">
            {goals.length} goal{goals.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-base font-semibold tabular-nums text-text">
          {formatCurrency(saved)}
        </span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border-light">
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              accountName={goal.accountId ? (accountNames.get(goal.accountId) ?? null) : null}
              replacementName={
                goal.replacedByGoalId ? (goalNames.get(goal.replacedByGoalId) ?? null) : null
              }
              onEdit={() => onEdit(goal)}
              onDelete={() => onDelete(goal)}
              onStatus={(status) => onStatus(goal, status)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [addOpen, setAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const editModal = useModalValue(editGoal);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [statusChange, setStatusChange] = useState<{ goal: Goal; status: GoalStatus } | null>(null);
  const statusModal = useModalValue(statusChange);
  // Goals are mostly savings: what's saved, what's left and the totals
  const hideBalances = useHideBalances();

  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const goalNames = useMemo(() => new Map(goals.map((g) => [g.id, g.name])), [goals]);
  const reached = (g: Goal) => progressOf(g).remaining === 0 && g.targetAmount > 0;
  const inProgress = goals.filter((g) => g.status === 'active' && !reached(g));
  const completed = goals.filter(
    (g) => g.status === 'completed' || (g.status === 'active' && reached(g)),
  );
  const paused = goals.filter((g) => g.status === 'paused');
  const retired = goals.filter((g) => g.status === 'retired');
  const groupProps = {
    accountNames,
    goalNames,
    onEdit: setEditGoal,
    onDelete: setDeleting,
    onStatus: (goal: Goal, status: GoalStatus) => setStatusChange({ goal, status }),
  };

  const totalSaved = goals.reduce((s, g) => s + amountOf(g), 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const leftToSave = goals.reduce((s, g) => s + progressOf(g).remaining, 0);
  const overallPct = totalTarget > 0 ? Math.floor((totalSaved / totalTarget) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="h-5 w-32 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="font-display text-[28px] max-md:text-2xl leading-tight tracking-tight text-text">
          Goals
        </h1>
        <Button size="sm" onClick={() => setAddOpen(true)} data-guide="goals.add">
          <Plus size={14} /> Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <EmptyState
            icon={<Target size={26} />}
            title="Save for what matters"
            description="Set a target like an emergency fund, a trip or a new car, and see how close you are and how much to set aside each month."
            learnMoreHref={docsUrl('goals')}
            actions={
              <Button onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add Goal
              </Button>
            }
          />
        </div>
      ) : hideBalances ? (
        <div className="flex-1 overflow-y-auto px-6 pt-5">
          <SafeModeNotice title="Goals are hidden in Safe mode" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-6 space-y-4">
            <p className="text-sm text-text-secondary">
              Category funded:{' '}
              {formatCurrency(
                goals.filter((g) => g.categoryId).reduce((s, g) => s + amountOf(g), 0),
              )}{' '}
              · Manually tracked:{' '}
              {formatCurrency(
                goals.filter((g) => !g.categoryId).reduce((s, g) => s + amountOf(g), 0),
              )}
              . Manual values may overlap other goals or accounts.
            </p>
            <StatCardRow
              variant="hero"
              cards={[
                {
                  label: 'Goal progress',
                  value: formatCurrency(totalSaved),
                  sub: `${overallPct}% of target`,
                },
                { label: 'Target', value: formatCurrency(totalTarget) },
                { label: 'Left to save', value: formatCurrency(leftToSave) },
                {
                  label: 'Goals reached',
                  value: `${completed.length} of ${goals.length}`,
                  tone: completed.length > 0 ? 'positive' : undefined,
                },
              ]}
            />
            {inProgress.length > 0 && (
              <GoalGroup label="In progress" goals={inProgress} {...groupProps} />
            )}
            {paused.length > 0 && <GoalGroup label="Paused" goals={paused} {...groupProps} />}
            {completed.length > 0 && (
              <GoalGroup label="Completed" goals={completed} {...groupProps} />
            )}
            {retired.length > 0 && (
              <GoalGroup label="Retired" goals={retired} {...groupProps} defaultCollapsed />
            )}
          </div>
        </div>
      )}

      <GoalFormModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => createGoal.mutateAsync(data)}
      />

      {editModal.value && (
        <GoalFormModal
          key={editModal.value.id}
          isOpen={editModal.isOpen}
          onClose={() => setEditGoal(null)}
          onSave={(data) => updateGoal.mutateAsync({ id: editModal.value!.id, data })}
          editGoal={editModal.value}
        />
      )}

      {statusModal.value && (
        <GoalStatusModal
          key={`${statusModal.value.goal.id}:${statusModal.value.status}`}
          goal={statusModal.value.goal}
          status={statusModal.value.status}
          goals={goals}
          isOpen={statusModal.isOpen}
          onClose={() => setStatusChange(null)}
        />
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteGoal.mutate(deleting.id);
        }}
        title="Delete Goal"
        message={`Delete "${deleting?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
