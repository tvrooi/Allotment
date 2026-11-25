import { useState } from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import { Radio, RadioGroup } from '../../components/ui/RadioGroup';
import { GalleryCard, Specimen } from './Specimen';

/**
 * The shared Checkbox in its five states (02-UI-SPEC.md), plus the cases its tests measure: no
 * visible label (still a 44 px target on phones), a label that wraps, indeterminate, and help
 * text. Invalid is required, so it shows the default "Turn on … to continue" line.
 */
export function CheckboxCard() {
  const [pending, setPending] = useState(true);
  const [focus, setFocus] = useState(false);
  const [terms, setTerms] = useState(false);
  const [row, setRow] = useState(false);
  const [long, setLong] = useState(false);
  const [all, setAll] = useState(false);
  const [help, setHelp] = useState(false);
  return (
    <GalleryCard title="Checkbox">
      <Specimen control="Checkbox" state="Default">
        <Checkbox checked={pending} onCheckedChange={setPending}>
          Include pending transactions
        </Checkbox>
      </Specimen>
      <Specimen control="Checkbox" state="Focus">
        <Checkbox checked={focus} onCheckedChange={setFocus}>
          Hide reconciled
        </Checkbox>
      </Specimen>
      <Specimen control="Checkbox" state="Disabled">
        <div className="flex flex-wrap gap-x-6">
          <Checkbox checked={false} onCheckedChange={() => {}} disabled>
            Bank sync, off
          </Checkbox>
          <Checkbox checked onCheckedChange={() => {}} disabled>
            Bank sync, on
          </Checkbox>
        </div>
      </Specimen>
      <Specimen control="Checkbox" state="Invalid">
        <Checkbox checked={terms} onCheckedChange={setTerms} isInvalid={!terms} isRequired>
          Household rules
        </Checkbox>
      </Specimen>
      <Specimen control="Checkbox" state="Read-only">
        <div className="flex flex-wrap gap-x-6">
          <Checkbox checked={false} onCheckedChange={() => {}} readOnly>
            Shared budget, off
          </Checkbox>
          <Checkbox checked onCheckedChange={() => {}} readOnly>
            Shared budget, on
          </Checkbox>
        </div>
      </Specimen>
      <Specimen control="Checkbox" state="No label">
        <Checkbox checked={row} onCheckedChange={setRow} aria-label="Select Corner Grocery" />
      </Specimen>
      <Specimen control="Checkbox" state="Long label">
        <div className="max-w-60">
          <Checkbox checked={long} onCheckedChange={setLong}>
            Count transfers between my own accounts as spending when they leave a budget account
          </Checkbox>
        </div>
      </Specimen>
      <Specimen control="Checkbox" state="Indeterminate">
        <Checkbox checked={all} isIndeterminate={!all} onCheckedChange={(on) => setAll(on)}>
          All accounts
        </Checkbox>
      </Specimen>
      <Specimen control="Checkbox" state="Help text">
        <Checkbox
          checked={help}
          onCheckedChange={setHelp}
          description="Rows you have reconciled stay as they are"
        >
          Apply to past transactions
        </Checkbox>
      </Specimen>
    </GalleryCard>
  );
}

const REPEATS = ['Weekly', 'Monthly', 'Yearly'];
const radios = () =>
  REPEATS.map((name) => (
    <Radio key={name} value={name.toLowerCase()}>
      {name}
    </Radio>
  ));

/**
 * The shared RadioGroup in its five states and laid out horizontally. Focus starts with nothing
 * chosen, so the keyboard tests Tab onto its first option; Invalid is required, so it shows the
 * default "Select … to continue" line.
 */
export function RadioGroupCard() {
  const [repeat, setRepeat] = useState('monthly');
  const [focus, setFocus] = useState('');
  const [invalid, setInvalid] = useState('');
  const [side, setSide] = useState('weekly');
  return (
    <GalleryCard title="RadioGroup">
      <Specimen control="RadioGroup" state="Default">
        <RadioGroup label="Repeat" value={repeat} onChange={setRepeat}>
          {radios()}
        </RadioGroup>
      </Specimen>
      <Specimen control="RadioGroup" state="Focus">
        <RadioGroup aria-label="Reminder" value={focus} onChange={setFocus}>
          {radios()}
        </RadioGroup>
      </Specimen>
      <Specimen control="RadioGroup" state="Disabled">
        <RadioGroup label="Sync schedule" value="weekly" onChange={() => {}} isDisabled>
          {radios()}
        </RadioGroup>
      </Specimen>
      <Specimen control="RadioGroup" state="Invalid">
        <RadioGroup
          label="Frequency"
          value={invalid}
          onChange={setInvalid}
          isRequired
          isInvalid={invalid === ''}
          description="How often the bill comes in"
        >
          {radios()}
        </RadioGroup>
      </Specimen>
      <Specimen control="RadioGroup" state="Read-only">
        <RadioGroup label="Shared budget" value="weekly" onChange={() => {}} isReadOnly>
          {radios()}
        </RadioGroup>
      </Specimen>
      <Specimen control="RadioGroup" state="Horizontal">
        <RadioGroup label="Statement" value={side} onChange={setSide} orientation="horizontal">
          {radios()}
        </RadioGroup>
      </Specimen>
    </GalleryCard>
  );
}
