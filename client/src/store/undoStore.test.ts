import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUndoStore, type UndoCommand } from './undoStore';

const conflict = Object.assign(new Error('Your budget changed. Refresh before editing.'), {
  status: 409,
});

function command(over: Partial<UndoCommand> = {}): UndoCommand {
  return {
    description: 'Set budget',
    undo: async () => {},
    redo: async () => {},
    ...over,
  };
}

describe('undo store failures', () => {
  beforeEach(() => {
    useUndoStore.setState({ undoStack: [], redoStack: [], toastMessage: null, toastAction: null });
  });

  it('a conflicting undo says so, forgets the stale command and runs nothing more', async () => {
    let calls = 0;
    useUndoStore.getState().push(
      command({
        undo: async () => {
          calls++;
          throw conflict;
        },
      }),
    );
    await useUndoStore.getState().undo();
    const s = useUndoStore.getState();
    expect(s.toastAction).toBe('error');
    expect(s.toastMessage).toContain("Couldn't undo set budget");
    expect(s.toastMessage).toContain('Your budget changed');
    expect(s.toastMessage).toContain('nothing was touched');
    expect(s.undoStack).toHaveLength(0);
    expect(s.redoStack).toHaveLength(0);
    await useUndoStore.getState().undo();
    expect(calls).toBe(1);
  });

  it('a failed undo that is not a conflict (offline) keeps the command to try again', async () => {
    useUndoStore.getState().push(
      command({
        undo: async () => {
          throw new Error('Could not reach the server.');
        },
      }),
    );
    await useUndoStore.getState().undo();
    const s = useUndoStore.getState();
    expect(s.toastAction).toBe('error');
    expect(s.toastMessage).toContain('Could not reach the server.');
    expect(s.undoStack).toHaveLength(1);
  });

  it('a conflicting redo is reported and dropped; a good undo still offers redo', async () => {
    useUndoStore.getState().push(
      command({
        redo: async () => {
          throw conflict;
        },
      }),
    );
    await useUndoStore.getState().undo();
    expect(useUndoStore.getState().toastAction).toBe('undo');
    expect(useUndoStore.getState().redoStack).toHaveLength(1);
    await useUndoStore.getState().redo();
    const s = useUndoStore.getState();
    expect(s.toastAction).toBe('error');
    expect(s.toastMessage).toContain("Couldn't redo set budget");
    expect(s.redoStack).toHaveLength(0);
    expect(s.undoStack).toHaveLength(0);
  });
});

describe('undo toast announcements (#245)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUndoStore.getState().clearToast();
    useUndoStore.setState({ undoStack: [], redoStack: [] });
  });
  afterEach(() => {
    useUndoStore.getState().clearToast();
    vi.useRealTimers();
  });

  it('pushing an undo command announces it with Undo', () => {
    useUndoStore.getState().push(command({ description: 'Categorise 3 saver transfers' }));
    const s = useUndoStore.getState();
    expect(s.toastMessage).toBe('Categorise 3 saver transfers');
    expect(s.toastAction).toBe('done');
  });

  it('a push can say something else, or stay quiet on purpose', () => {
    useUndoStore.getState().push(command(), { message: 'Sorted Mock Shop as Groceries.' });
    expect(useUndoStore.getState().toastMessage).toBe('Sorted Mock Shop as Groceries.');
    useUndoStore.getState().clearToast();
    useUndoStore.getState().push(command(), { quiet: true });
    expect(useUndoStore.getState().toastMessage).toBeNull();
    expect(useUndoStore.getState().undoStack).toHaveLength(2);
  });

  it('a toast that offers Undo stays 8 seconds', () => {
    useUndoStore.getState().push(command());
    vi.advanceTimersByTime(7_999);
    expect(useUndoStore.getState().toastMessage).toBe('Set budget');
    vi.advanceTimersByTime(1);
    expect(useUndoStore.getState().toastMessage).toBeNull();
  });

  it('does not time out while held (pointer over it or focus inside), then starts again', () => {
    useUndoStore.getState().push(command());
    vi.advanceTimersByTime(5_000);
    useUndoStore.getState().holdToast(true);
    vi.advanceTimersByTime(60_000);
    expect(useUndoStore.getState().toastMessage).toBe('Set budget');
    useUndoStore.getState().holdToast(false);
    vi.advanceTimersByTime(7_999);
    expect(useUndoStore.getState().toastMessage).toBe('Set budget');
    vi.advanceTimersByTime(1);
    expect(useUndoStore.getState().toastMessage).toBeNull();
  });

  it('a new announcement restarts the time, even with the same words', () => {
    useUndoStore.getState().push(command());
    vi.advanceTimersByTime(6_000);
    useUndoStore.getState().push(command());
    vi.advanceTimersByTime(6_000);
    expect(useUndoStore.getState().toastMessage).toBe('Set budget');
  });

  it('notes and Redo offers keep 4 seconds; errors keep 8', async () => {
    useUndoStore.getState().announce('Nothing to share.', false);
    vi.advanceTimersByTime(4_000);
    expect(useUndoStore.getState().toastMessage).toBeNull();

    useUndoStore.getState().push(command(), { quiet: true });
    await useUndoStore.getState().undo();
    expect(useUndoStore.getState().toastAction).toBe('undo');
    vi.advanceTimersByTime(4_000);
    expect(useUndoStore.getState().toastMessage).toBeNull();

    useUndoStore.getState().push(
      command({
        undo: async () => {
          throw new Error('Could not reach the server.');
        },
      }),
      { quiet: true },
    );
    await useUndoStore.getState().undo();
    vi.advanceTimersByTime(7_999);
    expect(useUndoStore.getState().toastAction).toBe('error');
    vi.advanceTimersByTime(1);
    expect(useUndoStore.getState().toastMessage).toBeNull();
  });
});
