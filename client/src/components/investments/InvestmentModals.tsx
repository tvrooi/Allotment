import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { helpClass } from '../ui/fieldClasses';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { CurrencySelect } from '../currency/CurrencySelect';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import {
  useAddLot,
  useCreateHolding,
  useCreateSecurity,
  useDeleteLot,
  useDeletePrice,
  usePrices,
  useSetPrice,
  useUpdateHolding,
  useUpdateLot,
  useUpdateSecurity,
} from '../../hooks/useInvestments';
import {
  SECURITY_KINDS,
  type Holding,
  type InvestmentAccount,
  type Security,
  type SecurityKind,
  type SecuritySummary,
} from '../../api/investments';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { formatUnits, parseUnits, unitsToInput } from '../../utils/units';

export const KIND_LABEL: Record<SecurityKind, string> = {
  stock: 'Share',
  etf: 'ETF',
  fund: 'Managed fund',
  bond: 'Bond',
  crypto: 'Crypto',
  other: 'Other',
};

const today = () => format(new Date(), 'yyyy-MM-dd');

/** A bare Input or CurrencyInput with the shared label above it and an optional hint below */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className={helpClass}>{hint}</p>}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-negative">
      {(error as Error).message}
    </p>
  );
}

export function Actions({
  onClose,
  pending,
  disabled,
  label = 'Save',
}: {
  onClose: () => void;
  pending: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const canSave = useCanSave();
  return (
    <>
      <SavingPausedHint className="text-right" />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || disabled || !canSave}>
          {pending ? 'Saving…' : label}
        </Button>
      </div>
    </>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────

/** Add a security (no `security`) or edit one */
export function SecurityModal({
  security,
  defaultCurrency,
  onClose,
  onCreated,
}: {
  security?: SecuritySummary;
  defaultCurrency: string | null;
  onClose: () => void;
  /** Instead of onClose after adding one */
  onCreated?: (security: Security) => void;
}) {
  const [symbol, setSymbol] = useState(security?.symbol ?? '');
  const [name, setName] = useState(security?.name ?? '');
  const [kind, setKind] = useState<SecurityKind>(security?.kind ?? 'etf');
  const [currency, setCurrency] = useState(security?.currency ?? defaultCurrency ?? 'AUD');
  const create = useCreateSecurity();
  const update = useUpdateSecurity();
  const mutation = security ? update : create;
  const priced = !!security?.latestPriceDate;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = { symbol: symbol.trim(), name: name.trim(), kind, currency };
    if (security) {
      await update.mutateAsync({ id: security.id, ...data });
      onClose();
      return;
    }
    const created = await create.mutateAsync(data);
    if (onCreated) onCreated(created);
    else onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={security ? 'Edit security' : 'Add security'} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Code"
          htmlFor="sec-symbol"
          hint="The ticker or code you know it by, like VAS or BTC."
        >
          <Input
            id="sec-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            maxLength={20}
            required
            autoFocus
          />
        </Field>
        <Field label="Name" htmlFor="sec-name">
          <Input
            id="sec-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Select
          label="Type"
          id="sec-kind"
          value={kind}
          onChange={(v) => setKind(v as SecurityKind)}
          options={SECURITY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          description="What the instrument is, not what a fund holds."
        />
        <Field
          label="Priced in"
          htmlFor="sec-currency"
          hint={priced ? 'It already has prices, so its currency stays as it is.' : undefined}
        >
          <CurrencySelect
            id="sec-currency"
            value={currency}
            onChange={setCurrency}
            first={defaultCurrency ? [defaultCurrency] : []}
            disabled={priced}
          />
        </Field>
        <ErrorText error={mutation.error} />
        <Actions
          onClose={onClose}
          pending={mutation.isPending}
          disabled={!symbol.trim() || !name.trim()}
        />
      </form>
    </Modal>
  );
}

// ─── Prices ───────────────────────────────────────────────────────────────────

/** Enter a dated price, and see or remove earlier ones */
export function PriceModal({ security, onClose }: { security: Security; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const prices = usePrices(security.id);
  const latest = prices.data?.[0];
  const [price, setPrice] = useState<number | null>(null);
  const value = price ?? latest?.price ?? 0;
  const save = useSetPrice();
  const remove = useDeletePrice();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await save.mutateAsync({ securityId: security.id, date, price: value });
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={`Price of ${security.symbol}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-text-tertiary">
          Prices are entered by you; Allotment doesn't fetch quotes. A day's price replaces any
          price already entered for that day.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Date"
            id="price-date"
            value={date}
            onChange={setDate}
            maxValue={today()}
            isRequired
          />
          <Field label="Price per unit" htmlFor="price-value">
            <CurrencyInput
              id="price-value"
              currency={security.currency}
              value={value}
              onChange={setPrice}
              aria-label="Price per unit"
            />
          </Field>
        </div>
        <ErrorText error={save.error ?? remove.error} />
        <Actions onClose={onClose} pending={save.isPending} disabled={!date} />
      </form>
      {!!prices.data?.length && (
        <div className="mt-5 border-t border-border-light pt-4">
          <h3 className="text-xs font-medium text-text-secondary mb-2">Entered prices</h3>
          <ul className="divide-y divide-border-light max-h-48 overflow-y-auto">
            {prices.data.map((p) => (
              <li key={p.date} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-text-secondary">{formatDay(p.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-text">
                    {formatMoney(p.price, security.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove.mutate({ securityId: security.id, date: p.date })}
                    className="p-1 text-text-tertiary hover:text-negative rounded"
                    aria-label={`Remove the price of ${formatDay(p.date)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export function UnitsInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      isInvalid={value.trim() !== '' && parseUnits(value) === null}
      required
    />
  );
}

/** Add a holding to an account (no `holding`) or change one's quantity and notes */
export function HoldingModal({
  holding,
  accounts,
  securities,
  accountId,
  securityId: initialSecurity,
  onClose,
  onAddSecurity,
}: {
  holding?: Holding;
  accounts: InvestmentAccount[];
  securities: SecuritySummary[];
  accountId?: string;
  /** Selected to start with (one just added) */
  securityId?: string;
  onClose: () => void;
  onAddSecurity: () => void;
}) {
  const [account, setAccount] = useState(holding?.accountId ?? accountId ?? accounts[0]?.id ?? '');
  const [securityId, setSecurityId] = useState(
    holding?.security.id ?? initialSecurity ?? securities[0]?.id ?? '',
  );
  const [units, setUnits] = useState(holding ? unitsToInput(holding.quantity) : '');
  const [notes, setNotes] = useState(holding?.notes ?? '');
  const create = useCreateHolding();
  const update = useUpdateHolding();
  const mutation = holding ? update : create;
  const quantity = parseUnits(units);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (quantity === null) return;
    if (holding) await update.mutateAsync({ id: holding.id, quantity, notes: notes || null });
    else
      await create.mutateAsync({ accountId: account, securityId, quantity, notes: notes || null });
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={holding ? `Edit ${holding.security.symbol}` : 'Add holding'}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        {!holding && (
          <>
            <Combobox
              label="Account"
              id="holding-account"
              items={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={account}
              // Text that matches no account returns to the chosen one; it is never emptied
              onChange={(v) => {
                if (v) setAccount(v);
              }}
            />
            <div className="grid gap-1">
              <Combobox
                label="Security"
                id="holding-security"
                items={securities.map((s) => ({
                  value: s.id,
                  label: `${s.symbol} · ${s.name} (${s.currency})`,
                }))}
                value={securityId}
                onChange={(v) => {
                  if (v) setSecurityId(v);
                }}
              />
              <p className={helpClass}>
                <button
                  type="button"
                  onClick={onAddSecurity}
                  className="text-brand-600 hover:underline"
                >
                  Add a security that isn't listed
                </button>
              </p>
            </div>
          </>
        )}
        <Field
          label="Units held"
          htmlFor="holding-units"
          hint="Up to six decimals for fractional shares or coins. Changing it doesn't change the account's balance."
        >
          <UnitsInput id="holding-units" value={units} onChange={setUnits} />
        </Field>
        <Field label="Notes" htmlFor="holding-notes">
          <Input
            id="holding-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </Field>
        <ErrorText error={mutation.error} />
        <Actions
          onClose={onClose}
          pending={mutation.isPending}
          disabled={quantity === null || (!holding && (!account || !securityId))}
        />
      </form>
    </Modal>
  );
}

// ─── Tax lots ─────────────────────────────────────────────────────────────────

/** A sentence about how much of the holding the lots' costs cover */
export function basisSummary(holding: Holding): string {
  const total = formatUnits(holding.quantity);
  switch (holding.basisStatus) {
    case 'complete':
      return `Every unit has a known cost.`;
    case 'partial':
      return `Costs are known for ${formatUnits(holding.knownBasisQuantity)} of ${total} units, so no gain is shown.`;
    case 'mismatch':
      return `The lots add up to ${formatUnits(holding.lotQuantity)} units, not the ${total} held. Fix the lots or the holding to see a gain.`;
    default:
      return holding.lots.length
        ? 'No lot has a known cost, so no gain is shown.'
        : 'No purchases recorded, so the cost and gain are unknown.';
  }
}

function LotRow({ lot, currency }: { lot: Holding['lots'][number]; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [cost, setCost] = useState(lot.costBasis ?? 0);
  const update = useUpdateLot();
  const remove = useDeleteLot();
  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary">
          {formatDay(lot.acquiredOn)} · {formatUnits(lot.quantity)} units
          {lot.units !== lot.quantity && (
            <span className="block text-xs text-text-tertiary">
              {formatUnits(lot.units)} units today, after splits
            </span>
          )}
          {lot.remaining < lot.units && (
            <span className="block text-xs text-text-tertiary">
              {lot.remaining ? `${formatUnits(lot.remaining)} left after sales` : 'All sold'}
            </span>
          )}
          {lot.reinvested && (
            <span className="block text-xs text-text-tertiary">
              Reinvested payment: change it under Income
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {editing ? null : lot.costBasis === null ? (
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline"
              onClick={() => setEditing(true)}
            >
              Cost unknown · add
            </button>
          ) : (
            <button
              type="button"
              className="tabular-nums text-text hover:underline"
              onClick={() => setEditing(true)}
              aria-label={`Change the cost of the lot of ${formatDay(lot.acquiredOn)}`}
            >
              {formatMoney(lot.costBasis, currency)}
            </button>
          )}
          {/* A purchase that sales drew from stays: their gains are worked out from it */}
          {lot.remaining === lot.units && !lot.reinvested && (
            <button
              type="button"
              onClick={() => remove.mutate(lot.id)}
              className="p-1 text-text-tertiary hover:text-negative rounded"
              aria-label={`Remove the lot of ${formatDay(lot.acquiredOn)}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </span>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1">
            <CurrencyInput
              currency={currency}
              value={cost}
              onChange={setCost}
              aria-label="Total cost"
            />
          </div>
          <Button
            size="sm"
            onClick={() =>
              update.mutate({ id: lot.id, costBasis: cost }, { onSuccess: () => setEditing(false) })
            }
            disabled={update.isPending}
          >
            Save
          </Button>
          {lot.costBasis !== null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                update.mutate(
                  { id: lot.id, costBasis: null },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              Mark unknown
            </Button>
          )}
        </div>
      )}
      {/* A change a lodged year's capital gains depend on is refused: say why */}
      <ErrorText error={update.error ?? remove.error} />
    </li>
  );
}

/** The purchases that make up a holding, each with its total cost (or unknown) */
export function LotsModal({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const currency = holding.security.currency;
  const remaining = Math.max(0, holding.quantity - holding.lotQuantity);
  const [date, setDate] = useState(today());
  const [units, setUnits] = useState(remaining ? unitsToInput(remaining) : '');
  const [cost, setCost] = useState(0);
  const [costKnown, setCostKnown] = useState(true);
  const add = useAddLot();
  const quantity = parseUnits(units);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity) return;
    await add.mutateAsync({
      holdingId: holding.id,
      acquiredOn: date,
      quantity,
      costBasis: costKnown ? cost : null,
    });
    setUnits('');
    setCost(0);
  }

  return (
    <Modal isOpen onClose={onClose} title={`Purchases of ${holding.security.symbol}`} size="md">
      <p className="text-sm text-text-tertiary mb-3">
        Record when units were bought and their total cost, including fees. A cost left unknown
        stays unknown: it is never counted as zero. Lots are for working out unrealized gains; they
        don't add transactions.
      </p>
      <p className="text-sm text-text-secondary mb-3">{basisSummary(holding)}</p>
      {holding.lots.length > 0 && (
        <ul className="divide-y divide-border-light border-y border-border-light mb-4">
          {holding.lots.map((lot) => (
            <LotRow key={lot.id} lot={lot} currency={currency} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-3">
        <h3 className="text-sm font-medium text-text">Add a purchase</h3>
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Bought on"
            id="lot-date"
            value={date}
            onChange={setDate}
            maxValue={today()}
            isRequired
          />
          <Field label="Units" htmlFor="lot-units">
            <UnitsInput id="lot-units" value={units} onChange={setUnits} />
          </Field>
        </div>
        <Field label="Total cost" htmlFor="lot-cost">
          {costKnown ? (
            <CurrencyInput
              id="lot-cost"
              currency={currency}
              value={cost}
              onChange={setCost}
              aria-label="Total cost"
            />
          ) : (
            <p className="text-sm text-text-tertiary py-2">Unknown</p>
          )}
        </Field>
        <Checkbox checked={!costKnown} onCheckedChange={(unknown) => setCostKnown(!unknown)}>
          I don't know what these units cost
        </Checkbox>
        <ErrorText error={add.error} />
        <Actions
          onClose={onClose}
          pending={add.isPending}
          // The date field no longer blocks the form natively, so an empty date holds it here
          disabled={!quantity || !date}
          label="Add purchase"
        />
      </form>
    </Modal>
  );
}
