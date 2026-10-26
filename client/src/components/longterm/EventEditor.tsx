import { useRef, useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { Modal } from '../ui/Modal';
import type { Plan, PlanEvent, Reductions, StartingPoint } from '../../api/longTerm';
import { draftIssues, incomeSources, kindLabel } from '../../utils/longTerm';
import {
  EscalationField,
  Field,
  MoneyField,
  RateField,
  WholeNumberField,
  WhenField,
} from './fields';

// One editor per kind of life event. It works on a draft held here: opening it saves nothing,
// and the plan changes only when the owner chooses Create (or Save, when editing).

function ReductionsField({
  plan,
  ownId,
  value,
  onChange,
}: {
  plan: Plan;
  ownId: string;
  value: Reductions;
  onChange: (r: Reductions) => void;
}) {
  const sources = incomeSources(plan).filter((s) => s.id !== ownId);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary">Income this replaces</p>
      <p className="text-xs text-text-tertiary">
        Each reduction takes its share of that income, in the order events start. Together they can
        never take more than the income there is.
      </p>
      {sources.map((s) => (
        <RateField
          key={s.id}
          label={`Reduces ${s.name} by`}
          bps={value[s.id] ?? 0}
          min={0}
          max={100}
          onChange={(bps) => {
            const next = { ...value };
            if (bps === 0) delete next[s.id];
            else next[s.id] = bps;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

export function EventEditor({
  initial,
  mode,
  plan,
  point,
  onSave,
  onClose,
  busy,
  error,
  banner,
}: {
  initial: PlanEvent;
  mode: 'create' | 'edit';
  plan: Plan;
  point: StartingPoint | undefined;
  onSave: (event: PlanEvent) => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  /** Shown above the buttons: a save refused because another device changed the plan */
  banner?: ReactNode;
}) {
  const [e, setE] = useState<PlanEvent>(initial);
  const { allValid, report } = useAmountValidity();
  const latest = useRef(e);
  latest.current = e;
  const [showIssues, setShowIssues] = useState(false);
  const issues = draftIssues(e);
  const birthYear = plan.settings.birthYear;
  const patch = (change: Partial<PlanEvent>) => setE((cur) => ({ ...cur, ...change }) as PlanEvent);
  const loans = point?.loans ?? [];

  /**
   * An amount field hands over what was typed when it loses focus, so the field is left first
   * and the draft read after that: Enter and the first click on Create both save what is on
   * screen, not the amount from before.
   */
  function submit() {
    (document.activeElement as HTMLElement | null)?.blur();
    setTimeout(() => {
      const draft = latest.current;
      if (draftIssues(draft).length > 0) setShowIssues(true);
      else onSave(draft);
    }, 0);
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${mode === 'create' ? 'New' : 'Edit'}: ${kindLabel(e.kind)}`}
      size="lg"
    >
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!busy && allValid) submit();
        }}
      >
        <AmountFields report={report}>
          <p className="text-xs text-text-tertiary">
            {mode === 'create'
              ? 'Nothing is saved until you choose Create.'
              : 'Changes are saved when you choose Save.'}
          </p>
          <Field label="Name">
            <Input
              aria-label="Name"
              value={e.name}
              maxLength={100}
              onChange={(x) => patch({ name: x.target.value })}
            />
          </Field>
          <WhenField when={e.start} birthYear={birthYear} onChange={(start) => patch({ start })} />

          {e.kind === 'home' && (
            <div className="space-y-3">
              <Grid>
                <MoneyField
                  label="Purchase price (today's dollars)"
                  value={e.price}
                  onChange={(price) => patch({ price })}
                />
                <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-text-secondary">
                  Deposit
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      aria-label="Deposit type"
                      value={e.deposit.kind}
                      onChange={(x) =>
                        patch({
                          deposit:
                            x.target.value === 'amount'
                              ? { kind: 'amount', cents: Math.round(e.price / 5) }
                              : { kind: 'percent', bps: 2000 },
                        })
                      }
                    >
                      <option value="percent">Percent of price</option>
                      <option value="amount">Dollar amount</option>
                    </Select>
                    {e.deposit.kind === 'percent' ? (
                      <RateField
                        label="Deposit percent"
                        defaultBps={2000}
                        bps={e.deposit.bps}
                        min={0}
                        max={100}
                        onChange={(bps) => patch({ deposit: { kind: 'percent', bps } })}
                      />
                    ) : (
                      <MoneyField
                        label="Deposit amount"
                        value={e.deposit.cents}
                        onChange={(cents) => patch({ deposit: { kind: 'amount', cents } })}
                      />
                    )}
                  </div>
                </div>
                <RateField
                  label="Loan interest rate"
                  bps={e.loanRateBps}
                  min={0}
                  max={100}
                  defaultBps={600}
                  onChange={(loanRateBps) => patch({ loanRateBps })}
                />
                <WholeNumberField
                  label="Loan term (years)"
                  value={e.termYears}
                  min={1}
                  max={50}
                  onChange={(termYears) => patch({ termYears })}
                  hint="Assumption, default 30"
                />
                <MoneyField
                  label="Stamp duty and purchase costs"
                  value={e.purchaseCosts}
                  onChange={(purchaseCosts) => patch({ purchaseCosts })}
                  hint="Enter the amount; there is no state duty table"
                />
                <RateField
                  label="Property growth"
                  bps={e.propertyGrowthBps}
                  min={-50}
                  max={15}
                  defaultBps={300}
                  onChange={(propertyGrowthBps) => patch({ propertyGrowthBps })}
                />
                <MoneyField
                  label="Council and water rates, per year"
                  value={e.annualRates}
                  onChange={(annualRates) => patch({ annualRates })}
                  hint="Today's dollars, rising with inflation"
                />
                <MoneyField
                  label="Insurance, per year"
                  value={e.annualInsurance}
                  onChange={(annualInsurance) => patch({ annualInsurance })}
                  hint="Today's dollars, rising with inflation"
                />
                <MoneyField
                  label="Rent today, per month"
                  value={e.rentMonthly}
                  onChange={(rentMonthly) => patch({ rentMonthly })}
                />
                <MoneyField
                  label="Monthly repayment (leave 0 to calculate it)"
                  value={e.repaymentOverride ?? 0}
                  onChange={(cents) => patch({ repaymentOverride: cents > 0 ? cents : undefined })}
                />
              </Grid>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={e.replaceRent}
                  onChange={(x) => patch({ replaceRent: x.target.checked })}
                />
                The home replaces my rent
              </label>
              <p className="text-xs text-text-tertiary">
                The deposit and costs are paid in the year you buy, from your cash flow and then
                your savings. Loan repayments start the year after, and the property starts growing
                then.
              </p>
            </div>
          )}

          {e.kind === 'newJob' && (
            <div className="space-y-3">
              <Grid>
                <MoneyField
                  label="Take-home pay per year (today's dollars)"
                  value={e.takeHome}
                  onChange={(takeHome) => patch({ takeHome })}
                />
                <MoneyField
                  label="Gross salary super is paid on"
                  value={e.grossSalary}
                  onChange={(grossSalary) => patch({ grossSalary })}
                  hint="Income here is take-home, so enter the gross salary for super"
                />
                <MoneyField
                  label="Signing bonus (today's dollars)"
                  value={e.signingBonus}
                  onChange={(signingBonus) => patch({ signingBonus })}
                />
              </Grid>
              <EscalationField
                value={e.escalation}
                onChange={(escalation) => patch({ escalation })}
              />
              <ReductionsField
                plan={plan}
                ownId={e.id}
                value={e.reductions}
                onChange={(reductions) => patch({ reductions })}
              />
            </div>
          )}

          {e.kind === 'careerBreak' && (
            <div className="space-y-3">
              <Grid>
                <WholeNumberField
                  label="Length of the break (years)"
                  value={e.durationYears}
                  min={1}
                  max={100}
                  onChange={(durationYears) => patch({ durationYears })}
                />
                <RateField
                  label="Spending during the break (percent of normal)"
                  bps={e.spendingMultiplierBps}
                  min={0}
                  max={500}
                  defaultBps={10000}
                  onChange={(spendingMultiplierBps) => patch({ spendingMultiplierBps })}
                />
              </Grid>
              <ReductionsField
                plan={plan}
                ownId={e.id}
                value={e.reductions}
                onChange={(reductions) => patch({ reductions })}
              />
            </div>
          )}

          {e.kind === 'child' && (
            <div className="space-y-3">
              <Grid>
                <MoneyField
                  label="Upfront cost (today's dollars)"
                  value={e.upfrontCost}
                  onChange={(upfrontCost) => patch({ upfrontCost })}
                />
                <MoneyField
                  label="Cost per year (today's dollars)"
                  value={e.annualCost}
                  onChange={(annualCost) => patch({ annualCost })}
                />
                <WholeNumberField
                  label="Years of yearly costs"
                  value={e.years}
                  min={1}
                  max={100}
                  onChange={(years) => patch({ years })}
                  hint="For an existing child, enter the years remaining"
                />
              </Grid>
              <EscalationField
                value={e.escalation}
                onChange={(escalation) => patch({ escalation })}
              />
              <p className="text-xs text-text-tertiary">
                Take these costs out of your usual spending, or they are counted twice.
              </p>
            </div>
          )}

          {e.kind === 'oneOff' && (
            <div className="space-y-3">
              <MoneyField
                label="Amount (negative for an expense)"
                allowNegative
                value={e.amount}
                onChange={(amount) => patch({ amount })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={e.todaysDollars}
                  onChange={(x) => patch({ todaysDollars: x.target.checked })}
                />
                The amount is in today's dollars (it rises with inflation to its year)
              </label>
            </div>
          )}

          {e.kind === 'recurring' && (
            <div className="space-y-3">
              <Grid>
                <MoneyField
                  label="Amount each time (negative for an expense)"
                  allowNegative
                  value={e.amount}
                  onChange={(amount) => patch({ amount })}
                />
                <WholeNumberField
                  label="Repeats every (years)"
                  value={e.everyYears}
                  min={1}
                  max={100}
                  onChange={(everyYears) => patch({ everyYears })}
                />
                <Field label="Last year">
                  <Input
                    aria-label="Last year"
                    type="number"
                    placeholder="No end"
                    value={e.endYear ?? ''}
                    onChange={(x) =>
                      patch({
                        endYear: x.target.value === '' ? null : Math.trunc(Number(x.target.value)),
                      })
                    }
                  />
                </Field>
              </Grid>
              <EscalationField
                value={e.escalation}
                onChange={(escalation) => patch({ escalation })}
              />
            </div>
          )}

          {e.kind === 'retirement' && (
            <div className="space-y-3">
              <RateField
                label="Spending after retiring (percent of normal)"
                bps={e.spendingMultiplierBps}
                min={0}
                max={500}
                defaultBps={10000}
                onChange={(spendingMultiplierBps) => patch({ spendingMultiplierBps })}
              />
              <ReductionsField
                plan={plan}
                ownId={e.id}
                value={e.reductions}
                onChange={(reductions) => patch({ reductions })}
              />
              <p className="text-xs text-text-tertiary">
                Employer super and salary sacrifice stop with your pay. Your super opens up once you
                have retired and reached the preservation age ({plan.settings.preservationAge}), or
                at 65 regardless, and then pays at least the minimum pension each year. Set an Age
                Pension in Assumptions.
              </p>
            </div>
          )}

          {e.kind === 'payOff' && (
            <div className="space-y-3">
              <Grid>
                <Field label="Loan">
                  <Select
                    aria-label="Loan"
                    value={e.loanId}
                    onChange={(x) => patch({ loanId: x.target.value })}
                  >
                    <option value="">Choose a loan</option>
                    {loans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <MoneyField
                  label="Amount (leave 0 to pay it all off)"
                  value={e.amount ?? 0}
                  onChange={(cents) => patch({ amount: cents > 0 ? cents : null })}
                />
              </Grid>
              {loans.length === 0 && (
                <p className="text-xs text-text-tertiary">You have no loan or debt accounts yet.</p>
              )}
              <p className="text-xs text-text-tertiary">
                Paid from your cash flow and then your savings in the year you choose. Enter the
                loan's rate and repayment under Accounts so its balance runs down.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={e.enabled}
              onChange={(x) => patch({ enabled: x.target.checked })}
            />
            Include in the forecast
          </label>
        </AmountFields>
        {issues.length > 0 && (
          <ul
            className={`text-xs list-disc pl-5 ${showIssues ? 'text-negative' : 'text-text-tertiary'}`}
            aria-label="Still to fill in"
          >
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        {banner}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !allValid}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
