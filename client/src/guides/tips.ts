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
  payeeDefault: {
    id: 'payees.default-category',
    text: 'Give a payee a default category and its new transactions are sorted for you.',
  },
  reviewComplete: {
    id: 'review.mark-complete',
    text: 'Done for now? Record today’s review to compare figures next time. Unresolved items stay open.',
  },
  findRecurring: {
    id: 'recurring.find',
    text: 'Find recurring looks through your history for bills and pay that repeat, and suggests them.',
  },
  todaysDollars: {
    id: 'forecast.todays-dollars',
    text: 'Today’s dollars takes inflation out, so a figure decades away reads like money now. Future dollars shows the actual amounts.',
  },
  budgetCarry: {
    id: 'budget.carry-forward',
    text: 'What’s left in a category carries into next month, so you can save up for bigger bills.',
  },
} satisfies Record<string, TipDef>;
