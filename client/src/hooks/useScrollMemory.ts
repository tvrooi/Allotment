import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { recallScroll, rememberScroll, restoreScroll } from '../utils/scrollMemory';

/**
 * Remembers a page-level scroll container's offset for each history entry and puts it back on
 * browser Back and Forward (#245); a fresh visit to another page starts at the top. Works the
 * same under the browser and hash routers, as both give every entry a key. `name` tells apart
 * the containers that are on screen together (the shell's main and a page's own list).
 * Returns a callback ref for the container.
 */
export function useScrollMemory(name: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const location = useLocation();
  const navigation = useNavigationType();
  const key = `${location.key}:${name}`;
  // Which entry a scroll belongs to; set during the commit, so a scroll event the browser
  // fires after the next page replaced this one (the offset clamped) is never filed under
  // the entry being left
  const current = useRef(key);
  const path = useRef(location.pathname);

  useLayoutEffect(() => {
    current.current = key;
    if (!el) return;
    const samePage = path.current === location.pathname;
    path.current = location.pathname;
    const saved = navigation === 'POP' ? recallScroll(key) : undefined;
    if (saved) return restoreScroll(el, saved);
    if (!samePage) el.scrollTop = 0;
  }, [el, key, navigation, location.pathname]);

  useEffect(() => {
    if (!el) return;
    const save = () => rememberScroll(current.current, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [el]);

  return setEl;
}
