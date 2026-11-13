import { useState } from 'react';
import { firstBloom, growthStage, type GrowthStage } from './growth';

const ORDER: GrowthStage[] = ['seed', 'sprout', 'leaf', 'bud', 'flower'];
const reached = (stage: GrowthStage, from: GrowthStage) =>
  ORDER.indexOf(stage) >= ORDER.indexOf(from);

/** Five petals around the flower's centre, at (10, 5) */
const PETALS = [0, 72, 144, 216, 288];

/**
 * The plant at the leading edge of a goal's bar (#241). Stems and leaves are Sprout green
 * (--color-positive); the bud and petals Marigold (--color-brand-500), the one bright accent.
 */
function Plant({ stage, bloom, grew }: { stage: GrowthStage; bloom: boolean; grew: boolean }) {
  const stemTop = { seed: 16, sprout: 12, leaf: 8.5, bud: 6.5, flower: 6.5 }[stage];
  return (
    <svg
      viewBox="0 0 20 20"
      width="26"
      height="26"
      aria-hidden
      focusable="false"
      data-testid="goal-plant"
      data-bloom={bloom}
      className={`block overflow-visible origin-bottom ${grew ? 'animate-grow-in' : ''}`}
      data-motion={grew || undefined}
    >
      {bloom && (
        <circle
          cx="10"
          cy="5"
          r="6"
          fill="none"
          strokeWidth="1"
          className="stroke-positive opacity-0 animate-bloom-ring"
          style={{ transformOrigin: '10px 5px' }}
          data-motion
        />
      )}
      <path
        d={`M10 19.5V${stemTop}`}
        strokeWidth="1.6"
        strokeLinecap="round"
        className="stroke-positive"
        fill="none"
      />
      {stage === 'seed' && <circle cx="10" cy="15.2" r="1.6" className="fill-positive" />}
      {reached(stage, 'sprout') && (
        <>
          <path
            d="M10 13.5C8.6 11 6.4 10.5 4.6 11.2c.9 2.3 3.1 3 5.4 2.3Z"
            className="fill-positive"
          />
          <path
            d="M10 13.5c1.4-2.5 3.6-3 5.4-2.3-.9 2.3-3.1 3-5.4 2.3Z"
            className="fill-positive"
          />
        </>
      )}
      {reached(stage, 'leaf') && (
        <>
          <path
            d="M10 10C9 8.2 7.4 7.8 6.1 8.3c.6 1.7 2.2 2.2 3.9 1.7Z"
            className="fill-positive"
          />
          <path
            d="M10 10c1-1.8 2.6-2.2 3.9-1.7-.6 1.7-2.2 2.2-3.9 1.7Z"
            className="fill-positive"
          />
        </>
      )}
      {stage === 'bud' && <ellipse cx="10" cy="5.3" rx="1.8" ry="2.4" className="fill-brand-500" />}
      {stage === 'flower' && (
        <>
          {PETALS.map((angle, i) => (
            <ellipse
              key={angle}
              cx="10"
              cy="2.4"
              rx="1.7"
              ry="2.5"
              className={`fill-brand-500 ${bloom ? 'animate-bloom' : ''}`}
              style={{
                transformOrigin: '10px 5px',
                rotate: `${angle}deg`,
                animationDelay: bloom ? `${i * 40}ms` : undefined,
              }}
              data-motion={bloom || undefined}
            />
          ))}
          <circle cx="10" cy="5" r="1.5" className="fill-brand-600" />
        </>
      )}
    </svg>
  );
}

/**
 * A goal's progress bar with a plant riding its leading edge: it sprouts, leafs and buds as
 * the goal fills, and flowers when it is reached (#241). A reached goal blooms once, the first
 * time this device sees it; the plant grows in place when a stage changes while you watch.
 * Reduced motion shows each stage still (index.css).
 */
export function GoalGrowthBar({
  goalId,
  name,
  pct,
  complete,
}: {
  goalId: string;
  name: string;
  pct: number;
  complete: boolean;
}) {
  const stage = growthStage(pct, complete);
  // Decided once per mount, so a re-render never replays it
  const [bloom] = useState(() => complete && firstBloom(goalId));
  // A stage reached while the page is open grows in; the stage it opened on does not
  const [shown, setShown] = useState(stage);
  const [grew, setGrew] = useState(false);
  if (shown !== stage) {
    setShown(stage);
    setGrew(true);
  }
  const width = complete ? 100 : pct;
  return (
    <div
      role="progressbar"
      aria-label={`${name} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(width)}
      data-stage={stage}
      className="relative pt-6.5"
    >
      <span
        className="absolute top-0 -translate-x-1/2 transition-[left] duration-500 ease-out"
        style={{ left: `clamp(13px, ${width}%, calc(100% - 13px))` }}
      >
        <Plant key={stage} stage={stage} bloom={bloom && stage === 'flower'} grew={grew} />
      </span>
      <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${complete ? 'bg-positive' : 'bg-brand-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
