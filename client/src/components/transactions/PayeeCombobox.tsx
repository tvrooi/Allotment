import { useRef } from 'react';
import type { Payee } from '../../types';
import { Combobox } from '../ui/Combobox';

interface PayeeValue {
  id: string | null;
  name: string;
}

interface Props {
  value: PayeeValue;
  onChange: (v: PayeeValue) => void;
  payees: Payee[];
  className?: string;
  /** Replaces the field's own styling (the phone sheet uses full input styling, 16px text) */
  fieldClassName?: string;
  /** For a visible <label htmlFor> beside the field */
  id?: string;
}

/** How many payees the list shows at most */
export const PAYEE_SUGGESTIONS = 8;

/**
 * The payees offered for the typed text, in the order given: the first eight, or the first
 * eight whose lower-cased name contains the lower-cased text (accents count)
 */
export function payeeSuggestions(payees: readonly Payee[], query: string): Payee[] {
  const q = query.toLowerCase();
  const matching = q ? payees.filter((p) => p.name.toLowerCase().includes(q)) : payees;
  return matching.slice(0, PAYEE_SUGGESTIONS);
}

/** Typed text that is no payee's name in any letter case becomes a new payee */
export function isNewPayee(payees: readonly Payee[], query: string): boolean {
  const q = query.toLowerCase();
  return q !== '' && !payees.some((p) => p.name.toLowerCase() === q);
}

/**
 * The field's own look when the caller gives none: bare in its cell, as in the register row. The
 * global focus outline sits under utilities (`@layer base`), so the bare field draws its own ring.
 */
const bareField =
  'block w-full bg-transparent text-sm text-text placeholder-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';

/**
 * The payee field: the shared Combobox with the payee rules. The list opens on focus with the
 * first eight payees, typing narrows it and keeps the text as a new payee (reported with no id),
 * and picking a suggestion reports that payee. It never creates, renames or merges a payee; its
 * caller saves what it reports.
 */
export function PayeeCombobox({
  value,
  onChange,
  payees,
  className = '',
  fieldClassName,
  id,
}: Props) {
  const query = value.name;
  const suggestions = payeeSuggestions(payees, query);
  // The text last reported, so a choice is not reported again as typing
  const reported = useRef(query);
  reported.current = query;

  function type(name: string) {
    if (name === reported.current) return;
    reported.current = name;
    onChange({ id: null, name });
  }

  function pick(payeeId: string) {
    // '' is the selection clearing as the text is typed over, which typing already reported
    const payee = payees.find((p) => p.id === payeeId);
    if (!payee) return;
    reported.current = payee.name;
    onChange({ id: payee.id, name: payee.name });
  }

  return (
    // D-12 (owner-approved 17 Nov 2026): Escape with the list open closes only the list, so the
    // phone sheet and the detail panel stay open; the shared Combobox marks that Escape handled
    <div className="relative">
      <Combobox
        aria-label="Payee"
        placeholder="Payee"
        id={id}
        items={suggestions.map((p) => ({ value: p.id, label: p.name }))}
        value={value.id ?? ''}
        onChange={pick}
        inputValue={query}
        onInputChange={type}
        allowsCustomValue
        menuTrigger="focus"
        filter={false}
        emptyState={null}
        footer={
          isNewPayee(payees, query) ? (
            <p className="px-3 py-1.5 text-xs text-text-tertiary">New payee: "{query}"</p>
          ) : undefined
        }
        fieldClassName={fieldClassName ?? `${bareField} ${className}`}
        // 12rem in the register row and the detail panel; the field's width in the phone sheet
        popoverClassName={
          fieldClassName !== undefined ? 'w-[var(--trigger-width)]' : 'w-48 min-w-48!'
        }
      />
    </div>
  );
}
