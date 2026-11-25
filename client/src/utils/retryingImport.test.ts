import { describe, expect, it, vi } from 'vitest';
import { retryingImport } from './retryingImport';

describe('retryingImport', () => {
  it('fetches once and shares the result', async () => {
    const importer = vi.fn(async () => ({ default: 'palette' }));
    const palette = retryingImport(importer);
    palette.warm();
    expect(await palette.load()).toEqual({ default: 'palette' });
    expect(await palette.load()).toEqual({ default: 'palette' });
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load, then tries again next time instead of staying broken', async () => {
    const importer = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: 'palette' });
    const palette = retryingImport(importer);
    await expect(palette.load()).rejects.toThrow('Failed to fetch');
    expect(await palette.load()).toEqual({ default: 'palette' });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('warming ignores a failure, and leaves the next load free to retry', async () => {
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('palette');
    const palette = retryingImport(importer);
    palette.warm();
    await vi.waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(await palette.load()).toBe('palette');
  });
});
