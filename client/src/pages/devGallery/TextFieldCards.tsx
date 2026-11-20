import { useCallback, useId, useRef, useState } from 'react';
import { AmountFields, useAmountValidity } from '../../components/ui/amountValidity';
import { Button } from '../../components/ui/Button';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Field } from '../../components/ui/Field';
import { errorClass } from '../../components/ui/fieldClasses';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { NumberField } from '../../components/ui/NumberField';
import { Textarea } from '../../components/ui/Textarea';
import { GalleryCard, Specimen } from './Specimen';

const LONG_LABEL =
  'Reference the bank shows on the statement for this payee, exactly as it appears there';
const LONG_ERROR =
  'This reference is longer than the bank accepts. Shorten it to 18 characters or fewer and try again.';
const LONG_NOTE =
  'Split with Sam for the weekend away. Sam paid the accommodation and the hire car, I covered fuel, groceries and the national park pass. We agreed to settle the difference at the end of the month once the card statement comes through, and to keep the receipts in Files in case the hire company charges for the extra kilometres or the late return.';
const LONG_VALUE =
  'WOOLWORTHS METRO 1234 SYDNEY CENTRAL STATION CONCOURSE NSW AUSTRALIA CARD 4321 VALUE DATE 01/11';

/** A controlled value, so each specimen keeps what is typed into it */
function useText(initial = '') {
  const [value, setValue] = useState(initial);
  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(e.target.value),
  };
}

/** Label beside bare Inputs, tied by id, in each field state: the path existing screens use */
function LabelCard() {
  const id = useId();
  const def = useText();
  const focus = useText();
  const invalid = useText('12 Smith St');
  return (
    <GalleryCard title="Label">
      <Specimen control="Label" state="Default">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-default`}>Account name</Label>
          <Input id={`${id}-default`} placeholder="Everyday" {...def} />
        </div>
      </Specimen>
      <Specimen control="Label" state="Focus">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-focus`} isRequired>
            Nickname
          </Label>
          <Input id={`${id}-focus`} required placeholder="Bills" {...focus} />
        </div>
      </Specimen>
      <Specimen control="Label" state="Disabled">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-disabled`}>Bank</Label>
          <Input id={`${id}-disabled`} disabled value="Up" onChange={() => {}} />
        </div>
      </Specimen>
      <Specimen control="Label" state="Invalid">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-invalid`}>Postcode</Label>
          <Input
            id={`${id}-invalid`}
            isInvalid
            aria-describedby={`${id}-invalid-error`}
            {...invalid}
          />
          <p id={`${id}-invalid-error`} className={errorClass}>
            Enter a four-digit postcode.
          </p>
        </div>
      </Specimen>
      <Specimen control="Label" state="Read-only">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-readonly`}>Account number</Label>
          <Input id={`${id}-readonly`} readOnly value="062-000 1234 5678" />
        </div>
      </Specimen>
    </GalleryCard>
  );
}

/** Field with its Label, help and error parts, in each state, plus help text and long text */
function FieldCard() {
  const def = useText();
  const focus = useText();
  const invalid = useText('A');
  const required = useText();
  const help = useText();
  const long = useText(LONG_VALUE);
  return (
    <GalleryCard title="Field">
      <Specimen control="Field" state="Default">
        <Field label="Payee">
          <Input placeholder="Who was paid" {...def} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Focus">
        <Field label="Memo" isRequired>
          <Input placeholder="What it was for" {...focus} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Disabled">
        <Field label="Imported from" isDisabled description="Set by the bank sync">
          <Input value="Up Everyday" onChange={() => {}} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Invalid">
        <Field label="Category name" errorMessage="Use at least two characters.">
          <Input {...invalid} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Required">
        <Field label="Payee" isRequired isInvalid>
          <Input {...required} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Read-only">
        <Field label="Created" isReadOnly>
          <Input value="1 November 2026" />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Help text">
        <Field label="Statement name" description="As it appears on the bank statement">
          <Input placeholder="WOOLWORTHS 1234" {...help} />
        </Field>
      </Specimen>
      <Specimen control="Field" state="Long text">
        <Field label={LONG_LABEL} errorMessage={LONG_ERROR}>
          <Input {...long} />
        </Field>
      </Specimen>
    </GalleryCard>
  );
}

/** Bare Inputs, named by aria-label, in each state; sm beside the md default */
function InputCard() {
  const def = useText();
  const focus = useText();
  const invalid = useText('-5');
  const small = useText();
  const errorId = useId();
  return (
    <GalleryCard title="Input">
      <Specimen control="Input" state="Default">
        <Input aria-label="Search transactions" placeholder="Search" {...def} />
      </Specimen>
      <Specimen control="Input" state="Focus">
        <Input aria-label="Filter payees" placeholder="Filter" {...focus} />
      </Specimen>
      <Specimen control="Input" state="Disabled">
        <Input
          aria-label="Locked note"
          disabled
          value="Locked by the household"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Input" state="Invalid">
        <div className="flex flex-col gap-1">
          <Input aria-label="Days" isInvalid aria-describedby={errorId} {...invalid} />
          <p id={errorId} className={errorClass}>
            Enter a number of days from 1 to 31.
          </p>
        </div>
      </Specimen>
      <Specimen control="Input" state="Read-only">
        <Input aria-label="Import ID" readOnly value="up-7f3a9c" />
      </Specimen>
      <Specimen control="Input" state="Small">
        <Input aria-label="Quick find" fieldSize="sm" placeholder="Quick find" {...small} />
      </Specimen>
    </GalleryCard>
  );
}

/**
 * Textarea in each state, bare and inside a Field, a long note that scrolls inside it, and the
 * two-row size a budget note uses (no 80 px floor)
 */
function TextareaCard() {
  const def = useText();
  const focus = useText();
  const invalid = useText('x');
  const long = useText(LONG_NOTE);
  const twoRows = useText();
  const errorId = useId();
  return (
    <GalleryCard title="Textarea">
      <Specimen control="Textarea" state="Default">
        <Field label="Notes">
          <Textarea placeholder="Add notes to this transaction" {...def} />
        </Field>
      </Specimen>
      <Specimen control="Textarea" state="Focus">
        <Textarea aria-label="Description" placeholder="What this document is" {...focus} />
      </Specimen>
      <Specimen control="Textarea" state="Disabled">
        <Textarea
          aria-label="Bank memo"
          disabled
          value="Set by the bank sync"
          onChange={() => {}}
        />
      </Specimen>
      <Specimen control="Textarea" state="Invalid">
        <div className="flex flex-col gap-1">
          <Textarea aria-label="Reason" isInvalid aria-describedby={errorId} {...invalid} />
          <p id={errorId} className={errorClass}>
            Use at least two characters.
          </p>
        </div>
      </Specimen>
      <Specimen control="Textarea" state="Read-only">
        <Textarea aria-label="Import note" readOnly value="Imported from Up on 1 November 2026" />
      </Specimen>
      <Specimen control="Textarea" state="Long text">
        <Field label="Shared note" description="Long notes scroll inside the box">
          <Textarea {...long} />
        </Field>
      </Specimen>
      <Specimen control="Textarea" state="Two rows">
        <Field label="Month note">
          <Textarea rows={2} placeholder="Add a note" {...twoRows} />
        </Field>
      </Specimen>
    </GalleryCard>
  );
}

/** Shared bounded NumberField in each state: valid, invalid, optional blank, disabled and sm % */
function NumberFieldCard() {
  const [valid, setValid] = useState<number | null>(12);
  const [invalid, setInvalid] = useState<number | null>(61);
  const [optional, setOptional] = useState<number | null>(null);
  const [small, setSmall] = useState<number | null>(33.5);
  return (
    <GalleryCard title="Number field">
      <Specimen control="NumberField" state="Valid">
        <NumberField
          label="Repeats every (months)"
          value={valid}
          onChange={setValid}
          min={1}
          max={60}
        />
      </Specimen>
      <Specimen control="NumberField" state="Invalid">
        <NumberField
          label="Billing cycle (months)"
          value={invalid}
          onChange={setInvalid}
          min={1}
          max={60}
        />
      </Specimen>
      <Specimen control="NumberField" state="Optional">
        <NumberField
          label="Last year"
          value={optional}
          onChange={setOptional}
          min={1900}
          max={2300}
          optional
        />
      </Specimen>
      <Specimen control="NumberField" state="Disabled">
        <NumberField
          label="Minimum payments"
          value={12}
          onChange={() => {}}
          min={1}
          max={60}
          isDisabled
        />
      </Specimen>
      <Specimen control="NumberField" state="Small">
        <NumberField
          label="Split percentage"
          value={small}
          onChange={setSmall}
          min={0}
          max={100}
          allowDecimal
          fieldSize="sm"
          suffix="%"
        />
      </Specimen>
    </GalleryCard>
  );
}

/** CurrencyInput at md and sm, plus arithmetic expression support */
function MoneyCard() {
  const [empty, setEmpty] = useState(0);
  const [filled, setFilled] = useState(12345);
  const [small, setSmall] = useState(4250);
  const [expression, setExpression] = useState(15000);
  return (
    <GalleryCard title="Money field">
      <Specimen control="CurrencyInput" state="Empty">
        <CurrencyInput aria-label="Amount" value={empty} onChange={setEmpty} />
      </Specimen>
      <Specimen control="CurrencyInput" state="Filled">
        <CurrencyInput aria-label="Opening balance" value={filled} onChange={setFilled} />
      </Specimen>
      <Specimen control="CurrencyInput" state="Small">
        <CurrencyInput aria-label="Cell amount" value={small} onChange={setSmall} fieldSize="sm" />
      </Specimen>
      <Specimen control="CurrencyInput" state="Expression">
        <CurrencyInput
          aria-label="Budget expression"
          value={expression}
          onChange={setExpression}
          expression
        />
      </Specimen>
    </GalleryCard>
  );
}

/** Keep focus inside the input when clicking a probe control button */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

/**
 * Mounted React interaction probes for NumberField and CurrencyInput (rendered only on
 * /dev/controls?probe=fields for e2e/tests/gallery/text-fields.spec.ts, replacing the emulated
 * Vitest hook harness from 03-02 WR-03).
 */
export function FieldProbes() {
  return (
    <div className="space-y-6">
      <ProbeSameValueExternalReset />
      <ProbeUnfocusedBoundRelaxIgnore />
      <ProbeRoundedAck />
      <ProbeDeferredRounding />
      <ProbeAsyncInOrderAcks />
      <ProbeUntouchedAndEditedDecimals />
      <ProbeBoundRelaxAndDisabled />
      <ProbeTightenRoundedBound />
      <ProbeDisabledOutOfRange />
      <ProbeReadOnlyMoney />
      <ProbeExplicitCommitMoney />
      <ProbeExplicitCommitFocusedReset />
      <ProbeCurrencyRefs />
    </div>
  );
}

function ProbeSameValueExternalReset() {
  const [value, setValue] = useState<number | null>(5);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-r3-cr-01" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <NumberField
          label="Same-value external reset"
          value={value}
          onChange={setValue}
          min={1}
          max={60}
        />
      </AmountFields>
      <div className="flex gap-2 items-center">
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(7)}>
          Set external 7
        </Button>
        <output data-testid="saved">{String(value)}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeUnfocusedBoundRelaxIgnore() {
  const [value, setValue] = useState<number | null>(12);
  const [max, setMax] = useState(60);
  return (
    <section data-testid="probe-r3-cr-01-unfocused" className="bg-surface rounded-lg p-4 space-y-2">
      <NumberField
        label="Unfocused bound relax"
        value={value}
        onChange={() => {}}
        min={1}
        max={max}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMax(100)}>
          Set max 100
        </Button>
        <Button size="sm" onClick={() => setValue(20)}>
          Set external 20
        </Button>
      </div>
    </section>
  );
}

function ProbeRoundedAck() {
  const [bps, setBps] = useState(314);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-cr-02" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <NumberField
          label="Rounded basis points"
          value={bps / 100}
          onChange={(next) => {
            if (next !== null) setBps(Math.round(next * 100));
          }}
          min={-100}
          max={50}
          allowDecimal
          precision={2}
        />
      </AmountFields>
      <div className="flex gap-2 items-center">
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setBps(650)}>
          Reset 6.5
        </Button>
        <output data-testid="bps">{bps}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeDeferredRounding() {
  const [bps, setBps] = useState(314);
  const [deferredBps, setDeferredBps] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-r2-cr-02" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <NumberField
          label="Deferred rounding"
          value={bps / 100}
          onChange={(next) => {
            if (next !== null) setDeferredBps(Math.round(next * 100));
          }}
          min={-100}
          max={50}
          allowDecimal
          precision={2}
          resetKey={resetKey}
        />
      </AmountFields>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          size="sm"
          onMouseDown={keepFocus}
          onClick={() => {
            if (deferredBps !== null) setBps(deferredBps);
          }}
        >
          Flush deferred
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setBps(650)}>
          Set 6.5
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setResetKey((k) => k + 1)}>
          Bump resetKey
        </Button>
        <Button size="sm" onClick={() => setBps(700)}>
          Set 7
        </Button>
        <output data-testid="deferred">{String(deferredBps)}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeAsyncInOrderAcks() {
  const [value, setValue] = useState<number | null>(3);
  const [emitted, setEmitted] = useState<Array<number | null>>([]);
  return (
    <section data-testid="probe-r3-wr-01" className="bg-surface rounded-lg p-4 space-y-2">
      <NumberField
        label="In-order async acks"
        value={value}
        onChange={(next) => setEmitted((prev) => [...prev, next])}
        min={-100}
        max={50}
        allowDecimal
        precision={2}
      />
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(3.1)}>
          Deliver 3.1
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(3.14)}>
          Deliver 3.14
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(3.15)}>
          Deliver 3.15
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(6.5)}>
          Deliver 6.5
        </Button>
        <output data-testid="emitted">{JSON.stringify(emitted)}</output>
      </div>
    </section>
  );
}

function ProbeUntouchedAndEditedDecimals() {
  const [untouched, setUntouched] = useState<number | null>(3.14);
  const [edited, setEdited] = useState<number | null>(0);
  return (
    <section data-testid="probe-r4-cr-01" className="bg-surface rounded-lg p-4 space-y-3">
      <div data-testid="untouched" className="space-y-2">
        <NumberField
          label="Untouched decimal"
          value={untouched}
          onChange={() => {}}
          min={-100}
          max={50}
          allowDecimal
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setUntouched(3.1)}>
            Set 3.1
          </Button>
          <Button size="sm" onClick={() => setUntouched(3.05)}>
            Set 3.05
          </Button>
          <Button size="sm" onClick={() => setUntouched(3)}>
            Set 3
          </Button>
        </div>
      </div>
      <div data-testid="edited" className="space-y-2">
        <NumberField
          label="Edited decimal"
          value={edited}
          onChange={setEdited}
          min={-100}
          max={50}
          allowDecimal
          precision={2}
        />
        <div className="flex gap-2 items-center">
          <Button size="sm" onClick={() => setEdited(3.1)}>
            Reset edited 3.1
          </Button>
          <output data-testid="saved">{String(edited)}</output>
        </div>
      </div>
    </section>
  );
}

function ProbeBoundRelaxAndDisabled() {
  const [instance, setInstance] = useState(0);
  return <ProbeBoundRelaxCase key={instance} onReset={() => setInstance((n) => n + 1)} />;
}

function ProbeBoundRelaxCase({ onReset }: { onReset: () => void }) {
  const [value, setValue] = useState<number | null>(12);
  const [max, setMax] = useState(60);
  const [isDisabled, setIsDisabled] = useState(false);
  const [calls, setCalls] = useState(0);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-bound-disabled" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <NumberField
          label="Bound and disabled"
          value={value}
          onChange={(next) => {
            setCalls((c) => c + 1);
            setValue(next);
          }}
          min={1}
          max={max}
          isDisabled={isDisabled}
        />
      </AmountFields>
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" onClick={() => setIsDisabled((d) => !d)}>
          Toggle disabled
        </Button>
        <Button size="sm" onClick={() => setMax(100)}>
          Set max 100
        </Button>
        <Button size="sm" onClick={() => setMax(50)}>
          Set max 50
        </Button>
        <Button size="sm" onClick={onReset}>
          Reset probe
        </Button>
        <output data-testid="calls">{calls}</output>
        <output data-testid="saved">{String(value)}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeTightenRoundedBound() {
  const [bps, setBps] = useState(314);
  const [max, setMax] = useState(50);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-r2-cr-03" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <NumberField
          label="Tighten rounded bound"
          value={bps / 100}
          onChange={(next) => {
            if (next !== null) setBps(Math.round(next * 100));
          }}
          min={-100}
          max={max}
          allowDecimal
          precision={2}
        />
      </AmountFields>
      <div className="flex gap-2 items-center">
        <Button size="sm" onClick={() => setMax(3.147)}>
          Set max 3.147
        </Button>
        <Button size="sm" onClick={() => setMax(3.15)}>
          Set max 3.15
        </Button>
        <output data-testid="bps">{bps}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeDisabledOutOfRange() {
  const initialValidity = useAmountValidity();
  const tightenedValidity = useAmountValidity();
  const [max, setMax] = useState(50);
  return (
    <section data-testid="probe-r4-wr-01" className="bg-surface rounded-lg p-4 space-y-3">
      <div data-testid="initial" className="space-y-2">
        <AmountFields report={initialValidity.report}>
          <NumberField
            label="Disabled initial out of range"
            value={100}
            onChange={() => {}}
            min={1}
            max={60}
            isDisabled
          />
        </AmountFields>
        <output data-testid="valid">{String(initialValidity.allValid)}</output>
      </div>
      <div data-testid="tightened" className="space-y-2">
        <AmountFields report={tightenedValidity.report}>
          <NumberField
            label="Disabled tightened"
            value={3.15}
            onChange={() => {}}
            min={-100}
            max={max}
            allowDecimal
            isDisabled
          />
        </AmountFields>
        <div className="flex gap-2 items-center">
          <Button size="sm" onClick={() => setMax(3.147)}>
            Tighten to 3.147
          </Button>
          <output data-testid="valid">{String(tightenedValidity.allValid)}</output>
        </div>
      </div>
    </section>
  );
}

function ProbeReadOnlyMoney() {
  const [changes, setChanges] = useState(0);
  const [blurs, setBlurs] = useState(0);
  return (
    <section data-testid="probe-cr-04" className="bg-surface rounded-lg p-4 space-y-2">
      <CurrencyInput
        aria-label="Read-only balance"
        value={-1250}
        onChange={() => setChanges((c) => c + 1)}
        onBlur={() => setBlurs((b) => b + 1)}
        readOnly
      />
      <div className="flex gap-2">
        <output data-testid="changes">{changes}</output>
        <output data-testid="blurs">{blurs}</output>
      </div>
    </section>
  );
}

function ProbeExplicitCommitMoney() {
  const [mounted, setMounted] = useState(true);
  const [changes, setChanges] = useState(0);
  const [blurs, setBlurs] = useState(0);
  const [lastText, setLastText] = useState<string>('unset');
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-cr-01" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        {mounted && (
          <CurrencyInput
            aria-label="Explicit commit money"
            value={1200}
            onChange={() => setChanges((c) => c + 1)}
            onTextChange={(cents) => setLastText(String(cents))}
            onBlur={() => setBlurs((b) => b + 1)}
            expression
            commitOnBlur={false}
          />
        )}
      </AmountFields>
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" onClick={() => setMounted((m) => !m)}>
          Toggle mount
        </Button>
        <output data-testid="changes">{changes}</output>
        <output data-testid="blurs">{blurs}</output>
        <output data-testid="text">{lastText}</output>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeExplicitCommitFocusedReset() {
  const [value, setValue] = useState(1200);
  const { allValid, report } = useAmountValidity();
  return (
    <section data-testid="probe-r2-cr-01" className="bg-surface rounded-lg p-4 space-y-2">
      <AmountFields report={report}>
        <CurrencyInput
          aria-label="Explicit commit reset"
          value={value}
          onChange={() => {}}
          expression
          commitOnBlur={false}
        />
      </AmountFields>
      <div className="flex gap-2 items-center">
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(2000)}>
          Set 2000
        </Button>
        <Button size="sm" onMouseDown={keepFocus} onClick={() => setValue(3500)}>
          Set 3500
        </Button>
        <output data-testid="valid">{String(allValid)}</output>
      </div>
    </section>
  );
}

function ProbeCurrencyRefs() {
  const [mounted, setMounted] = useState(true);
  const [snapshot, setSnapshot] = useState('');
  const objRef = useRef<HTMLInputElement>(null);
  const logRef = useRef({
    cleanupMounts: 0,
    cleanupNulls: 0,
    cleanupsRun: 0,
    classicMounts: 0,
    classicNulls: 0,
  });

  const cleanupRef = useCallback((node: HTMLInputElement | null) => {
    if (node) logRef.current.cleanupMounts += 1;
    else logRef.current.cleanupNulls += 1;
    return () => {
      logRef.current.cleanupsRun += 1;
    };
  }, []);

  const classicRef = useCallback((node: HTMLInputElement | null) => {
    if (node) logRef.current.classicMounts += 1;
    else logRef.current.classicNulls += 1;
  }, []);

  const read = () =>
    setSnapshot(
      JSON.stringify({
        ...logRef.current,
        objTag: objRef.current ? objRef.current.tagName : null,
      }),
    );

  return (
    <section data-testid="probe-wr-02" className="bg-surface rounded-lg p-4 space-y-2">
      {mounted && (
        <div className="space-y-2">
          <CurrencyInput ref={cleanupRef} aria-label="Ref cleanup" value={0} onChange={() => {}} />
          <CurrencyInput ref={classicRef} aria-label="Ref classic" value={0} onChange={() => {}} />
          <CurrencyInput ref={objRef} aria-label="Ref object" value={0} onChange={() => {}} />
        </div>
      )}
      <div className="flex gap-2 items-center">
        <Button size="sm" onClick={() => setMounted((m) => !m)}>
          Toggle refs
        </Button>
        <Button size="sm" onClick={read}>
          Read refs
        </Button>
        <output data-testid="refs">{snapshot}</output>
      </div>
    </section>
  );
}

/** The text foundation of the shared set: Label, Field, Input, Textarea, NumberField and CurrencyInput */
export function TextFieldCards() {
  return (
    <>
      <LabelCard />
      <FieldCard />
      <InputCard />
      <TextareaCard />
      <NumberFieldCard />
      <MoneyCard />
    </>
  );
}
