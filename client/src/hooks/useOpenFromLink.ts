import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens a dialog when the page is reached with `?<param>=1` (e.g. `/transactions?add=1`
 * from a button on the dashboard), then drops the parameter so going back or reloading
 * doesn't open it again. A specific value can identify an item; ready waits for its query.
 */
export function useOpenFromLink(
  param: string,
  open: () => void,
  { value = '1', ready = true }: { value?: string | null; ready?: boolean } = {},
) {
  const [params, setParams] = useSearchParams();
  const openRef = useRef(open);
  openRef.current = open;

  const requested = value != null && params.get(param) === value;
  useEffect(() => {
    if (!requested || !ready) return;
    openRef.current();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [requested, ready, value, param, setParams]);
}
