import { create } from 'zustand';

export interface UndoCommand {
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_STACK = 50;

/** Runs after every undo or redo that succeeds (main.tsx refreshes the ledger views) */
let afterChange: () => unknown = () => {};
export const setAfterUndoChange = (fn: () => unknown) => {
  afterChange = fn;
};

interface UndoState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
  toastMessage: string | null;
  /** undo/redo: what was just undone or redone; done: an action that Undo reverses; note: a message */
  toastAction: 'undo' | 'redo' | 'done' | 'note' | null;
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
    } catch {
      set((s) => ({ undoStack: [...s.undoStack, cmd] }));
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
    } catch {
      set((s) => ({ redoStack: [...s.redoStack, cmd] }));
    }
  },

  clearToast() {
    set({ toastMessage: null, toastAction: null });
  },

  announce(message, undoable) {
    set({ toastMessage: message, toastAction: undoable ? 'done' : 'note' });
  },
}));
