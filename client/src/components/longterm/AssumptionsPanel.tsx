import type { Dispatch, SetStateAction } from 'react';
import type {
  AccountClass,
  Defaults,
  Plan,
  PlanSettings,
  StartingPoint,
  SuperSettings,
} from '../../api/longTerm';
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
  const sup = s.super;
  const setSuper = (change: Partial<SuperSettings>) =>
    setPlan((p) => ({
      ...p,
      settings: { ...p.settings, super: { ...p.settings.super, ...change } },
    }));
  const study = s.studyLoans;
  const setStudy = (change: Partial<PlanSettings['studyLoans']>) =>
    setPlan((p) => ({
      ...p,
      settings: { ...p.settings, studyLoans: { ...p.settings.studyLoans, ...change } },
    }));
  const hasStudyLoans = !!point?.loans.some((l) => l.type === 'student_loan');
  const capHint = (cents: number | undefined) =>
    `Default ${formatCurrency(cents ?? 0)} (2026–27), in today's dollars. Only warned about.`;
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
        <h3 className="text-sm font-semibold text-text">Superannuation and the Age Pension</h3>
        <p className="text-xs text-text-tertiary">
          Super is preserved: it counts towards net worth but cannot pay for anything until a
          condition of release. Here that is turning 65, or retiring at or after your preservation
          age. The chart shows accessible wealth and preserved super separately.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            hint={`Default ${d?.preservationAge ?? 60}, which applies to anyone born after 30 June 1964. Super opens at 65, or on retiring from this age.`}
          />
        </div>
        <h4 className="text-xs font-semibold text-text-secondary">Your own contributions</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MoneyField
            label="Salary sacrifice per year (today's dollars)"
            value={sup.salarySacrifice}
            onChange={(salarySacrifice) => setSuper({ salarySacrifice })}
            hint="Before tax, so it is already out of your take-home pay. Taxed as a concessional contribution, and it stops with your salary."
          />
          <MoneyField
            label="Personal contributions per year (today's dollars)"
            value={sup.personalContribution}
            onChange={(personalContribution) => setSuper({ personalContribution })}
            hint="After tax, paid first from each year's surplus while you work and are under 75. Not taxed going in."
          />
        </div>
        <h4 className="text-xs font-semibold text-text-secondary">Fund costs, tax and pension</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MoneyField
            label="Fees and insurance per year (today's dollars)"
            value={sup.feesAnnual}
            onChange={(feesAnnual) => setSuper({ feesAnnual })}
            hint="Insurance premiums and fixed admin fees. Leave 0 if the super growth rate is already after them."
          />
          <RateField
            label="Tax on super earnings before the pension"
            bps={sup.earningsTaxBps}
            min={0}
            max={45}
            defaultBps={d?.super.earningsTaxBps ?? 0}
            onChange={(earningsTaxBps) => setSuper({ earningsTaxBps })}
            hint="Up to 15%, often 7–10% after franking credits and discounts. Leave 0 when the growth rate is already after tax. A pension's earnings are tax-free."
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={sup.minimumDrawdown}
            onChange={(e) => setSuper({ minimumDrawdown: e.target.checked })}
          />
          <span>
            Pay the minimum pension once retired and released
            <span className="block text-xs text-text-tertiary">
              Each year at least 4% of the balance (5% from 65, rising to 14% from 95) moves from
              super into spendable cash. That money becomes accessible and pays for spending first.
            </span>
          </span>
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer text-text-secondary">
            Contribution and pension caps
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <MoneyField
              label="Concessional cap"
              value={sup.concessionalCap}
              onChange={(concessionalCap) => setSuper({ concessionalCap })}
              hint={capHint(d?.super.concessionalCap)}
            />
            <MoneyField
              label="Non-concessional cap"
              value={sup.nonConcessionalCap}
              onChange={(nonConcessionalCap) => setSuper({ nonConcessionalCap })}
              hint={capHint(d?.super.nonConcessionalCap)}
            />
            <MoneyField
              label="Transfer balance cap"
              value={sup.transferBalanceCap}
              onChange={(transferBalanceCap) => setSuper({ transferBalanceCap })}
              hint={capHint(d?.super.transferBalanceCap)}
            />
          </div>
        </details>
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

      {hasStudyLoans && (
        <section aria-label="Study loans" className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Study loans (HECS-HELP and SSL)</h3>
          <p className="text-xs text-text-tertiary">
            No interest is charged. The debt is indexed each 1 June by the lower of CPI and wage
            growth, and repaid through the tax system: nothing below{' '}
            {formatCurrency(study.bands.threshold)} of repayment income, then{' '}
            {study.bands.firstBps / 100}c of each dollar above it, {study.bands.secondBps / 100}c
            above {formatCurrency(study.bands.second)}, and {study.bands.topBps / 100}% of all of it
            above {formatCurrency(study.bands.third)} (2026–27 bands, rising with inflation here).
            HELP is repaid before a Student Start-up Loan. Repayment income here is your gross
            salary (super above) plus the figure below.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={study.withheldFromPay}
              onChange={(e) => setStudy({ withheldFromPay: e.target.checked })}
            />
            <span>
              My take-home pay already has study loan repayments withheld
              <span className="block text-xs text-text-tertiary">
                Usual when your employer knows about the debt. Once it is repaid, that pay is no
                longer withheld, so your take-home rises.
              </span>
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyField
              label="Other repayment income per year (today's dollars)"
              value={study.otherRepaymentIncome}
              onChange={(otherRepaymentIncome) => setStudy({ otherRepaymentIncome })}
              hint="Taxable income beyond your salary: interest, dividends, rent, reportable fringe benefits."
            />
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={study.indexationBps === null}
                  onChange={(e) =>
                    setStudy({ indexationBps: e.target.checked ? null : s.inflationBps })
                  }
                />
                Index study debts with inflation
              </label>
              {study.indexationBps !== null && (
                <RateField
                  label="Study loan indexation"
                  bps={study.indexationBps}
                  min={0}
                  max={15}
                  onChange={(indexationBps) => setStudy({ indexationBps })}
                  hint="1 June 2026 was 2.8%. Never below 0."
                />
              )}
            </div>
          </div>
        </section>
      )}

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

      <section aria-label="Simulation" className="space-y-3">
        <h3 className="text-sm font-semibold text-text">
          How much returns swing (for the simulation)
        </h3>
        <p className="text-xs text-text-tertiary">
          The typical size of a year's swing around the growth rate. It only affects the Simulation
          tab, never the forecast. Investments and super move together as one market.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(['investments', 'super', 'property'] as AccountClass[]).map((c) => (
            <RateField
              key={c}
              label={`${CLASS_LABEL[c]} volatility`}
              bps={s.volatilityBps[c]}
              min={0}
              max={50}
              defaultBps={d?.volatilityBps[c]}
              onChange={(bps) => set({ volatilityBps: { ...s.volatilityBps, [c]: bps } })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
