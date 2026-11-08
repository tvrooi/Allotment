import { useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ConfirmModal } from '../ui/ConfirmModal';
import { GuideLink } from '../guide/GuideLink';
import { Actions, ErrorText, Field, UnitsInput } from './InvestmentModals';
import {
  useDeleteSale,
  useRecordSale,
  useSalePreview,
  useUpdateSale,
} from '../../hooks/useInvestments';
import { UNKNOWN_TEXT, type Holding, type Sale, type SaleParcel } from '../../api/investments';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { formatUnits, parseUnits, unitsToInput } from '../../utils/units';

// D3a sales (docs/INVESTMENT-SALES-AND-INCOME.md): selling units against the holding's
// purchases, first in, first out unless the owner chooses the parcels, with the gain and the
// 50% discount shown before saving. Record keeping for Tax time, not tax advice.

const today = () => format(new Date(), 'yyyy-MM-dd');

const DISCOUNT_TEXT: Record<Sale['discount'], string> = {
  all: 'Held 12 months or more: the 50% discount applies',
  some: 'Part was held 12 months or more: the discount applies to that part',
  none: 'Held under 12 months: no discount',
};

function signed(amount: number, currency: string | null) {
  return `${amount > 0 ? '+' : ''}${formatMoney(amount, currency)}`;
}

/** A sale's parcels: which purchase, units, cost, proceeds and gain */
function ParcelsTable({ parcels, currency }: { parcels: SaleParcel[]; currency: string | null }) {
  const money = (n: number | null) => (n === null ? '—' : formatMoney(n, currency));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[30rem]">
        <thead>
          <tr className="text-xs text-text-tertiary text-left">
            <th className="font-medium py-1.5">Purchase</th>
            <th className="font-medium text-right">Units</th>
            <th className="font-medium text-right">Cost</th>
            <th className="font-medium text-right">Proceeds</th>
            <th className="font-medium text-right">Gain</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.lotId ?? 'none'} className="border-t border-border-light align-top">
              <td className="py-1.5">
                {p.acquiredOn ? `Bought ${formatDay(p.acquiredOn)}` : 'No purchase recorded'}
                <span className="block text-xs text-text-tertiary">
                  {p.unknown
                    ? UNKNOWN_TEXT[p.unknown]
                    : p.discountable
                      ? '12 months or more'
                      : 'Under 12 months'}
                </span>
              </td>
              <td className="text-right tabular-nums">{formatUnits(p.quantity)}</td>
              <td className="text-right tabular-nums">{money(p.cost)}</td>
              <td className="text-right tabular-nums">{money(p.proceeds)}</td>
              <td className="text-right tabular-nums">
                {p.gain === null ? 'Not known' : signed(p.gain, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Record a sale from a holding (no `sale`) or change one */
export function SellModal({
  holding,
  sale,
  budgetCurrency,
  onClose,
}: {
  holding: Holding;
  sale?: Sale;
  budgetCurrency: string | null;
  onClose: () => void;
}) {
  const currency = holding.security.currency;
  const [date, setDate] = useState(sale?.soldOn ?? today());
  const [units, setUnits] = useState(sale ? unitsToInput(sale.quantity) : '');
  const [proceeds, setProceeds] = useState(sale?.grossProceeds ?? 0);
  const [fees, setFees] = useState(sale?.fees ?? 0);
  const [notes, setNotes] = useState(sale?.notes ?? '');
  // A saved sale keeps the parcels it has; a new one starts first in, first out
  const [picks, setPicks] = useState<Record<string, string> | null>(() =>
    sale
      ? Object.fromEntries(
          sale.parcels.filter((p) => p.lotId).map((p) => [p.lotId!, unitsToInput(p.quantity)]),
        )
      : null,
  );
  const record = useRecordSale();
  const update = useUpdateSale();
  const mutation = sale ? update : record;

  const quantity = parseUnits(units);
  const picksValid =
    !picks || Object.values(picks).every((t) => !t.trim() || parseUnits(t) !== null);
  const parcels = picks
    ? Object.entries(picks)
        .map(([lotId, text]) => ({ lotId, quantity: parseUnits(text) ?? 0 }))
        .filter((p) => p.quantity > 0)
    : undefined;
  const input =
    quantity && date && picksValid
      ? {
          soldOn: date,
          quantity,
          proceeds,
          fees,
          ...(parcels && { parcels }),
          ...(sale && { saleId: sale.id }),
        }
      : null;
  const preview = useSalePreview(holding.id, input);
  const figures = preview.data;
  const figuresCurrency = figures?.budgetCurrency ?? budgetCurrency;

  function choose() {
    setPicks(
      Object.fromEntries(
        (figures?.parcels ?? [])
          .filter((p) => p.lotId)
          .map((p) => [p.lotId!, unitsToInput(p.quantity)]),
      ),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity) return;
    const data = { soldOn: date, quantity, proceeds, fees, parcels, notes: notes || null };
    if (sale) await update.mutateAsync({ holdingId: holding.id, saleId: sale.id, ...data });
    else await record.mutateAsync({ holdingId: holding.id, ...data });
    onClose();
  }

  const available = (figures?.lots ?? []).filter((l) => l.remaining > 0 || picks?.[l.id]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={sale ? `Edit sale of ${holding.security.symbol}` : `Sell ${holding.security.symbol}`}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-text-tertiary">
          From the contract note. Recording a sale lowers the units held; it doesn't add a
          transaction, so the cash stays whatever your bank recorded.{' '}
          <GuideLink page="investments" className="font-medium text-brand-600">
            How sales work
          </GuideLink>
        </p>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Sold on" htmlFor="sale-date" hint="The trade date, not settlement.">
            <Input
              id="sale-date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Units sold"
            htmlFor="sale-units"
            hint={`${formatUnits(holding.quantity + (sale?.quantity ?? 0))} held`}
          >
            <UnitsInput id="sale-units" value={units} onChange={setUnits} />
          </Field>
          <Field label="Proceeds before brokerage" htmlFor="sale-proceeds">
            <CurrencyInput
              id="sale-proceeds"
              currency={currency}
              value={proceeds}
              onChange={setProceeds}
              aria-label="Proceeds before brokerage"
            />
          </Field>
          <Field label="Sale brokerage" htmlFor="sale-fees">
            <CurrencyInput
              id="sale-fees"
              currency={currency}
              value={fees}
              onChange={setFees}
              aria-label="Sale brokerage"
            />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-secondary mb-1">Parcels sold</legend>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name="parcels" checked={!picks} onChange={() => setPicks(null)} />
            Oldest purchases first (first in, first out)
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="radio" name="parcels" checked={!!picks} onChange={choose} />
            Choose parcels
          </label>
          {picks && (
            <ul className="divide-y divide-border-light border-y border-border-light">
              {available.map((lot) => (
                <li key={lot.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <label htmlFor={`pick-${lot.id}`} className="text-text-secondary min-w-0">
                    Bought {formatDay(lot.acquiredOn)}
                    <span className="block text-xs text-text-tertiary">
                      {formatUnits(lot.remaining)} left
                      {lot.costBasis === null
                        ? ' · cost unknown'
                        : ` · cost ${formatMoney(lot.costBasis, currency)} for ${formatUnits(lot.quantity)}`}
                    </span>
                  </label>
                  <div className="w-32 shrink-0">
                    <Input
                      id={`pick-${lot.id}`}
                      inputMode="decimal"
                      value={picks[lot.id] ?? ''}
                      placeholder="0"
                      onChange={(e) => setPicks({ ...picks, [lot.id]: e.target.value })}
                      aria-invalid={!!picks[lot.id]?.trim() && parseUnits(picks[lot.id]) === null}
                    />
                  </div>
                </li>
              ))}
              {!available.length && (
                <li className="py-2 text-sm text-text-tertiary">
                  No purchases with units left. Add them under Purchases and cost.
                </li>
              )}
            </ul>
          )}
        </fieldset>

        <section aria-label="Gain on this sale" aria-live="polite" className="space-y-2">
          {preview.error ? (
            <ErrorText error={preview.error} />
          ) : figures && input ? (
            <>
              <ParcelsTable parcels={figures.parcels} currency={figuresCurrency} />
              <p className="text-sm text-text">
                {figures.gain === null ? (
                  <>
                    Gain not known: {UNKNOWN_TEXT[figures.unknown!].toLowerCase()}. It's saved, and
                    Tax time asks for what's missing.
                  </>
                ) : (
                  <>
                    {figures.gain < 0 ? 'Capital loss ' : 'Capital gain '}
                    <span className="font-semibold tabular-nums">
                      {formatMoney(Math.abs(figures.gain), figuresCurrency)}
                    </span>
                    {figures.gain > 0 && <> · {DISCOUNT_TEXT[figures.discount]}</>}
                  </>
                )}
              </p>
            </>
          ) : null}
        </section>

        <Field label="Notes" htmlFor="sale-notes">
          <Input
            id="sale-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </Field>
        <ErrorText error={mutation.error} />
        <Actions
          onClose={onClose}
          pending={mutation.isPending}
          disabled={!input || !!preview.error}
          label={sale ? 'Save' : 'Record sale'}
        />
      </form>
    </Modal>
  );
}

/** A holding's recorded sales, newest first, to change or remove */
export function SalesModal({
  holding,
  budgetCurrency,
  onEdit,
  onClose,
}: {
  holding: Holding;
  budgetCurrency: string | null;
  onEdit: (sale: Sale) => void;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState<Sale | null>(null);
  const remove = useDeleteSale();
  return (
    <Modal isOpen onClose={onClose} title={`Sales of ${holding.security.symbol}`} size="md">
      <p className="text-sm text-text-tertiary mb-3">
        Amounts are in your budget's currency, after sale brokerage. Tax time counts them in the
        financial year of the trade date.
      </p>
      <ErrorText error={remove.error} />
      <ul className="divide-y divide-border-light border-y border-border-light">
        {holding.sales.map((s) => (
          <li key={s.id} className="py-3 text-sm space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-text">
                {formatDay(s.soldOn)} · {formatUnits(s.quantity)} units
              </span>
              <span
                className={`tabular-nums ${s.gain === null || s.gain === 0 ? 'text-text' : s.gain > 0 ? 'text-positive' : 'text-negative'}`}
              >
                {s.gain === null ? 'Gain not known' : signed(s.gain, budgetCurrency)}
              </span>
            </div>
            <p className="text-xs text-text-tertiary">
              {s.proceeds === null
                ? 'No exchange rate'
                : `Proceeds ${formatMoney(s.proceeds, budgetCurrency)}`}
              {s.cost !== null && ` · cost ${formatMoney(s.cost, budgetCurrency)}`}
              {s.gain !== null &&
                s.gain > 0 &&
                ` · discount: ${s.discount === 'all' ? 'yes' : s.discount === 'some' ? 'part' : 'no'}`}
              {s.unknown && ` · ${UNKNOWN_TEXT[s.unknown]}`}
              {s.notes && ` · ${s.notes}`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(s)}
                aria-label={`Edit the sale of ${formatDay(s.soldOn)}`}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRemoving(s)}
                aria-label={`Remove the sale of ${formatDay(s.soldOn)}`}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!holding.sales.length && <p className="text-sm text-text-tertiary">No sales recorded.</p>}
      <div className="flex justify-end pt-3">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutateAsync({ holdingId: holding.id, saleId: removing.id })
        }
        title="Remove sale"
        message="Puts its units back in the holding and its purchases. Transactions aren't changed."
        confirmLabel="Remove"
        danger
      />
    </Modal>
  );
}
