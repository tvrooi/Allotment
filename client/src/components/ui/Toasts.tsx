import { UndoToast } from './UndoToast';
import { CategoryFollowupToast } from '../transactions/CategoryFollowupToast';

/** Toasts stack at the bottom centre, so a follow-up and an undo never cover each other */
export function Toasts() {
  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <CategoryFollowupToast />
      <UndoToast />
    </div>
  );
}
