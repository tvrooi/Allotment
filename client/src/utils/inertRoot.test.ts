import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdRootInert } from './inertRoot';

describe('holdRootInert', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the app inert until every holder has released', () => {
    const root = { inert: false };
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'root' ? root : null) });

    const dialog = holdRootInert();
    const guide = holdRootInert();
    expect(root.inert).toBe(true);
    dialog();
    dialog(); // releasing twice counts once
    expect(root.inert).toBe(true);
    guide();
    expect(root.inert).toBe(false);
  });

  it('puts inert back when something else clears it while held', () => {
    const root = { inert: false };
    vi.stubGlobal('document', { getElementById: (id: string) => (id === 'root' ? root : null) });
    const watchers: { callback: () => void; disconnected: boolean }[] = [];
    vi.stubGlobal(
      'MutationObserver',
      class {
        entry: { callback: () => void; disconnected: boolean };
        constructor(callback: () => void) {
          this.entry = { callback, disconnected: false };
          watchers.push(this.entry);
        }
        observe() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );

    const dialog = holdRootInert();
    expect(watchers).toHaveLength(1);
    // React Aria's ariaHideOutside cleanup, as a Combobox list closes inside the dialog
    root.inert = false;
    watchers[0].callback();
    expect(root.inert).toBe(true);

    dialog();
    expect(root.inert).toBe(false);
    expect(watchers[0].disconnected).toBe(true);
  });
});
