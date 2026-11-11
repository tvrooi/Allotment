import { describe, expect, it } from 'vitest';
import { isPageShortcut, isPaletteShortcut, modifierKeyName } from './pageShortcut';

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

describe('isPaletteShortcut', () => {
  const field = { tagName: 'INPUT' };

  it('opens on ⌘K or Ctrl+K, even from a field', () => {
    expect(isPaletteShortcut(key('k', { metaKey: true }), false)).toBe(true);
    expect(isPaletteShortcut(key('K', { ctrlKey: true }), false)).toBe(true);
    expect(isPaletteShortcut(key('k', { metaKey: true, target: field }), false)).toBe(true);
  });

  it('leaves K alone without the modifier, or with Alt or Shift too', () => {
    expect(isPaletteShortcut(key('k'), false)).toBe(false);
    expect(isPaletteShortcut(key('k', { metaKey: true, altKey: true }), false)).toBe(false);
    expect(isPaletteShortcut(key('k', { ctrlKey: true, shiftKey: true }), false)).toBe(false);
  });

  it('opens on / from the page, but not while typing', () => {
    expect(isPaletteShortcut(key('/'), false)).toBe(true);
    expect(isPaletteShortcut(key('/', { target: field }), false)).toBe(false);
    expect(isPaletteShortcut(key('/', { target: { tagName: 'TEXTAREA' } }), false)).toBe(false);
  });

  it('does nothing while a dialog is open, or once something else handled the key', () => {
    expect(isPaletteShortcut(key('k', { metaKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(key('/'), true)).toBe(false);
    expect(isPaletteShortcut(key('k', { ctrlKey: true, defaultPrevented: true }), false)).toBe(
      false,
    );
  });
});

describe('modifierKeyName', () => {
  it('says Cmd on Apple devices and Ctrl elsewhere', () => {
    expect(modifierKeyName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Cmd');
    expect(modifierKeyName('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('Cmd');
    expect(modifierKeyName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Ctrl');
    expect(modifierKeyName('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Ctrl');
  });
});
