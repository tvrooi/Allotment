import { useMemo, useState } from 'react';
import { TAX_LABEL_NAMES } from '../../utils/taxLabels';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Combobox } from '../ui/Combobox';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { fieldBase, fieldStates } from '../ui/fieldClasses';
import { percentRangeMessage } from '../ui/fieldMessages';
import { AmountFields, useAmountValidity } from '../ui/amountValidity';
import { CategorySelectButton } from '../transactions/CategorySelectButton';
import { MerchantSelect } from '../transactions/MerchantSelect';
import { OptionPicker, type OptionPickerKind, type PickerOption } from './OptionPicker';
import { useRuleLookups } from './useRuleLookups';
import { testConditions } from '../../api/rules';
import { useDebounce } from '../../hooks/useDebounce';
import { newClientId } from '../../utils/offline';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { formatCurrency } from '../../utils/currency';
import {
  ACTION_TYPES,
  CONDITION_FIELDS,
  FIELD_HINTS,
  isConditionComplete,
  isRuleComplete,
  makeAction,
  makeCondition,
  newAction,
  newCondition,
  newSplitPart,
  opLabel,
} from '../../utils/ruleFormat';
import type {
  RuleAction,
  RuleCondition,
  RuleConditionField,
  RuleConditionOp,
  RuleInput,
  RuleSplitPart,
} from '../../types';
import { formatDay } from '../../utils/dates';

const NONE_OPTION = '__none__';

const CONDITIONS_OP_OPTIONS = [
  { value: 'and', label: 'all' },
  { value: 'or', label: 'any' },
] as const;

const FIELD_OPTIONS = CONDITION_FIELDS.map((f) => ({ value: f.value, label: f.label }));

const DIRECTION_OPTIONS = [
  { value: 'outflow', label: 'Is an outflow' },
  { value: 'inflow', label: 'Is an inflow' },
] as const;

const ACTION_OPTIONS = ACTION_TYPES.map((t) => ({ value: t.value, label: t.label }));

const TAX_LABEL_OPTIONS = Object.entries(TAX_LABEL_NAMES).map(([label, name]) => ({
  value: label,
  label: `${label} ${name}`,
}));

const SPLIT_KIND_OPTIONS = [
  { value: 'fixed', label: 'Amount' },
  { value: 'percent', label: 'Percent' },
  { value: 'remainder', label: 'Remainder' },
] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initial: RuleInput;
  /** Offer "apply to existing transactions" (checked by default when true) */
  applyDefault?: boolean;
  saving?: boolean;
  onSave: (rule: RuleInput, applyToExisting: boolean) => void;
}

export function RuleEditorModal({
  isOpen,
  onClose,
  title,
  initial,
  applyDefault = false,
  saving,
  onSave,
}: Props) {
  const [conditionsOp, setConditionsOp] = useState(initial.conditionsOp);
  const [conditions, setConditions] = useState<RuleCondition[]>(initial.conditions);
  const [actions, setActions] = useState<RuleAction[]>(
    initial.actions.length ? initial.actions : [newAction()],
  );
  const [applyExisting, setApplyExisting] = useState(applyDefault);
  const options = useRuleLookups();
  const canSave = useCanSave();

  const rule: RuleInput = { ...initial, conditionsOp, conditions, actions };
  const complete = isRuleComplete(rule);
  // Amounts in conditions or split parts that can't be read: the rule would keep the old ones
  const { allValid: amountsValid, report } = useAmountValidity();

  const setCondition = (i: number, c: RuleCondition) =>
    setConditions((cs) => cs.map((x, j) => (j === i ? c : x)));
  const setAction = (i: number, a: RuleAction) =>
    setActions((as) => as.map((x, j) => (j === i ? a : x)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <AmountFields report={report}>
        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-2 text-sm text-text-secondary">
              <span className="font-medium">If</span>
              <Select
                aria-label="How conditions combine"
                fieldSize="sm"
                options={CONDITIONS_OP_OPTIONS}
                value={conditionsOp}
                onChange={(v) => setConditionsOp(v as 'and' | 'or')}
                className="w-20"
              />
              <span>of these conditions match</span>
            </div>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  condition={c}
                  options={options}
                  onChange={(next) => setCondition(i, next)}
                  onRemove={() => setConditions((cs) => cs.filter((_, j) => j !== i))}
                />
              ))}
              {!conditions.length && (
                <p className="text-xs text-caution bg-caution-subtle rounded-lg px-3 py-2">
                  No conditions: this rule applies to every transaction.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setConditions((cs) => [...cs, newCondition()])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              <Plus size={12} /> Add condition
            </button>
          </section>

          <section>
            <p className="text-sm font-medium text-text-secondary mb-2">Then</p>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <ActionRow
                  key={i}
                  action={a}
                  canRemove={actions.length > 1}
                  onChange={(next) => setAction(i, next)}
                  onRemove={() => setActions((as) => as.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActions((as) => [...as, newAction()])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              <Plus size={12} /> Add action
            </button>
          </section>

          <MatchPreview conditionsOp={conditionsOp} conditions={conditions} options={options} />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-light">
            <Checkbox
              checked={applyExisting}
              onCheckedChange={setApplyExisting}
              className="text-text-secondary"
            >
              Apply to existing transactions after saving
            </Checkbox>
            <div className="flex items-center gap-3 ml-auto">
              <SavingPausedHint />
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => onSave(rule, applyExisting)}
                disabled={!complete || !amountsValid || saving || !canSave}
              >
                {saving ? 'Saving…' : 'Save rule'}
              </Button>
            </div>
          </div>
        </div>
      </AmountFields>
    </Modal>
  );
}

type Options = ReturnType<typeof useRuleLookups>;

function ConditionRow({
  condition: c,
  options,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  options: Options;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  const fieldDef = CONDITION_FIELDS.find((f) => f.value === c.field)!;
  const hint = FIELD_HINTS[c.field];
  const opOptions = fieldDef.ops.map((op) => ({ value: op, label: opLabel(c.field, op) }));

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div title={hint} className="w-44">
        <Select
          aria-label="Field"
          fieldSize="sm"
          options={FIELD_OPTIONS}
          value={c.field}
          onChange={(v) => {
            const field = v as RuleConditionField;
            const ops = CONDITION_FIELDS.find((f) => f.value === field)!.ops;
            onChange(makeCondition(field, ops.includes(c.op) ? c.op : ops[0], c));
          }}
        />
      </div>
      {c.field !== 'direction' && (
        <Select
          aria-label="Operator"
          fieldSize="sm"
          options={opOptions}
          value={c.op}
          onChange={(v) => onChange(makeCondition(c.field, v as RuleConditionOp, c))}
          className="w-40"
        />
      )}
      <div className="flex-1 min-w-48 flex gap-2 items-center">
        <ConditionValue condition={c} options={options} onChange={onChange} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-text-tertiary hover:text-negative transition-colors cursor-pointer"
        aria-label="Remove condition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ConditionValue({
  condition: c,
  options,
  onChange,
}: {
  condition: RuleCondition;
  options: Options;
  onChange: (c: RuleCondition) => void;
}) {
  if (!('value' in c)) return null;
  const set = (value: unknown) => onChange({ ...c, value } as RuleCondition);

  if (c.field === 'direction') {
    return (
      <Select
        aria-label="Direction"
        fieldSize="sm"
        options={DIRECTION_OPTIONS}
        value={c.value}
        onChange={set}
        className="w-40"
      />
    );
  }
  if (c.field === 'amount') {
    const money = (value: number, onValue: (n: number) => void, ariaLabel: string) => (
      <CurrencyInput
        value={value}
        onChange={onValue}
        fieldSize="sm"
        aria-label={ariaLabel}
        className="w-full"
      />
    );
    if (Array.isArray(c.value)) {
      const [lo, hi] = c.value;
      return (
        <>
          {money(lo, (n) => set([n, hi]), 'Minimum amount')}
          <span className="text-xs text-text-tertiary">and</span>
          {money(hi, (n) => set([lo, n]), 'Maximum amount')}
        </>
      );
    }
    return money(c.value, set, 'Amount');
  }
  if (c.field === 'date') {
    const picker = (value: string, onValue: (v: string) => void, label: string) => (
      <DatePicker label={label} hideLabel fieldSize="sm" value={value} onChange={onValue} />
    );
    if (Array.isArray(c.value)) {
      const [a, b] = c.value;
      return (
        <>
          {picker(a, (v) => set([v, b]), 'Start date')}
          <span className="text-xs text-text-tertiary">and</span>
          {picker(b, (v) => set([a, v]), 'End date')}
        </>
      );
    }
    return picker(c.value, set, 'Date');
  }

  const idFields: Record<
    string,
    { options: PickerOption[]; kind: OptionPickerKind; label: string }
  > = {
    payee: { options: options.payeeOptions, kind: 'payee', label: 'Payee' },
    account: { options: options.accountOptions, kind: 'account', label: 'Account' },
    category: { options: options.categoryOptions, kind: 'category', label: 'Category' },
  };
  const pickFrom = idFields[c.field];
  if (pickFrom) {
    return Array.isArray(c.value) ? (
      <OptionPicker
        multiple
        kind={pickFrom.kind}
        label={pickFrom.label}
        options={pickFrom.options}
        value={c.value}
        onChange={set}
        placeholder="Choose one or more…"
      />
    ) : (
      <OptionPicker
        kind={pickFrom.kind}
        label={pickFrom.label}
        options={pickFrom.options}
        value={c.value}
        onChange={set}
        placeholder="Choose…"
      />
    );
  }
  if (Array.isArray(c.value)) return <TagInput value={c.value} onChange={set} />;
  return (
    <Field label="Match value" className="w-full [&>label]:sr-only">
      <Input
        fieldSize="sm"
        value={c.value}
        onChange={(e) => set(e.target.value)}
        placeholder={c.op === 'regex' ? 'e.g. ^(amzn|amazon)' : 'Text…'}
        maxLength={c.op === 'regex' ? 200 : 500}
        className={`w-full ${c.op === 'regex' ? 'font-mono' : ''}`}
      />
    </Field>
  );
}

/** Free-text list: Enter or comma adds an entry, Backspace on an empty box removes the last */
export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div
      className={`${fieldBase} ${fieldStates} w-full min-h-8 max-md:min-h-11 flex flex-wrap items-center gap-1 py-1 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600`}
    >
      {value.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-surface-alt text-xs text-text"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="text-text-tertiary hover:text-negative cursor-pointer"
            aria-label={`Remove ${v}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <Input
        fieldSize="sm"
        aria-label="Match values"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? '' : 'Type and press Enter…'}
        className="flex-1 min-w-24 h-6! min-h-0! border-0! bg-transparent! px-0! py-0.5! focus:ring-0!"
      />
    </div>
  );
}

function ActionRow({
  action: a,
  canRemove,
  onChange,
  onRemove,
}: {
  action: RuleAction;
  canRemove: boolean;
  onChange: (a: RuleAction) => void;
  onRemove: () => void;
}) {
  const { lookups, tagOptions, householdOptions } = useRuleLookups();
  return (
    <div className="rounded-lg">
      <div className="flex flex-wrap items-start gap-2">
        <Select
          aria-label="Action"
          fieldSize="sm"
          options={ACTION_OPTIONS}
          value={a.type}
          onChange={(v) => onChange(makeAction(v as RuleAction['type'], a))}
          className="w-52"
        />
        <div className="flex-1 min-w-48">
          {a.type === 'set_category' && (
            <CategorySelectButton
              value={a.value || null}
              onChange={(id) => onChange({ ...a, value: id ?? '' })}
              placeholder="Choose a category…"
            />
          )}
          {a.type === 'set_payee' && (
            <MerchantSelect
              value={{ id: a.value || null, name: (a.value && lookups.payee(a.value)) || '' }}
              onChange={(v) => onChange({ ...a, value: v.id ?? '' })}
              placeholder="Choose or create a payee…"
            />
          )}
          {(a.type === 'set_notes' || a.type === 'prepend_notes' || a.type === 'append_notes') && (
            <Field label="Notes text" className="w-full [&>label]:sr-only">
              <Input
                fieldSize="sm"
                value={a.value}
                onChange={(e) => onChange({ ...a, value: e.target.value })}
                placeholder={
                  a.type === 'set_notes' ? 'Leave empty to clear notes' : 'e.g. #business '
                }
                maxLength={5000}
                className="w-full"
              />
            </Field>
          )}
          {a.type === 'add_tag' &&
            (tagOptions.length ? (
              <Combobox
                aria-label="Tag"
                fieldSize="sm"
                items={[
                  { value: NONE_OPTION, label: 'Choose a tag…' },
                  ...tagOptions.map((t) => ({ value: t.id, label: t.label })),
                ]}
                value={a.value || NONE_OPTION}
                onChange={(v) => {
                  if (v) onChange({ ...a, value: v === NONE_OPTION ? '' : v });
                }}
              />
            ) : (
              <p className="text-xs text-text-tertiary pt-2">
                Create a tag first in Settings → Tags or a transaction's details.
              </p>
            ))}
          {a.type === 'share_with_household' &&
            (householdOptions.length ? (
              <>
                <Combobox
                  aria-label="Household"
                  fieldSize="sm"
                  items={[
                    { value: NONE_OPTION, label: 'Choose a household…' },
                    ...householdOptions.map((h) => ({ value: h.id, label: h.label })),
                  ]}
                  value={a.value || NONE_OPTION}
                  onChange={(v) => {
                    if (v) onChange({ ...a, value: v === NONE_OPTION ? '' : v });
                  }}
                />
                <p className="text-xs text-text-tertiary pt-1">
                  Money out becomes a shared household expense, with the household's default split.
                </p>
              </>
            ) : (
              <p className="text-xs text-text-tertiary pt-2">Create a household first.</p>
            ))}
          {a.type === 'claim_tax_deduction' && (
            <>
              <Select
                aria-label="Tax return label"
                fieldSize="sm"
                options={TAX_LABEL_OPTIONS}
                value={a.value}
                onChange={(v) => onChange({ ...a, value: v })}
              />
              <p className="text-xs text-text-tertiary pt-1">
                Money out is claimed in full under this label; change the work-use share on the
                transaction. A claim you made yourself is never replaced.
              </p>
            </>
          )}
          {a.type === 'split' && (
            <p className="text-xs text-text-tertiary pt-2">
              Splits the transaction into parts, each with its own category.
            </p>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-text-tertiary hover:text-negative transition-colors cursor-pointer"
            aria-label="Remove action"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {a.type === 'split' && (
        <SplitEditor parts={a.parts} onChange={(parts) => onChange({ ...a, parts })} />
      )}
    </div>
  );
}

// newClientId uses crypto.getRandomValues, which plain-HTTP self-hosted origins have; randomUUID needs a secure context
const newRowKey = () => newClientId();

export function SplitEditor({
  parts,
  onChange,
}: {
  parts: RuleSplitPart[];
  onChange: (p: RuleSplitPart[]) => void;
}) {
  const [keys, setKeys] = useState<string[]>(() => parts.map(newRowKey));
  if (keys.length < parts.length) {
    setKeys([...keys, ...Array.from({ length: parts.length - keys.length }, newRowKey)]);
  } else if (keys.length > parts.length) {
    setKeys(keys.slice(0, parts.length));
  }
  const set = (i: number, patch: Partial<RuleSplitPart>) =>
    onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const pctTotal = parts.filter((p) => p.kind === 'percent').reduce((s, p) => s + p.value, 0);
  const hasRemainder = parts.some((p) => p.kind === 'remainder');

  return (
    <div className="mt-2 ml-2 pl-4 border-l-2 border-border-light space-y-2">
      {parts.map((p, i) => (
        <div key={keys[i] ?? i} className="flex flex-wrap items-start gap-2">
          <Select
            aria-label="Split amount type"
            fieldSize="sm"
            options={SPLIT_KIND_OPTIONS}
            value={p.kind}
            onChange={(v) => {
              const kind = v as RuleSplitPart['kind'];
              set(i, { kind, value: kind === 'percent' ? 50 : 0 });
            }}
            className="w-32"
          />
          <div className="w-28">
            {p.kind === 'fixed' && (
              <CurrencyInput
                value={p.value}
                onChange={(n) => set(i, { value: n })}
                fieldSize="sm"
                aria-label="Split amount"
                className="w-full"
              />
            )}
            {p.kind === 'percent' && (
              <NumberField
                label="Split percentage"
                value={p.value}
                onChange={(n) => {
                  if (n !== null) set(i, { value: n });
                }}
                min={0}
                max={100}
                allowDecimal
                suffix="%"
                fieldSize="sm"
                errorMessage={percentRangeMessage(0, 100)}
                className="w-full [&>label]:sr-only"
              />
            )}
            {p.kind === 'remainder' && (
              <span className="flex h-8 items-center text-xs text-text-tertiary">What's left</span>
            )}
          </div>
          <div className="flex-1 min-w-40">
            <CategorySelectButton
              value={p.categoryId}
              onChange={(id) => set(i, { categoryId: id })}
              placeholder="Category…"
            />
          </div>
          <Field label="Split notes" className="w-32 [&>label]:sr-only">
            <Input
              fieldSize="sm"
              value={p.notes ?? ''}
              onChange={(e) => set(i, { notes: e.target.value || null })}
              placeholder="Notes"
              maxLength={5000}
              className="w-full"
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              setKeys((ks) => ks.filter((_, j) => j !== i));
              onChange(parts.filter((_, j) => j !== i));
            }}
            disabled={parts.length === 1}
            className="p-1.5 text-text-tertiary hover:text-negative disabled:opacity-30 transition-colors cursor-pointer"
            aria-label="Remove split"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setKeys((ks) => [...ks, newRowKey()]);
            onChange([...parts, newSplitPart(hasRemainder ? 'fixed' : 'remainder')]);
          }}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
        >
          <Plus size={12} /> Add split
        </button>
        {pctTotal > 100 ? (
          <span className="text-xs text-negative">Percents add up to more than 100%.</span>
        ) : (
          !hasRemainder && (
            <span className="text-xs text-text-tertiary">
              Anything left over stays uncategorised.
            </span>
          )
        )}
      </div>
    </div>
  );
}

function MatchPreview({
  conditionsOp,
  conditions,
  options,
}: {
  conditionsOp: 'and' | 'or';
  conditions: RuleCondition[];
  options: Options;
}) {
  const ready = conditions.every(isConditionComplete);
  const key = useDebounce(JSON.stringify({ conditionsOp, conditions }), 350);
  const { data, isFetching } = useQuery({
    queryKey: ['rules', 'test', key],
    queryFn: () => {
      const parsed = JSON.parse(key) as { conditionsOp: 'and' | 'or'; conditions: RuleCondition[] };
      return testConditions(parsed.conditionsOp, parsed.conditions);
    },
    enabled: ready,
    placeholderData: (prev) => prev,
  });
  const shown = useMemo(() => data?.matches.slice(0, 5) ?? [], [data]);

  return (
    <section className="rounded-lg border border-border-light overflow-hidden">
      <div className="px-3 py-2 bg-surface-alt border-b border-border-light text-xs font-medium text-text-secondary">
        {!ready
          ? 'Fill in every condition to see matching transactions'
          : !data
            ? 'Checking…'
            : data.count === 0
              ? 'No transactions match yet'
              : `Matches ${data.count.toLocaleString()} transaction${data.count === 1 ? '' : 's'}${data.count > shown.length ? ` · showing the latest ${shown.length}` : ''}`}
        {isFetching && data && <span className="ml-2 text-text-tertiary">updating…</span>}
      </div>
      {ready &&
        shown.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 px-3 py-1.5 text-xs border-b last:border-b-0 border-border-light"
          >
            <span className="w-20 shrink-0 text-text-tertiary">{formatDay(tx.date)}</span>
            <span className="flex-1 truncate text-text">{tx.payeeName ?? '—'}</span>
            <span className="hidden sm:block w-40 truncate text-text-tertiary">
              {(tx.categoryId && options.lookups.category(tx.categoryId)) || 'Uncategorised'}
            </span>
            <span
              className={`w-24 text-right tabular-nums ${tx.amount < 0 ? 'text-text' : 'text-positive'}`}
            >
              {formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
    </section>
  );
}
