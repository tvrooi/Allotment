import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { wholeNumberMinMessage } from '../ui/fieldMessages';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  DEFAULT_UPCOMING_LENGTH,
  UPCOMING_PRESETS,
  getUpcomingDays,
  isCustomUpcomingLength,
} from './scheduleFormat';

const PRESET_OPTIONS = [...UPCOMING_PRESETS, { value: 'custom', label: 'Custom length' }];

const UNITS = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Port of Actual Budget's "Change upcoming length" dialog (presets + custom n-unit). */
export default function UpcomingLengthModal({ isOpen, onClose }: Props) {
  const saved = usePreferencesStore((s) => s.upcomingLength) || DEFAULT_UPCOMING_LENGTH;
  const setUpcomingLength = usePreferencesStore((s) => s.setUpcomingLength);
  const [temp, setTemp] = useState(saved);
  const [custom, setCustom] = useState(isCustomUpcomingLength(saved));
  const [resets, setResets] = useState(0);
  const amounts = useAmountValidity();

  useEffect(() => {
    if (isOpen) {
      setTemp(saved);
      setCustom(isCustomUpcomingLength(saved));
      setResets((n) => n + 1);
    }
  }, [isOpen, saved]);

  const [num, unit] = custom && temp.includes('-') ? temp.split('-') : ['1', 'day'];
  const count = Math.max(1, parseInt(num, 10) || 1);
  const days = getUpcomingDays(temp);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change upcoming length" size="md">
      <AmountFields report={amounts.report}>
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            Change how many days before its date a recurring item shows as <strong>Upcoming</strong>
            . Later items show as <strong>Scheduled</strong>.
          </p>
          <p className="text-xs text-text-tertiary">
            This only affects how recurring items are displayed. It can be changed at any time.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <Select
            aria-label="Upcoming length"
            fieldSize="sm"
            value={custom ? 'custom' : temp}
            onChange={(v) => {
              if (v === 'custom') {
                setCustom(true);
                setTemp('1-week');
                setResets((n) => n + 1);
              } else {
                setCustom(false);
                setTemp(v);
              }
            }}
            options={PRESET_OPTIONS}
          />

          {custom && (
            <div className="flex items-start gap-2">
              <NumberField
                label="Custom length number"
                value={count}
                onChange={(v) => {
                  if (v !== null) setTemp(`${v}-${unit}`);
                }}
                min={1}
                max={Number.MAX_SAFE_INTEGER}
                errorMessage={wholeNumberMinMessage(1)}
                fieldSize="sm"
                resetKey={resets}
                className="w-24 shrink-0 [&>label]:sr-only"
              />
              <Select
                aria-label="Custom length unit"
                fieldSize="sm"
                value={unit}
                onChange={(v) => setTemp(`${count}-${v}`)}
                options={UNITS}
                className="flex-1"
              />
            </div>
          )}

          <p className="text-xs text-text-tertiary">
            Items due within the next{' '}
            <span className="font-medium text-text-secondary">
              {days} {days === 1 ? 'day' : 'days'}
            </span>{' '}
            will show as Upcoming.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={temp === saved || !amounts.allValid}
            onClick={() => {
              if (!amounts.allValid) return;
              setUpcomingLength(temp);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </AmountFields>
    </Modal>
  );
}
