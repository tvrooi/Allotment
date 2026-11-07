import type { Goal } from '../types';

/** What deleting a goal does, in the words its confirmation uses. Undo recreates the goal
 * (`recreateGoal` in hooks/useGoals.ts), so the copy names exactly what that leaves out: a
 * deleted goal's file links go with it, and it comes back active (UX audit AU-009). */
export function deleteGoalMessage(goal: Pick<Goal, 'name' | 'status'> | null) {
  if (!goal) return '';
  const back = goal.status === 'active' ? '' : ', and it comes back as active';
  return `Delete "${goal.name}"? You can undo this, but files attached to it are unlinked (they stay in Files)${back}.`;
}
