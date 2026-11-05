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

interface UndoState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  toastMessage: string | null;
  /**
   * undo/redo: what was just undone or redone; done: an action that Undo reverses; note: a message;
   * error: an undo or redo that did not happen, and why
   */
  toastAction: 'undo' | 'redo' | 'done' | 'note' | 'error' | null;
}

interface UndoActions {
  push: (cmd: UndoCommand) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearToast: () => void;
  /** Show what just happened, with Undo when it pushed an undo command */
  announce: (message: string, undoable: boolean) => void;
}

export const useUndoStore = create<UndoState & UndoActions>((set, get) => ({
  undoStack: [],
  redoStack: [],
  toastMessage: null,
  toastAction: null,

  push(cmd) {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_STACK - 1)), cmd],
      redoStack: [],
    }));
  },

  async undo() {
    const { undoStack, redoStack } = get();
    const cmd = undoStack[undoStack.length - 1];
    if (!cmd) return;
    set({ undoStack: undoStack.slice(0, -1) });
    try {
      await cmd.undo();
      void afterChange();
      set({
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
      set({
        undoStack: [...undoStack, cmd],
        toastMessage: cmd.description,
        toastAction: 'redo',
      });
    } catch (e) {
      set((s) => ({
        ...(isConflict(e) ? {} : { redoStack: [...s.redoStack, cmd] }),
        ...failure('redo', cmd, e),
      }));
    }
  },

  clearToast() {
    set({ toastMessage: null, toastAction: null });
  },

  announce(message, undoable) {
    set({ toastMessage: message, toastAction: undoable ? 'done' : 'note' });
  },
}));
