import { useLayoutEffect, useRef, useState } from 'react';
import { Plant, plantStage } from '../ui/Plant';
import { nextBloom } from './growth';

/**
 * The plant at the end of a goal's bar (#241). A reached goal blooms once, the first time this
 * device sees it reached, whether the row opens reached or the goal is reached while you watch;
 * the plant grows in place when its stage changes while you watch. Arriving on the page plays
 * nothing else, and reduced motion shows each stage still (index.css).
 */
export function GoalPlant({
  goalId,
  pct,
  complete,
}: {
  goalId: string;
  pct: number;
  complete: boolean;
}) {
  const stage = plantStage(pct, complete);
  // Follows `complete` while the row is on the page, still once per goal per device. Decided only
  // in a layout effect, on mount too: a render React throws away (a suspended mount) must not use
  // up the goal's one bloom, and StrictMode runs render and updaters twice, where the second
  // firstBloom answers false. The ref makes a repeated run with the same `complete` a no-op, and
  // the layout effect runs before paint, so the flower's first paint already carries the bloom.
  const [bloom, setBloom] = useState(false);
  const seen = useRef({ complete: false, bloom: false });
  useLayoutEffect(() => {
    const next = nextBloom(goalId, seen.current.complete, complete, seen.current.bloom);
    seen.current = { complete, bloom: next };
    setBloom(next);
  }, [goalId, complete]);
  // A stage reached while the page is open grows in; the stage it opened on does not
  const [shown, setShown] = useState(stage);
  const [grew, setGrew] = useState(false);
  if (shown !== stage) {
    setShown(stage);
    setGrew(true);
  }
  const blooming = bloom && stage === 'flower';
  return (
    <Plant
      key={stage}
      stage={stage}
      bloom={blooming}
      grew={grew}
      data-testid="goal-plant"
      data-stage={stage}
      data-bloom={blooming}
    />
  );
}
