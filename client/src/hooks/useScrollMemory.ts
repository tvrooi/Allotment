import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { createScrollTracker } from '../utils/scrollMemory';

/**
 * Remembers a page-level scroll container's offset for each history entry and puts it back on
 * browser Back and Forward (#245), and only then; a fresh visit to another page starts at the
 * top. Works the same under the browser and hash routers, as both give every entry a key.
 * `name` tells apart the containers that are on screen together (the shell's main and a
 * page's own list). Returns a callback ref for the container. The rules: utils/scrollMemory.ts.
 */
export function useScrollMemory(name: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const location = useLocation();
  const navigation = useNavigationType();
  const key = `${location.key}:${name}`;
  // Moved on during the commit, so a scroll event the browser fires after the next page
  // replaced this one (the offset clamped) is never filed under the entry being left
  const tracker = useRef<ReturnType<typeof createScrollTracker> | null>(null);
  tracker.current ??= createScrollTracker({ key, pathname: location.pathname }, navigation);

  useLayoutEffect(
    () => tracker.current!.enter(el, { key, pathname: location.pathname, navigation }),
    [el, key, navigation, location.pathname],
  );

  useEffect(() => (el ? tracker.current!.attach(el) : undefined), [el]);

  return setEl;
}
