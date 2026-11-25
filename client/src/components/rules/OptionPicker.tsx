import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { MerchantSelect } from '../transactions/MerchantSelect';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { fieldBase, fieldHeights, fieldStates } from '../ui/fieldClasses';
import { Input } from '../ui/Input';
import type { ListOption } from '../ui/listItems';

export interface PickerOption {
  id: string;
  label: string;
  /** Shown dimmed before the label, e.g. a category's group */
  group?: string;
}

export type OptionPickerKind = 'category' | 'payee' | 'account';

type Props = {
  options: PickerOption[];
  placeholder?: string;
  /** Condition field kind: single-value pickers delegate to the matching shared picker */
  kind: OptionPickerKind;
  /** Accessible name for the picker when rendered as a Combobox or multi-select trigger */
  label: string;
} & (
  | { multiple?: false; value: string; onChange: (id: string) => void }
  | { multiple: true; value: string[]; onChange: (ids: string[]) => void }
);

const triggerClass = `${fieldBase} ${fieldHeights.sm} ${fieldStates} w-full flex items-center justify-between gap-2 text-left cursor-pointer`;

/**
 * Searchable picker for one or several payees, accounts or categories.
 * Single-value conditions delegate to CategorySelectButton, MerchantSelect or the shared Combobox;
 * several-values conditions keep a popover checklist built on shared Input and Checkbox controls.
 */
export function OptionPicker(props: Props) {
  if (props.multiple) {
    return (
      <MultiOptionPicker
        options={props.options}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        label={props.label}
      />
    );
  }
  return (
    <SingleOptionPicker
      kind={props.kind}
      options={props.options}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      label={props.label}
    />
  );
}

function SingleOptionPicker({
  kind,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
}: {
  kind: OptionPickerKind;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label: string;
}) {
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const isDeleted = Boolean(value) && !byId.has(value);

  if (kind === 'category') {
    return (
      <div className="min-w-0 flex-1">
        <CategorySelectButton
          value={value || null}
          onChange={(id) => onChange(id ?? '')}
          placeholder={placeholder}
          label={label}
          allowNone={false}
          allowCreate={false}
          includeHidden
          extraItem={isDeleted ? { value, label: '(deleted)' } : undefined}
        />
      </div>
    );
  }

  if (kind === 'payee') {
    return (
      <div className="min-w-0 flex-1">
        <MerchantSelect
          value={{ id: value || null, name: value ? (byId.get(value)?.label ?? '(deleted)') : '' }}
          onChange={(v) => onChange(v.id ?? '')}
          placeholder={placeholder}
          label={label}
        />
      </div>
    );
  }

  const items: ListOption[] = [
    ...(isDeleted ? [{ value, label: '(deleted)' }] : []),
    ...options.map((o) => ({ value: o.id, label: o.label })),
  ];

  return (
    <div className="min-w-0 flex-1">
      <Combobox
        aria-label={label}
        fieldSize="sm"
        items={items}
        value={value}
        onChange={(v) => {
          if (v) onChange(v);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

function MultiOptionPicker({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
}: {
  options: PickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => `${o.group ?? ''} ${o.label}`.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  function pick(id: string) {
    onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);
  }

  const summary = value.length
    ? value.map((id) => byId.get(id)?.label ?? '(deleted)').join(', ')
    : null;

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
        aria-expanded={open}
        aria-label={label ? `${label}: ${summary ?? placeholder}` : undefined}
        className={triggerClass}
      >
        <span className={`flex-1 truncate ${summary ? '' : 'text-text-tertiary'}`}>
          {summary ?? placeholder}
        </span>
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 min-w-56 bg-surface border border-border rounded-lg shadow-lg origin-top animate-menu-in">
          <div className="p-2 border-b border-border-light">
            <div className="relative">
              <Search
                size={13}
                aria-hidden="true"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <Input
                ref={searchRef}
                fieldSize="sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search options"
                placeholder="Search…"
                className="w-full pl-8"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.map((o) => {
              const isOn = value.includes(o.id);
              return (
                <div key={o.id} className="hover:bg-hover text-text">
                  <Checkbox
                    checked={isOn}
                    onCheckedChange={() => pick(o.id)}
                    className="w-full items-center px-3 py-1.5"
                  >
                    <span className="truncate">
                      {o.group && <span className="text-text-tertiary">{o.group} → </span>}
                      {o.label}
                    </span>
                  </Checkbox>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-text-tertiary text-center">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
