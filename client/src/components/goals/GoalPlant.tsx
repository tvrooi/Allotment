import { useState } from 'react';
import { Plant, plantStage } from '../ui/Plant';
import { firstBloom } from './growth';

/**
 * The plant at the end of a goal's bar (#241). A reached goal blooms once, the first time this
 * device sees it; the plant grows in place when its stage changes while you watch. Arriving on
 * the page plays nothing else, and reduced motion shows each stage still (index.css).
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
  // Decided once per mount, so a re-render never replays it
  const [bloom] = useState(() => complete && firstBloom(goalId));
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
