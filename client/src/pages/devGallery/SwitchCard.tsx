import { useState } from 'react';
import { Switch } from '../../components/ui/Switch';
import { GalleryCard, Specimen } from './Specimen';

/**
 * The shared Switch in its five states (02-UI-SPEC.md). Focus is the specimen the keyboard
 * tests Tab onto, and the one without a visible label; Disabled and Read-only show off and on.
 * Invalid is required, so it shows the default "Turn on … to continue" line; Error label names
 * a label that is not plain text through errorLabel, keeping Up's capital.
 */
export function SwitchCard() {
  const [weekly, setWeekly] = useState(true);
  const [focus, setFocus] = useState(false);
  const [terms, setTerms] = useState(false);
  const [hourly, setHourly] = useState(false);
  const [up, setUp] = useState(false);
  return (
    <GalleryCard title="Switch">
      <Specimen control="Switch" state="Default">
        <Switch checked={weekly} onCheckedChange={setWeekly}>
          Weekly summary
        </Switch>
      </Specimen>
      <Specimen control="Switch" state="Focus">
        <Switch checked={focus} onCheckedChange={setFocus} aria-label="Round up purchases" />
      </Specimen>
      <Specimen control="Switch" state="Disabled">
        <div className="flex flex-wrap gap-x-6">
          <Switch checked={false} onCheckedChange={() => {}} disabled>
            Bank sync, off
          </Switch>
          <Switch checked onCheckedChange={() => {}} disabled>
            Bank sync, on
          </Switch>
        </div>
      </Specimen>
      <Specimen control="Switch" state="Invalid">
        <Switch checked={terms} onCheckedChange={setTerms} isRequired isInvalid={!terms}>
          Household rules
        </Switch>
      </Specimen>
      <Specimen control="Switch" state="Read-only">
        <div className="flex flex-wrap gap-x-6">
          <Switch checked={false} onCheckedChange={() => {}} readOnly>
            Shared budget, off
          </Switch>
          <Switch checked onCheckedChange={() => {}} readOnly>
            Shared budget, on
          </Switch>
        </div>
      </Specimen>
      <Specimen control="Switch" state="Help text">
        <Switch
          checked={hourly}
          onCheckedChange={setHourly}
          description="Transactions arrive within the hour"
        >
          Hourly sync
        </Switch>
      </Specimen>
      <Specimen control="Switch" state="Error label">
        <Switch
          checked={up}
          onCheckedChange={setUp}
          isRequired
          isInvalid={!up}
          errorLabel="Up sync"
        >
          <span>
            Sync with <span className="font-medium">Up</span>
          </span>
        </Switch>
      </Specimen>
    </GalleryCard>
  );
}
