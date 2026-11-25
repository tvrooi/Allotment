import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { PAGE_GUTTER } from '../components/ui/pageGutter';
import { ComboboxCard } from './devGallery/ComboboxCard';
import { DialogCard } from './devGallery/DialogCard';
import { DatePickerCard, MonthPickerCard, MonthRangePickerCard } from './devGallery/DateCards';
import { PickerCards } from './devGallery/PickerCards';
import { FormProbes, SelectCard } from './devGallery/SelectCard';
import { SwitchCard } from './devGallery/SwitchCard';
import { FieldProbes, TextFieldCards } from './devGallery/TextFieldCards';
import { CheckboxCard, RadioGroupCard } from './devGallery/ToggleCards';

/**
 * The development-only controls gallery (/dev/controls): every shared form control in each of
 * its states, for building them and for the gallery's browser tests (e2e/tests/gallery/).
 * Only the dev server and `vite build --mode gallery` have it; every other build gets
 * DevControlsGallery.stub.ts (withoutDevGallery() in vite.config.ts). It fetches nothing and
 * reads no budget: each card shows its controls on fixed sample values.
 */
export default function DevControlsGallery() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  // Toggle dark locally on <html> and restore on unmount so the gallery never writes the app's
  // saved theme preference (02-REVIEW IN-04)
  useEffect(() => {
    const initial = document.documentElement.classList.contains('dark');
    return () => {
      document.documentElement.classList.toggle('dark', initial);
    };
  }, []);
  const switchTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  };
  const probe = new URLSearchParams(window.location.search).get('probe');
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-page text-text">
        <PageHeader
          title="Controls gallery"
          actions={
            <Button variant="secondary" onClick={switchTheme}>
              {dark ? 'Switch to light theme' : 'Switch to dark theme'}
            </Button>
          }
        />
        <main className={`${PAGE_GUTTER} pt-6 pb-16 space-y-8`}>
          {probe === 'forms' ? (
            <FormProbes />
          ) : probe === 'fields' ? (
            <FieldProbes />
          ) : (
            <>
              <TextFieldCards />
              <SelectCard />
              <ComboboxCard />
              <PickerCards />
              <DatePickerCard />
              <MonthPickerCard />
              <MonthRangePickerCard />
              <CheckboxCard />
              <RadioGroupCard />
              <SwitchCard />
              <DialogCard />
            </>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}
