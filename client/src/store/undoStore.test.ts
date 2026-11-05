import { beforeEach, describe, expect, it } from 'vitest';
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
