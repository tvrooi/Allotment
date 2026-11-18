import { useId, useState } from 'react';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Field } from '../../components/ui/Field';
import { errorClass } from '../../components/ui/fieldClasses';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
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

/** Textarea in each state, bare and inside a Field, plus a long note that scrolls inside it */
function TextareaCard() {
  const def = useText();
  const focus = useText();
  const invalid = useText('x');
  const long = useText(LONG_NOTE);
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
    </GalleryCard>
  );
}

/**
 * CurrencyInput is the only amount field and is not rebuilt on Input; it is here so its
 * placeholder's contrast is checked alongside the set's.
 */
function MoneyCard() {
  const [empty, setEmpty] = useState(0);
  const [filled, setFilled] = useState(12345);
  return (
    <GalleryCard title="Money entry (not part of the set)">
      <Specimen control="CurrencyInput" state="Empty">
        <CurrencyInput aria-label="Amount" value={empty} onChange={setEmpty} />
      </Specimen>
      <Specimen control="CurrencyInput" state="Filled">
        <CurrencyInput aria-label="Opening balance" value={filled} onChange={setFilled} />
      </Specimen>
    </GalleryCard>
  );
}

/** The text foundation of the shared set: Label, Field, Input and Textarea (02-UI-SPEC.md items 1 to 4) */
export function TextFieldCards() {
  return (
    <>
      <LabelCard />
      <FieldCard />
      <InputCard />
      <TextareaCard />
      <MoneyCard />
    </>
  );
}
