// A code-split module the shell loads on demand (the search palette). Unlike React.lazy, a
// failed load (offline before the chunk was ever fetched) is not remembered: the next call tries
// again. `warm` fetches it in the background while connected, so the service worker (public/sw.js)
// keeps a copy for offline use.

export interface RetryingImport<T> {
  /** The module, fetching it if needed; rejects when it can't be fetched (try again later) */
  load: () => Promise<T>;
  /** Fetches it in the background, ignoring a failure */
  warm: () => void;
}

export function retryingImport<T>(importer: () => Promise<T>): RetryingImport<T> {
  let pending: Promise<T> | null = null;
  const load = () =>
    (pending ??= importer().catch((err: unknown) => {
      pending = null;
      throw err;
    }));
  return { load, warm: () => void load().catch(() => {}) };
}
