import { createPortal } from 'react-dom';
import { UndoToast } from './UndoToast';
import { CategoryFollowupToast } from '../transactions/CategoryFollowupToast';
import { DemoFirstEditToast } from '../demo/DemoFirstEditToast';

/**
 * Toasts stack at the bottom centre, so a follow-up and an undo never cover each other. They
 * render on <body>, outside the app, so they're still announced and usable while an open
 * dialog makes the app inert (utils/inertRoot.ts).
 */
export function Toasts({ aboveTabBar = false }: { aboveTabBar?: boolean }) {
  return createPortal(
    // Phones: clear of the tab bar (PhoneTabBar.tsx, 3.5rem tall above the home indicator)
    <div
      className={`fixed ${aboveTabBar ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom))]'} inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none`}
    >
      <CategoryFollowupToast />
      <UndoToast />
      <DemoFirstEditToast />
    </div>,
    document.body,
  );
}
