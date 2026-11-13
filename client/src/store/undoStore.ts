import { create } from 'zustand';

export interface UndoCommand {
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_STACK = 50;

/**
 * The server refused because the data moved on since the command was recorded (a competing
 * edit): running it again can only fail the same way, so the command is dropped.
 */
const isConflict = (e: unknown) => (e as { status?: number } | null)?.status === 409;

function failure(verb: 'undo' | 'redo', cmd: UndoCommand, e: unknown) {
  const reason = e instanceof Error && e.message ? e.message : 'Try again.';
  return {
    toastMessage: `Couldn't ${verb} ${cmd.description.toLowerCase()}. ${reason} ${
      isConflict(e) ? 'It changed since, so nothing was touched.' : 'Nothing was changed.'
    }`,
    toastAction: 'error' as const,
  };
}

/** Runs after every undo or redo that succeeds (main.tsx refreshes the ledger views) */
let afterChange: () => unknown = () => {};
export const setAfterUndoChange = (fn: () => unknown) => {
  afterChange = fn;
};

export interface PushOptions {
  /** What the toast says; the command's description when left out */
  message?: string;
  /** Record the command without a toast (onboarding sorting announces nothing on purpose) */
  quiet?: boolean;
}

type ToastAction = 'undo' | 'redo' | 'done' | 'note' | 'error';

/** How long a toast stays: one that offers Undo, and an error, 8 s; any other 4 s */
function toastMs(action: ToastAction | null) {
  return action === 'done' || action === 'redo' || action === 'error' ? 8000 : 4000;
}

// The toast's own timer lives here, so a toast held by the pointer or focus never times out
let toastTimer: ReturnType<typeof setTimeout> | undefined;

interface UndoState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  toastMessage: string | null;
  /**
   * undo/redo: what was just undone or redone; done: an action that Undo reverses; note: a message;
   * error: an undo or redo that did not happen, and why
   */
  toastAction: ToastAction | null;
  /** The pointer is over the toast or focus is inside it: it waits */
  toastHeld: boolean;
}

interface UndoActions {
  /**
   * Record an undo command and announce it with Undo. Announcing is part of pushing, so no
   * undoable change goes by silently; `quiet` is the explicit exception.
   */
  push: (cmd: UndoCommand, options?: PushOptions) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearToast: () => void;
  /** Show what just happened, with Undo when it pushed an undo command */
  announce: (message: string, undoable: boolean) => void;
  holdToast: (held: boolean) => void;
}

export const useUndoStore = create<UndoState & UndoActions>((set, get) => {
  /** (Re)starts the toast's timer for whatever it shows now */
  const time = () => {
    clearTimeout(toastTimer);
    const { toastMessage, toastAction, toastHeld } = get();
    if (!toastMessage || toastHeld) return;
    toastTimer = setTimeout(() => get().clearToast(), toastMs(toastAction));
  };
  const show = (toast: Partial<UndoState>) => {
    set(toast);
    time();
  };

  return {
    undoStack: [],
    redoStack: [],
    toastMessage: null,
    toastAction: null,
    toastHeld: false,

    push(cmd, options = {}) {
      set((s) => ({
        undoStack: [...s.undoStack.slice(-(MAX_STACK - 1)), cmd],
        redoStack: [],
      }));
      if (!options.quiet)
        show({ toastMessage: options.message ?? cmd.description, toastAction: 'done' });
    },

    async undo() {
      const { undoStack, redoStack } = get();
      const cmd = undoStack[undoStack.length - 1];
      if (!cmd) return;
      set({ undoStack: undoStack.slice(0, -1) });
      try {
        await cmd.undo();
        void afterChange();
        show({
          redoStack: [...redoStack, cmd],
          toastMessage: cmd.description,
          toastAction: 'undo',
        });
      } catch (e) {
        // A conflict leaves the current figures as they are and forgets the stale command
        set((s) => ({
          ...(isConflict(e) ? {} : { undoStack: [...s.undoStack, cmd] }),
          ...failure('undo', cmd, e),
        }));
        time();
      }
    },

    async redo() {
      const { undoStack, redoStack } = get();
      const cmd = redoStack[redoStack.length - 1];
      if (!cmd) return;
      set({ redoStack: redoStack.slice(0, -1) });
      try {
        await cmd.redo();
        void afterChange();
        show({
          undoStack: [...undoStack, cmd],
          toastMessage: cmd.description,
          toastAction: 'redo',
        });
      } catch (e) {
        set((s) => ({
          ...(isConflict(e) ? {} : { redoStack: [...s.redoStack, cmd] }),
          ...failure('redo', cmd, e),
        }));
        time();
      }
    },

    clearToast() {
      clearTimeout(toastTimer);
      set({ toastMessage: null, toastAction: null, toastHeld: false });
    },

    announce(message, undoable) {
      show({ toastMessage: message, toastAction: undoable ? 'done' : 'note' });
    },

    holdToast(held) {
      if (get().toastHeld === held) return;
      set({ toastHeld: held });
      // Let go: it gets its full time again
      time();
    },
  };
});
