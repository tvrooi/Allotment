import type { ComponentProps } from 'react';
import { Chart } from '@tanstack/charts/react/tooltip';
import { useSafeMode } from '../../utils/safeMode';
import { CHART_CLASS } from './kit';

type Props = Omit<ComponentProps<typeof Chart>, 'aspectRatio' | 'className'>;

/** A chart in the app's styling: fixed `height`, or the full height of its parent when omitted. */
export function FillChart({ height, style, ...props }: Props) {
  // Axis and bar labels are drawn once from a memoized definition, so switching Safe mode
  // left the amounts on screen: a new chart draws them again through the formatters
  const { all } = useSafeMode();
  return (
    <Chart
      key={all ? 'amounts-hidden' : 'amounts-shown'}
      {...props}
      height={height}
      className={CHART_CLASS}
      style={height === undefined ? { height: '100%', ...style } : style}
    />
  );
}
