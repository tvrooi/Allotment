import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  PULL_THRESHOLD,
  atTopOfEverything,
  isPullGesture,
  pullDistance,
} from '../utils/pullToRefresh';

/**
 * Pull to refresh for a scrolling area on a touch screen. The page frame doesn't bounce
 * (html and body have overscroll-behavior: none), so the browser's own pull to refresh can't
 * happen: this brings it back inside the content area. Dragging down from the very top moves an
 * indicator; letting go past the threshold calls `onRefresh`.
 *
 * Returns how far the indicator has moved and whether a refresh is running.
 */
export function usePullToRefresh(
  scroller: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown> | void,
  enabled = true,
) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let pulling: boolean | null = null;
    let current = 0;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      if (!atTopOfEverything(e.target as Element, el)) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pulling = null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (pulling === null) {
        pulling = isPullGesture(dx, dy);
        if (pulling === false) {
          start = null;
          return;
        }
        if (pulling === null) return;
      }
      // The page isn't scrolling, so stop the browser treating this as a scroll
      if (e.cancelable) e.preventDefault();
      current = pullDistance(dy);
      setDistance(current);
    };
    const onEnd = () => {
      if (!start) return;
      start = null;
      const reached = pulling && current >= PULL_THRESHOLD;
      pulling = null;
      current = 0;
      if (!reached) {
        setDistance(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(PULL_THRESHOLD);
      Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => undefined)
        .finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setDistance(0);
        });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scroller, enabled]);

  return { distance, refreshing };
}
