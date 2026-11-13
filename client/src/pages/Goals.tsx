import { Link, useNavigate } from 'react-router-dom';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Target } from 'lucide-react';
import { differenceInCalendarDays, differenceInCalendarMonths, parseISO } from 'date-fns';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '../hooks/useGoals';
import { useAccounts } from '../hooks/useAccounts';
import { GoalFormModal } from '../components/goals/GoalFormModal';
import { GoalStatusModal } from '../components/goals/GoalStatusModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal, useModalValue } from '../components/ui/Modal';
import { FilesSection } from '../components/files/FilesSection';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { QueryProblem, loadFailed } from '../components/ui/QueryProblem';
import { Card } from '../components/ui/Card';
import RowMenu from '../components/ui/RowMenu';
import { transactionsLink } from '../utils/transactionFilters';
import { deleteGoalMessage } from '../utils/deleteGoalMessage';
import { formatCurrency } from '../utils/currency';
import { useHideBalances } from '../utils/safeMode';
import { SafeModeNotice } from '../components/ui/Private';
import { usePreferencesStore } from '../store/preferencesStore';
import type { Goal, GoalStatus } from '../types';
import { formatDay } from '../utils/dates';
import { useScrollMemory } from '../hooks/useScrollMemory';
import { PAGE_GUTTER } from '../components/ui/pageGutter';

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
        <CategoryIcon icon={goal.icon} size={20} className="text-current" />
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
  onFiles,
}: {
  goal: Goal;
  accountName: string | null;
  replacementName: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: GoalStatus) => void;
  onFiles: () => void;
}) {
  const { pct, remaining } = progressOf(goal);
  const complete = remaining === 0 && goal.targetAmount > 0 && goal.fundingComplete !== false;
  const schedule = scheduleOf(goal, remaining);
  const navigate = useNavigate();
  // A category-funded goal's money lives in its category: the row opens it (#235). A goal
  // tracked by hand has nowhere else to go, so its row opens the edit dialog. The row is for
  // the pointer; the keyboard has one control per destination (the name's link, Edit).
  const open = goal.categoryId ? () => navigate(`/budget/category/${goal.categoryId}`) : onEdit;
  const details = [
    goal.categoryId && goal.categoryName,
    schedule && `Target ${schedule.date}`,
    accountName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      onClick={open}
      data-testid="goal-row"
      className="px-5 py-4 hover:bg-hover cursor-pointer transition-colors last:rounded-b-lg"
    >
      <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1">
        <GoalIcon goal={goal} />
        <div className="min-w-0 flex-1">
          {/* Phones: a long name wraps to two lines rather than lose its end to the actions */}
          <span className="text-sm font-medium text-text flex items-start md:items-center gap-2 min-w-0">
            {goal.categoryId ? (
              // Says where the row leads; a click anywhere else on the row goes the same way
              <Link
                to={`/budget/category/${goal.categoryId}`}
                aria-label={`${goal.name}: open ${goal.categoryName ?? 'its category'} in Budget`}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 break-words max-md:line-clamp-2 md:truncate hover:text-brand-600"
              >
                {goal.name}
              </Link>
            ) : (
              <span className="min-w-0 break-words max-md:line-clamp-2 md:truncate">
                {goal.name}
              </span>
            )}
            {goal.status !== 'active' && (
              <span className="text-2xs font-medium rounded px-1.5 py-0.5 bg-surface-alt text-text-secondary">
                {STATUS_LABEL[goal.status]}
              </span>
            )}
          </span>
          <span className="text-xs text-text-tertiary mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="rounded px-1.5 py-0.5 bg-surface-alt text-text-secondary font-medium">
              {goal.categoryId ? 'Category funded' : 'Tracked by hand'}
            </span>
            {details}
          </span>
        </div>
        <div className="text-right shrink-0 max-md:col-span-2 max-md:col-start-2 max-md:row-start-2 max-md:flex max-md:items-baseline max-md:gap-1.5 max-md:text-left">
          <span className="text-sm font-medium tabular-nums text-text block">
            {formatCurrency(amountOf(goal))}
          </span>
          <span className="text-xs text-text-tertiary tabular-nums block mt-0.5 max-md:mt-0">
            of {formatCurrency(goal.targetAmount)}
          </span>
        </div>
        <div className="max-md:col-start-3 max-md:row-start-1 flex items-center gap-1">
          {/* Edit and the menu act on their own; the chevron beside them is part of the row */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Edit on every row, whichever way the row itself opens */}
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${goal.name}`}
              title="Edit goal"
              className="w-9 h-9 max-md:w-11 max-md:h-11 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-hover hover:text-text-secondary transition-colors"
            >
              <Pencil size={14} aria-hidden />
            </button>
            <RowMenu
              items={[
                { label: 'Edit goal', onClick: onEdit },
                { label: 'Files', onClick: onFiles },
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
          {/* A quiet cue that this row leads to its category (#235); a hand-tracked row has none */}
          {goal.categoryId && (
            <ChevronRight
              size={16}
              aria-hidden
              data-testid="goal-opens-category"
              className="text-text-tertiary shrink-0"
            />
          )}
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
        <p className="mt-2 text-xs text-text-secondary max-md:pl-12">
          <span>
            {goal.fundingComplete === false
              ? 'Funding assessment incomplete — check exchange rates.'
              : `Assigned this month ${formatCurrency(goal.assignedThisMonth ?? 0)} · Activity ${formatCurrency(goal.activity ?? 0)} · Available ${formatCurrency(goal.available ?? 0)}`}
          </span>
          {/* Progress comes only from the category, which the row opens; its spending is here */}
          <span
            className="ml-2 inline-flex gap-3 max-md:ml-0 max-md:flex max-md:gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              to={transactionsLink({ categoryIds: [goal.categoryId], datePreset: 'all' })}
              className="text-brand-600 hover:text-brand-700 max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:pr-3"
            >
              Transactions
            </Link>
          </span>
        </p>
      )}
      <div className="mt-3 pl-12">
        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${complete ? 'bg-positive' : 'bg-brand-500'}`}
            style={{ width: complete ? '100%' : `${pct}%` }}
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
  onFiles,
  defaultCollapsed = false,
}: {
  label: string;
  goals: Goal[];
  accountNames: Map<string, string>;
  goalNames: Map<string, string>;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  onStatus: (g: Goal, status: GoalStatus) => void;
  onFiles: (g: Goal) => void;
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
              onFiles={() => onFiles(goal)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  // Back and Forward return to where this list was (#245)
  const scrollMemory = useScrollMemory('goals');
  const goalsQuery = useGoals();
  const { data: goals = [], isLoading } = goalsQuery;
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
  const [filesGoal, setFilesGoal] = useState<Goal | null>(null);
  const filesModal = useModalValue(filesGoal);
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
    onFiles: setFilesGoal,
  };

  // Goals linked to one account can each count the same money; unlinked manual values can't be checked
  const sharedAccounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of goals) {
      if (g.accountId && g.status !== 'retired') {
        counts.set(g.accountId, (counts.get(g.accountId) ?? 0) + 1);
      }
    }
    return [...counts]
      .filter(([, n]) => n > 1)
      .map(([id]) => accountNames.get(id))
      .filter((n): n is string => Boolean(n));
  }, [goals, accountNames]);

  // Next step: the category-funded goal furthest from its target is where moving money helps most
  const nextGoal = inProgress
    .filter((g) => g.categoryId)
    .sort((a, b) => progressOf(b).remaining - progressOf(a).remaining)[0];
  const inProgressLeft = inProgress.reduce((s, g) => s + progressOf(g).remaining, 0);

  const totalSaved = goals.reduce((s, g) => s + amountOf(g), 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const overallPct = totalTarget > 0 ? Math.floor((totalSaved / totalTarget) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className={`py-4 border-b border-border shrink-0 ${PAGE_GUTTER}`}>
          <div className="h-5 w-32 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className={`py-6 space-y-2 ${PAGE_GUTTER}`}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div
        className={`py-4 border-b border-border shrink-0 flex items-center justify-between ${PAGE_GUTTER}`}
      >
        <h1 className="font-display text-title max-md:text-2xl tracking-tight text-text">Goals</h1>
        <Button size="sm" onClick={() => setAddOpen(true)} data-guide="goals.add">
          <Plus size={14} /> Add goal
        </Button>
      </div>

      {!loadFailed(goalsQuery) && (
        <QueryProblem what="goals" query={goalsQuery} className="mx-6 mt-4 max-md:mx-4" />
      )}
      {loadFailed(goalsQuery) ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <QueryProblem what="goals" query={goalsQuery} />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <EmptyState
            icon={<Target size={26} />}
            title="Save for what matters"
            description="Set a target like an emergency fund, a trip or a new car, and see how close you are and how much to set aside each month."
            learnMore="goals"
            actions={
              <Button onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add goal
              </Button>
            }
          />
        </div>
      ) : hideBalances ? (
        <div className={`flex-1 overflow-y-auto pt-5 ${PAGE_GUTTER}`}>
          <SafeModeNotice title="Goals are hidden in Safe mode" />
        </div>
      ) : (
        <div ref={scrollMemory} className="flex-1 overflow-y-auto">
          <div className={`pt-5 pb-6 space-y-4 ${PAGE_GUTTER}`}>
            {sharedAccounts.length > 0 && (
              <p className="text-sm text-text-secondary rounded-lg bg-caution-subtle px-3 py-2">
                {sharedAccounts.join(' and ')} {sharedAccounts.length > 1 ? 'are' : 'is'} linked to
                more than one goal, so the same money may be counted twice in these totals.
              </p>
            )}
            <section aria-label="Goal progress" className="pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-text-secondary">
                  <span className="text-xl font-semibold tabular-nums text-text">
                    {formatCurrency(totalSaved)}
                  </span>{' '}
                  saved of {formatCurrency(totalTarget)}
                </p>
                <p className="text-sm tabular-nums text-text-secondary">
                  {completed.length} of {goals.length} reached
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Saved across all goals"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallPct}
                className="mt-2.5 h-2 rounded-full bg-surface-alt overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${Math.min(100, overallPct)}%` }}
                />
              </div>
            </section>
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
            {inProgress.length > 0 && (
              <p className="px-1 text-sm text-text-secondary">
                {formatCurrency(inProgressLeft)} left to save across {inProgress.length} goal
                {inProgress.length !== 1 ? 's' : ''}.
                {nextGoal && (
                  <>
                    {' '}
                    <Link
                      to={`/budget/category/${nextGoal.categoryId}`}
                      className="text-brand-600 hover:text-brand-700 max-md:inline-flex max-md:min-h-11 max-md:items-center"
                    >
                      Assign money to {nextGoal.name}
                    </Link>
                  </>
                )}
              </p>
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

      {filesModal.value && (
        <Modal
          isOpen={filesModal.isOpen}
          onClose={() => setFilesGoal(null)}
          title={`Files: ${filesModal.value.name}`}
          size="lg"
        >
          <FilesSection kind="goal" targetId={filesModal.value.id} />
        </Modal>
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? deleteGoal.mutateAsync(deleting.id) : undefined)}
        pendingLabel="Deleting…"
        title="Delete goal"
        message={deleteGoalMessage(deleting)}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
