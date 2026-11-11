import type { ComponentProps } from 'react';
import { Chart } from '@tanstack/charts/react/tooltip';
import { CHART_CLASS } from './kit';

type Props = Omit<ComponentProps<typeof Chart>, 'aspectRatio' | 'className'>;

/** A chart in the app's styling: fixed `height`, or the full height of its parent when omitted. */
export function FillChart({ height, style, ...props }: Props) {
  return (
    <Chart
      {...props}
      height={height}
      className={CHART_CLASS}
      style={height === undefined ? { height: '100%', ...style } : style}
    />
  );
}
