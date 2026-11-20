import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { useCanSave } from '../../hooks/useConnection';
import { usePayees, useCreatePayee } from '../../hooks/usePayees';
import { PayeeIcon } from '../payees/PayeeIcon';
import { Combobox } from '../ui/Combobox';

export interface MerchantValue {
  id: string | null;
  name: string;
}

export const PAUSED_CREATE_MESSAGE = 'New payees can be added once Allotment reconnects.';

export type MerchantFooter =
  { kind: 'none' } | { kind: 'create'; name: string } | { kind: 'paused'; message: string };

/** Orders payees by transaction count (highest first), then by name. */
export function sortPayees<T extends { name: string; transactionCount: number }>(
  payees: readonly T[],
): T[] {
  return [...payees].sort(
    (a, b) => b.transactionCount - a.transactionCount || a.name.localeCompare(b.name),
  );
}

/**
 * Decides the combobox footer for the typed text: offers to create a new payee while saving is
 * allowed, shows the reconnect message while saving is paused, or hides the footer when the text
 * is blank or already matches an existing payee in any letter case.
 */
export function merchantFooterState(
  payees: readonly { name: string }[],
  query: string,
  canSave: boolean,
): MerchantFooter {
  const name = query.trim();
  if (!name) return { kind: 'none' };
  const exact = payees.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (exact) return { kind: 'none' };
  if (!canSave) return { kind: 'paused', message: PAUSED_CREATE_MESSAGE };
  return { kind: 'create', name };
}

interface Props {
  value: MerchantValue;
  onChange: (value: MerchantValue) => void;
  placeholder?: string;
  /** Accessible name of the search box */
  label?: string;
  /** For a visible <label htmlFor> beside the field */
  id?: string;
}

/**
 * Merchant (payee) selector from the Add transaction workflow: thin wrapper over the shared
 * Combobox with payees sorted by transaction count, payee icons, and "Create new payee". Free
 * text that isn't confirmed (picked or created) is cleared when the field is left.
 */
export function MerchantSelect({
  value,
  onChange,
  placeholder = 'Search payees...',
  label = 'Payee',
  id,
}: Props) {
  const { data: payees = [] } = usePayees();
  const createPayee = useCreatePayee();
  const canSave = useCanSave();
  const [query, setQuery] = useState(value.name);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // Latest confirmed id and reported text, so blur clearing and selection sync never fight typing
  const confirmedIdRef = useRef(value.id);
  confirmedIdRef.current = value.id;
  const reported = useRef(query);
  reported.current = query;

  // Sync the input when a confirmed merchant is set from outside (e.g. editing).
  // Unconfirmed typing clears value.id, so don't sync then or the input would wipe itself.
  useEffect(() => {
    if (value.id) {
      reported.current = value.name;
      setQuery(value.name);
    }
  }, [value.id, value.name]);

  const sortedPayees = useMemo(() => sortPayees(payees), [payees]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matches = q ? sortedPayees.filter((p) => p.name.toLowerCase().includes(q)) : sortedPayees;
    return matches.slice(0, 8);
  }, [sortedPayees, query]);

  const footerState = merchantFooterState(payees, query, canSave);

  function select(payeeId: string, name: string) {
    reported.current = name;
    confirmedIdRef.current = payeeId;
    setQuery(name);
    onChange({ id: payeeId, name });
  }

  function handleInputChange(next: string) {
    if (next === reported.current) return;
    reported.current = next;
    setQuery(next);
    if (value.id || value.name) onChange({ id: null, name: '' });
  }

  function handleSelectionChange(selectedId: string) {
    if (!selectedId) return;
    const payee = payees.find((p) => p.id === selectedId);
    if (payee) select(payee.id, payee.name);
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (!confirmedIdRef.current) {
      reported.current = '';
      setQuery('');
    }
  }

  const footer =
    footerState.kind === 'paused' ? (
      // New merchants are made on the server, so offline only existing ones can be picked
      <p className="px-3 py-2.5 text-xs text-caution">{footerState.message}</p>
    ) : footerState.kind === 'create' ? (
      <button
        type="button"
        disabled={createPayee.isPending}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (createPayee.isPending) return;
          createPayee.mutate(
            { name: footerState.name },
            { onSuccess: (created) => select(created.id, created.name) },
          );
        }}
        className="w-full text-left px-3 py-2.5 text-sm text-brand-600 font-medium flex items-center gap-1.5 hover:bg-surface-alt cursor-pointer disabled:text-text-disabled disabled:cursor-not-allowed"
      >
        <Plus size={14} aria-hidden="true" />
        Create new payee: &ldquo;{footerState.name}&rdquo;
      </button>
    ) : undefined;

  return (
    <div ref={setContainer} className="relative" onBlur={handleBlur}>
      <Combobox
        id={id}
        aria-label={label}
        placeholder={placeholder}
        items={filtered.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <PayeeIcon name={p.name} logo={p.logo} />,
          trailing: (
            <span className="flex items-center gap-1 text-xs text-text-tertiary shrink-0">
              <CreditCard size={11} aria-hidden="true" />
              {p.transactionCount}
            </span>
          ),
        }))}
        value={value.id ?? ''}
        onChange={handleSelectionChange}
        inputValue={query}
        onInputChange={handleInputChange}
        allowsCustomValue
        menuTrigger="focus"
        filter={false}
        emptyState={null}
        footer={footer}
        portalContainer={container ?? undefined}
      />
    </div>
  );
}
