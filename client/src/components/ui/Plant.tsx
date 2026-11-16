import type { ComponentPropsWithoutRef } from 'react';

// A small plant that grows from a seed to a flower (issue 241). The goal rows show it at the
// end of their bar; its seedling is the brand mark's own sprout (client/public/logo.svg), so the
// plant and the logo share one leaf. Every colour is an @theme token, so it flips in dark mode.
// No hex here, not even an issue number written with its hash: a unit test and a grep check.

export type PlantStage = 'seed' | 'seedling' | 'bud' | 'flower';

/**
 * The stage a goal has grown to. Only a reached goal flowers (`complete` is the Goals page's
 * rule): 100% that is not fully funded, or a goal completed by hand short of its target, stays
 * a bud. The only place the stages are decided.
 */
export function plantStage(pct: number, complete: boolean): PlantStage {
  if (complete) return 'flower';
  if (pct >= 66) return 'bud';
  if (pct >= 33) return 'seedling';
  return 'seed';
}

/** The logo's sprout, in its own 40 × 51 space; each stage places it with a transform */
function Sprout({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path
        d="M20 51V27C8 28 2 20 2 9c12-1 18 5 18 14C20 14 26 8 38 9c0 11-6 19-18 18"
        className="fill-positive"
      />
      <path
        d="M20 26v25"
        className="stroke-positive"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

function Stem({ d }: { d: string }) {
  return (
    <path d={d} className="stroke-positive" strokeWidth="1.4" strokeLinecap="round" fill="none" />
  );
}

/** Petal centres around the flower's centre at (10, 5.2) */
const PETALS = [
  [10, 2.8],
  [12.28, 4.46],
  [11.41, 7.14],
  [8.59, 7.14],
  [7.72, 4.46],
] as const;
const FLOWER_ORIGIN = '10px 5.2px';

/**
 * Decorative only: hidden from assistive technology, with the status always in text beside it.
 * Still unless asked: `grew` grows it in from its base, `bloom` opens the flower's petals with
 * one soft ring. Both are `none` under reduced motion (index.css), so the end state shows.
 */
export function Plant({
  stage,
  size = 20,
  ground = true,
  bloom = false,
  grew = false,
  className,
  ...rest
}: {
  stage: PlantStage;
  size?: number;
  ground?: boolean;
  bloom?: boolean;
  grew?: boolean;
} & Omit<ComponentPropsWithoutRef<'svg'>, 'children'>) {
  const flowering = bloom && stage === 'flower';
  return (
    <svg
      {...rest}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={[
        'block overflow-visible origin-bottom shrink-0',
        grew && 'animate-grow-in',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-motion={grew || undefined}
    >
      {ground && (
        <path d="M3 18.25h14" className="stroke-border" strokeWidth="1.5" strokeLinecap="round" />
      )}
      {stage === 'seed' && (
        <ellipse
          cx="10"
          cy="15.75"
          rx="2.75"
          ry="2"
          transform="rotate(-20 10 15.75)"
          className="fill-text-tertiary"
        />
      )}
      {stage === 'seedling' && <Sprout transform="translate(4.4 3.72) scale(0.28)" />}
      {stage === 'bud' && (
        <>
          <Sprout transform="translate(5.2 5.76) scale(0.24)" />
          <Stem d="M10 12V7.5" />
          <path
            d="M10 2.75c1.6 1.2 2.4 2.5 2.4 3.6a2.4 2.4 0 0 1-4.8 0c0-1.1.8-2.4 2.4-3.6z"
            className="fill-brand-500"
          />
        </>
      )}
      {stage === 'flower' && (
        <>
          <Sprout transform="translate(5.6 6.78) scale(0.22)" />
          <Stem d="M10 12.5V6" />
          {flowering && (
            <circle
              cx="10"
              cy="5.2"
              r="6"
              fill="none"
              strokeWidth="1"
              className="stroke-positive opacity-0 animate-bloom-ring"
              style={{ transformOrigin: FLOWER_ORIGIN }}
              data-motion
            />
          )}
          {PETALS.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="2"
              className={flowering ? 'fill-brand-500 animate-bloom' : 'fill-brand-500'}
              style={
                flowering
                  ? { transformOrigin: FLOWER_ORIGIN, animationDelay: `${i * 40}ms` }
                  : undefined
              }
              data-motion={flowering || undefined}
            />
          ))}
          <circle cx="10" cy="5.2" r="1.5" className="fill-brand-700" />
        </>
      )}
    </svg>
  );
}
