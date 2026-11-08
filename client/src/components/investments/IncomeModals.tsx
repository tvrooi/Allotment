import { useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { CurrencyInput } from '../ui/CurrencyInput';
import { ConfirmModal } from '../ui/ConfirmModal';
import { GuideLink } from '../guide/GuideLink';
import { FilesSection } from '../files/FilesSection';
import { Actions, ErrorText, Field, UnitsInput } from './InvestmentModals';
import { DepositLink } from './DepositLink';
import { useDeleteIncome, useRecordIncome, useUpdateIncome } from '../../hooks/useInvestments';
import {
  INCOME_KIND_LABEL,
  INCOME_KINDS,
  type Holding,
  type Income,
  type IncomeKind,
} from '../../api/investments';
import { formatMoney } from '../../utils/currency';
import { formatDay } from '../../utils/dates';
import { FRANKING_RATES_BPS, frankingCredit } from '../../utils/franking';
import { formatUnits, parseUnits, unitsToInput } from '../../utils/units';

// D3b (docs/INVESTMENT-SALES-AND-INCOME.md): dividends, distributions and interest as their
// statements show them, for Tax time's items 10 and 11. Record keeping, not tax advice.

const today = () => format(new Date(), 'yyyy-MM-dd');

/** Record a payment on a holding (no `income`) or change one */
export function IncomeModal({
  holding,
  income,
  onClose,
}: {
  holding: Holding;
  income?: Income;
  onClose: () => void;
}) {
  const currency = holding.security.currency;
  const [kind, setKind] = useState<IncomeKind>(income?.kind ?? 'dividend');
  const [date, setDate] = useState(income?.paidOn ?? today());
  const [amount, setAmount] = useState(income?.amount ?? 0);
  const [unfranked, setUnfranked] = useState(income?.unfranked ?? 0);
  const [franked, setFranked] = useState(income?.franked ?? 0);
  const [credit, setCredit] = useState(income?.frankingCredit ?? 0);
  const [withheld, setWithheld] = useState(income?.withheld ?? 0);
  const [reinvest, setReinvest] = useState(!!income?.reinvested);
  const [units, setUnits] = useState(
    income?.reinvested ? unitsToInput(income.reinvested.quantity) : '',
  );
  const [cost, setCost] = useState<number | null>(income?.reinvested?.cost ?? null);
  const [notes, setNotes] = useState(income?.notes ?? '');
  const record = useRecordIncome();
  const update = useUpdateIncome();
  const mutation = income ? update : record;
  const quantity = parseUnits(units);
  const franking = kind !== 'interest';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      paidOn: date,
      kind,
      amount,
      unfranked: franking ? unfranked : 0,
      franked: franking ? franked : 0,
      frankingCredit: franking ? credit : 0,
      withheld,
      reinvested: reinvest && quantity ? { quantity, cost: cost ?? amount } : null,
      notes: notes || null,
    };
    if (income) await update.mutateAsync({ holdingId: holding.id, incomeId: income.id, ...data });
    else await record.mutateAsync({ holdingId: holding.id, ...data });
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        income
          ? `Edit payment from ${holding.security.symbol}`
          : `Record a payment from ${holding.security.symbol}`
      }
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-text-tertiary">
          Copy the statement. It doesn't add a transaction: link the deposit afterwards from the
          payment's list.{' '}
          <GuideLink page="investments" className="font-medium text-brand-600">
            How dividends work
          </GuideLink>
        </p>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Kind" htmlFor="income-kind">
            <Select
              id="income-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as IncomeKind)}
            >
              {INCOME_KINDS.map((k) => (
                <option key={k} value={k}>
                  {INCOME_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paid on" htmlFor="income-date">
            <Input
              id="income-date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Amount paid" htmlFor="income-amount" hint="After any tax withheld.">
            <CurrencyInput
              id="income-amount"
              currency={currency}
              value={amount}
              onChange={setAmount}
            />
          </Field>
          <Field label="Tax withheld" htmlFor="income-withheld" hint="TFN amounts or foreign tax.">
            <CurrencyInput
              id="income-withheld"
              currency={currency}
              value={withheld}
              onChange={setWithheld}
            />
          </Field>
          {franking && (
            <>
              <Field label="Unfranked amount" htmlFor="income-unfranked">
                <CurrencyInput
                  id="income-unfranked"
                  currency={currency}
                  value={unfranked}
                  onChange={setUnfranked}
                />
              </Field>
              <Field label="Franked amount" htmlFor="income-franked">
                <CurrencyInput
                  id="income-franked"
                  currency={currency}
                  value={franked}
                  onChange={setFranked}
                />
              </Field>
              <Field
                label="Franking credit"
                htmlFor="income-credit"
                hint={
                  <span className="flex flex-wrap gap-x-3">
                    As the statement shows. Work it out at
                    {FRANKING_RATES_BPS.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className="text-brand-600 hover:underline"
                        onClick={() => setCredit(frankingCredit(franked, rate))}
                      >
                        {rate / 100}%
                      </button>
                    ))}
                  </span>
                }
              >
                <CurrencyInput
                  id="income-credit"
                  currency={currency}
                  value={credit}
                  onChange={setCredit}
                />
              </Field>
            </>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={reinvest}
            onChange={(e) => setReinvest(e.target.checked)}
          />
          Reinvested through a dividend plan
        </label>
        {reinvest && (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label="Units allotted" htmlFor="income-units">
              <UnitsInput id="income-units" value={units} onChange={setUnits} />
            </Field>
            <Field
              label="Amount reinvested"
              htmlFor="income-cost"
              hint="Their cost. Any rest is the cash deposit."
            >
              <CurrencyInput
                id="income-cost"
                currency={currency}
                value={cost ?? amount}
                onChange={setCost}
              />
            </Field>
          </div>
        )}

        <Field label="Notes" htmlFor="income-notes">
          <Input
            id="income-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </Field>
        <ErrorText error={mutation.error} />
        <Actions
          onClose={onClose}
          pending={mutation.isPending}
          disabled={!date || (reinvest && !quantity)}
          label={income ? 'Save' : 'Record payment'}
        />
      </form>
    </Modal>
  );
}

/** A holding's payments, newest first, to change, remove, link to their deposit or file */
export function IncomeListModal({
  holding,
  onEdit,
  onClose,
}: {
  holding: Holding;
  onEdit: (income: Income) => void;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState<Income | null>(null);
  const remove = useDeleteIncome();
  const currency = holding.security.currency;
  return (
    <Modal isOpen onClose={onClose} title={`Income from ${holding.security.symbol}`} size="md">
      <ErrorText error={remove.error} />
      <ul className="divide-y divide-border-light border-y border-border-light">
        {holding.income.map((i) => {
          const name = `the ${INCOME_KIND_LABEL[i.kind].toLowerCase()} of ${formatDay(i.paidOn)}`;
          return (
            <li key={i.id} className="py-3 text-sm space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-text">
                  {INCOME_KIND_LABEL[i.kind]} · {formatDay(i.paidOn)}
                </span>
                <span className="tabular-nums text-text">{formatMoney(i.amount, currency)}</span>
              </div>
              <p className="text-xs text-text-tertiary">
                {i.kind !== 'interest' &&
                  `Franked ${formatMoney(i.franked, currency)} · credit ${formatMoney(i.frankingCredit, currency)} · unfranked ${formatMoney(i.unfranked, currency)}`}
                {i.withheld > 0 && ` · withheld ${formatMoney(i.withheld, currency)}`}
                {i.reinvested && ` · ${formatUnits(i.reinvested.quantity)} units reinvested`}
                {i.notes && ` · ${i.notes}`}
              </p>
              {i.partsDisagree && (
                <p className="text-xs text-caution">
                  Unfranked and franked don't add up to the payment plus tax withheld. Check the
                  statement.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(i)}
                  aria-label={`Edit ${name}`}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoving(i)}
                  aria-label={`Remove ${name}`}
                >
                  Remove
                </Button>
              </div>
              <DepositLink
                of={{ holdingId: holding.id, kind: 'income', id: i.id }}
                transactionId={i.transactionId}
                label={name}
              />
              <details>
                <summary className="cursor-pointer text-xs text-text-secondary">
                  Statement and files
                </summary>
                <FilesSection kind="investmentIncome" targetId={i.id} title="Files" />
              </details>
            </li>
          );
        })}
      </ul>
      {!holding.income.length && <p className="text-sm text-text-tertiary">No income recorded.</p>}
      <div className="flex justify-end pt-3">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing && remove.mutateAsync({ holdingId: holding.id, incomeId: removing.id })
        }
        title="Remove payment"
        message="Removes the payment and any units it reinvested. Transactions aren't changed."
        confirmLabel="Remove"
        danger
      />
    </Modal>
  );
}
