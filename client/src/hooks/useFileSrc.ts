import { useEffect, useState } from 'react';
import { IS_DEMO } from '../demo/isDemo';

/**
 * A stored file's address for an `<img>`, `<video>` or link. The server answers the API address
 * itself; the in-browser demo's API only answers `fetch` (demo/demoApi.ts), so there the file is
 * fetched and shown from a temporary blob address, released when the component goes. Undefined
 * while it loads, or when there is no file.
 */
export function useFileSrc(url: string | undefined): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string>();
  useEffect(() => {
    if (!IS_DEMO || !url) return;
    let cancelled = false;
    let made: string | undefined;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`File not loaded: ${r.status}`))))
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setBlobUrl(made);
      })
      .catch(() => !cancelled && setBlobUrl(undefined));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
      setBlobUrl(undefined);
    };
  }, [url]);
  return IS_DEMO ? blobUrl : url;
}
