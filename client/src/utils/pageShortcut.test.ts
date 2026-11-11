import { describe, expect, it } from 'vitest';
import { isPageShortcut } from './pageShortcut';

const key = (k: string, more: Partial<Parameters<typeof isPageShortcut>[0]> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  target: { tagName: 'BODY', isContentEditable: false },
  ...more,
});

describe('isPageShortcut', () => {
  it('answers its own key on the page', () => {
    expect(isPageShortcut(key('n'), 'n', false)).toBe(true);
    expect(isPageShortcut(key('m'), 'n', false)).toBe(false);
  });

  it('leaves typing alone: fields, menus and editable text', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isPageShortcut(key('n', { target: { tagName } }), 'n', false), tagName).toBe(false);
    }
    const editable = { tagName: 'DIV', isContentEditable: true };
    expect(isPageShortcut(key('n', { target: editable }), 'n', false)).toBe(false);
  });

  it('leaves a key held with Ctrl, ⌘ or Alt to the browser and system', () => {
    expect(isPageShortcut(key('n', { ctrlKey: true }), 'n', false)).toBe(false);
    expect(isPageShortcut(key('n', { metaKey: true }), 'n', false)).toBe(false);
    expect(isPageShortcut(key('n', { altKey: true }), 'n', false)).toBe(false);
  });

  it('does nothing when something else already handled the key', () => {
    expect(isPageShortcut(key('n', { defaultPrevented: true }), 'n', false)).toBe(false);
  });

  it('does nothing while a dialog is open', () => {
    expect(isPageShortcut(key('n'), 'n', true)).toBe(false);
  });

  it('works with no target (a key event sent to the window)', () => {
    expect(isPageShortcut(key('?', { target: null }), '?', false)).toBe(true);
  });
});
