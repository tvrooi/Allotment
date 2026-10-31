import type { TipDef } from './types';

// Short tips shown once, in context, while tips are on (Settings → Preferences). One at a time.
export const TIPS = {
  safeModeKey: {
    id: 'dashboard.safe-mode-key',
    text: 'Press Alt+Shift+H to hide amounts on screen at any time, and again to show them.',
  },
  undoKey: {
    id: 'transactions.undo-key',
    text: 'Changed something by mistake? Ctrl+Z (⌘Z on a Mac) undoes it, and Ctrl+Shift+Z redoes it.',
  },
  budgetCarry: {
    id: 'budget.carry-forward',
    text: 'What’s left in a category carries into next month, so you can save up for bigger bills.',
  },
} satisfies Record<string, TipDef>;
