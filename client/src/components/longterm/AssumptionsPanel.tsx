import type { Dispatch, SetStateAction } from 'react';
import type { AccountClass, Defaults, Plan, PlanSettings, StartingPoint } from '../../api/longTerm';
import { formatCurrency } from '../../utils/currency';
import { CLASS_LABEL } from '../../utils/longTerm';
import { EscalationField, MoneyField, RateField, WholeNumberField } from './fields';

/** An amount that starts from the budget's own figure unless the owner types one */
function OverrideMoney({
  label,
  value,
  budget,
  budgetNote,
  onChange,
}: {
  label: string;
  value: number | null;
  budget: number;
  budgetNote: string;
  onChange: (cents: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={label} checked={value === null} onChange={() => onChange(null)} />
        From my budget: {formatCurrency(budget)} a year
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={label}
          checked={value !== null}
          onChange={() => onChange(value ?? budget)}
        />
        Use my own figure
      </label>
      {value !== null && (
        <MoneyField
          label={`${label}: my figure per year (today's dollars)`}
          value={value}
          onChange={onChange}
        />
      )}
      <p className="text-xs text-text-tertiary">{budgetNote}</p>
    </div>
  );
}

const CLASSES: AccountClass[] = ['cash', 'investments', 'super', 'property', 'vehicles', 'other'];

/** Every rate and age the forecast rests on. Each is an assumption: its default is shown beside it. */
export function AssumptionsPanel({
  plan,
  setPlan,
  point,
  defaults,
}: {
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  point: StartingPoint | undefined;
  defaults: Defaults | undefined;
}) {
  const s = plan.settings;
  const d = defaults?.settings;
  const set = (change: Partial<PlanSettings>) =>
    setPlan((p) => ({ ...p, settings: { ...p.settings, ...change } }));
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        A forecast is a projection, not a promise. Every rate and age below is an assumption you can
        change; the default is shown beside it. Income is take-home pay, so there is no income tax.
      </p>

      <section aria-label="You" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">You and the plan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <WholeNumberField
            label="Birth year"
            value={s.birthYear}
            min={1900}
            max={2100}
            onChange={(birthYear) => set({ birthYear })}
          />
          <WholeNumberField
            label="Plan until age"
            value={s.endAge}
            min={30}
            max={110}
            onChange={(endAge) => set({ endAge })}
            hint={`Assumption, default ${d?.endAge ?? 95}`}
          />
          <RateField
            label="Inflation"
            bps={s.inflationBps}
            min={-20}
            max={15}
            defaultBps={d?.inflationBps ?? 250}
            onChange={(inflationBps) => set({ inflationBps })}
          />
        </div>
      </section>

      <section aria-label="Income and spending" className="space-y-4">
        <h3 className="text-sm font-semibold text-text">Income and spending</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OverrideMoney
            label="Take-home income"
            value={s.income.takeHome}
            budget={point?.income.annualTakeHome ?? 0}
            budgetNote={
              point?.income.source === 'payday'
                ? 'Expected take-home on your payday plans over the next year.'
                : 'You have no payday plan, so enter your own figure.'
            }
            onChange={(takeHome) => set({ income: { ...s.income, takeHome } })}
          />
          <OverrideMoney
            label="Spending"
            value={s.spending.annual}
            budget={point?.spending.annual ?? 0}
            budgetNote={`The last ${point?.spending.days ?? 365} days of spending, scaled to a year. Loan repayments are not in it: they are modelled as loans.`}
            onChange={(annual) => set({ spending: { ...s.spending, annual } })}
          />
          <EscalationField
            label="Income changes each year"
            value={s.income.escalation}
            onChange={(escalation) => set({ income: { ...s.income, escalation } })}
          />
          <EscalationField
            label="Spending changes each year"
            value={s.spending.escalation}
            onChange={(escalation) => set({ spending: { ...s.spending, escalation } })}
          />
        </div>
      </section>

      <section aria-label="Super" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Super and the Age Pension</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MoneyField
            label="Gross salary super is paid on"
            value={s.income.grossForSuper}
            onChange={(grossForSuper) => set({ income: { ...s.income, grossForSuper } })}
            hint="Income here is take-home, so enter the gross salary. 0 means no employer super."
          />
          <RateField
            label="Super guarantee rate"
            bps={s.superGuaranteeBps}
            min={0}
            max={30}
            defaultBps={d?.superGuaranteeBps ?? 1200}
            onChange={(superGuaranteeBps) => set({ superGuaranteeBps })}
          />
          <RateField
            label="Contributions tax"
            bps={s.contributionsTaxBps}
            min={0}
            max={50}
            defaultBps={d?.contributionsTaxBps ?? 1500}
            onChange={(contributionsTaxBps) => set({ contributionsTaxBps })}
          />
          <WholeNumberField
            label="Preservation age"
            value={s.preservationAge}
            min={40}
            max={75}
            onChange={(preservationAge) => set({ preservationAge })}
            hint={`Assumption, default ${d?.preservationAge ?? 60}. Super is drawn only after retirement and this age.`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.agePension.enabled}
            onChange={(e) => set({ agePension: { ...s.agePension, enabled: e.target.checked } })}
          />
          Include the Age Pension
        </label>
        {s.agePension.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyField
              label="Age Pension per year (today's dollars)"
              value={s.agePension.annual}
              onChange={(annual) => set({ agePension: { ...s.agePension, annual } })}
              hint="An amount you type: the means test is not calculated"
            />
            <WholeNumberField
              label="Age Pension starts at age"
              value={s.agePension.startAge}
              min={50}
              max={100}
              onChange={(startAge) => set({ agePension: { ...s.agePension, startAge } })}
              hint="Assumption, default 67"
            />
          </div>
        )}
      </section>

      <section aria-label="Growth" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Yearly growth by kind of account</h3>
        <p className="text-xs text-text-tertiary">
          A single account can have its own rate under Accounts. These are returns after fees; tax
          on earnings is not modelled.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CLASSES.map((c) => (
            <RateField
              key={c}
              label={`${CLASS_LABEL[c]} growth`}
              bps={s.classGrowthBps[c]}
              min={-50}
              max={15}
              defaultBps={defaults?.classGrowthBps[c]}
              onChange={(bps) => set({ classGrowthBps: { ...s.classGrowthBps, [c]: bps } })}
            />
          ))}
          <RateField
            label="Extra savings growth"
            bps={s.extraSavingsGrowthBps}
            min={-50}
            max={15}
            defaultBps={d?.extraSavingsGrowthBps ?? 200}
            onChange={(extraSavingsGrowthBps) => set({ extraSavingsGrowthBps })}
          />
        </div>
      </section>
    </div>
  );
}
