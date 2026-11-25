import { useState } from 'react';
import { Snowflake } from 'lucide-react';
import { MonthRangePicker } from '../ui/MonthRangePicker';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DATE_PRESETS, computeDateRange, resolveDateRange } from '../../utils/dateRange';
import type { ReportDateRange } from '../../types';

/**
 * Live presets plus a "Frozen" option with fixed months. Switching to Frozen keeps the months
 * the range covers today, so freezing never changes what the report shows.
 */
export function DateRangeControl({
  value,
  onChange,
}: {
  value: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
}) {
  const frozen = value.preset === 'custom';
  // Open the month picker right after freezing, not when a range loads already frozen
  const [justFroze, setJustFroze] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SegmentedControl
        label="Date range"
        value={value.preset}
        options={[
          ...DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => ({
            value: p.id,
            label: p.label,
            title: p.long,
          })),
          {
            value: 'custom' as const,
            label: (
              <>
                <Snowflake size={11} /> Frozen
              </>
            ),
            title: 'Keep these dates fixed instead of moving with the current month',
          },
        ]}
        onChange={(preset) => {
          if (preset === 'custom') {
            if (frozen) return;
            setJustFroze(true);
            onChange({ ...resolveDateRange(value), preset: 'custom' });
            return;
          }
          setJustFroze(false);
          onChange({ preset, ...computeDateRange(preset) });
        }}
      />
      {frozen && (
        <MonthRangePicker
          from={value.from}
          to={value.to}
          onChange={(from, to) => onChange({ preset: 'custom', from, to })}
          defaultOpen={justFroze}
        />
      )}
    </div>
  );
}
