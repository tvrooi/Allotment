import { describe, expect, it } from 'vitest';
import { deleteGoalMessage } from './deleteGoalMessage';

// UX audit AU-009: deleting a goal can be undone, so the confirmation must not say otherwise,
// and it names what undo leaves out (file links, a non-active status)
describe('deleteGoalMessage', () => {
  it('offers undo and never calls a goal deletion permanent', () => {
    const text = deleteGoalMessage({ name: 'Holiday', status: 'active' });
    expect(text).toContain('Delete "Holiday"?');
    expect(text).toContain('You can undo this');
    expect(text).toMatch(/files attached to it are unlinked/);
    expect(text).not.toMatch(/cannot be undone/i);
    expect(text).not.toMatch(/comes back as active/);
  });

  it('says a paused, completed or retired goal comes back active', () => {
    for (const status of ['paused', 'completed', 'retired'] as const) {
      expect(deleteGoalMessage({ name: 'Car', status })).toMatch(/comes back as active\.$/);
    }
  });

  it('is empty while nothing is being deleted', () => {
    expect(deleteGoalMessage(null)).toBe('');
  });
});
