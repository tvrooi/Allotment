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
});
