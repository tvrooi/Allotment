import { useMemo } from 'react';
import { CURRENCY_CODES } from '../../utils/currencies';
import { currencyName } from '../../utils/currency';
import { Select, type SelectGroup } from '../ui/Select';

/** Asked for most: shown first, after the ones already in use */
const COMMON = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'CAD', 'AUD', 'JPY'];

interface Props {
  value: string;
  onChange: (currency: string) => void;
  /** Shown at the top: the budget's currency and the ones accounts already use */
  first?: string[];
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

/** A currency picker: "EUR · Euro", the ones in use and common ones first, then all by name */
export function CurrencySelect({
  value,
  onChange,
  first = [],
  disabled,
  id,
  'aria-label': ariaLabel = 'Currency',
  'aria-describedby': describedBy,
  className = '',
}: Props) {
  // Callers pass a new array each render: keyed on its contents, so ~150 names are looked up
  // and sorted once
  const firstKey = first.join(',');
  const options = useMemo((): SelectGroup[] => {
    const top = [...new Set([...firstKey.split(',').filter(Boolean), ...COMMON])].filter((c) =>
      CURRENCY_CODES.includes(c),
    );
    const rest = CURRENCY_CODES.filter((c) => !top.includes(c))
      .map((code) => ({ code, name: currencyName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      {
        label: 'Common',
        options: top.map((code) => ({ value: code, label: `${code} · ${currencyName(code)}` })),
      },
      {
        label: 'All currencies',
        options: rest.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
      },
    ];
  }, [firstKey]);

  const widthClass = className
    ? `${/(^|\s)w-/.test(className) ? '' : 'w-full '}${className}`
    : 'w-full';

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      isDisabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={widthClass}
    />
  );
}
