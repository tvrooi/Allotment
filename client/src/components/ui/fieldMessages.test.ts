import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePreferencesStore } from '../../store/preferencesStore';
import {
  dateRangeMessage,
  fieldSubject,
  incompleteDateMessage,
  errorLine,
  monthRangeMessage,
  namesOf,
  present,
  requiredMessage,
} from './fieldMessages';

// The bounds are formatted in the Date Format preference, so the tests pin it rather than
// depending on the machine's locale
beforeEach(() => usePreferencesStore.setState({ dateFormat: 'd MMM yyyy' }));

describe('requiredMessage', () => {
  it('words each kind of control as the contract does', () => {
    expect(requiredMessage('text', 'Name')).toBe('Enter Name to continue');
    expect(requiredMessage('choice', 'Account type')).toBe('Select Account type to continue');
    expect(requiredMessage('toggle', 'Up sync')).toBe('Turn on Up sync to continue');
  });

  it('keeps the casing of proper nouns and acronyms in the subject', () => {
    expect(requiredMessage('text', 'ABN')).toBe('Enter ABN to continue');
    expect(requiredMessage('text', 'PAYG withheld')).toBe('Enter PAYG withheld to continue');
    expect(requiredMessage('toggle', 'Up sync')).toContain('Up sync');
  });
});

describe('incompleteDateMessage', () => {
  it('shows the example it is given', () => {
    expect(incompleteDateMessage('16/11/2026')).toBe('Enter the full date, like 16/11/2026');
  });
});

describe('dateRangeMessage', () => {
  it('names both bounds, or the one there is, through formatDay', () => {
    expect(dateRangeMessage('2026-01-05', '2026-12-31')).toBe(
      'Enter a date between 5 Jan 2026 and 31 Dec 2026',
    );
    expect(dateRangeMessage('2026-01-05', undefined)).toBe('Enter a date on or after 5 Jan 2026');
    expect(dateRangeMessage(undefined, '2026-12-31')).toBe('Enter a date on or before 31 Dec 2026');
  });

  it('follows the Date Format preference', () => {
    usePreferencesStore.setState({ dateFormat: 'dd/MM/yyyy' });
    expect(dateRangeMessage('2026-01-05', undefined)).toBe('Enter a date on or after 05/01/2026');
  });
});

describe('monthRangeMessage', () => {
  it('names both bounds, or the one there is, through formatMonth', () => {
    expect(monthRangeMessage('2026-01', '2026-10')).toBe(
      'Choose a month between Jan 2026 and Oct 2026',
    );
    expect(monthRangeMessage('2026-01', undefined)).toBe('Choose a month on or after Jan 2026');
    expect(monthRangeMessage(undefined, '2026-10')).toBe('Choose a month on or before Oct 2026');
  });
});

// Every shared control picks its error line here (02-REVIEW WR-05)
describe('errorLine', () => {
  const names = { label: 'Account type' };

  it("the caller's message wins over the control's own line and the required line", () => {
    expect(errorLine('Pick one', { isRequired: true, kind: 'choice', names, own: 'Range' })).toBe(
      'Pick one',
    );
  });

  it("then the control's own line, then the required line", () => {
    expect(errorLine(undefined, { isRequired: true, kind: 'choice', names, own: 'Range' })).toBe(
      'Range',
    );
    expect(errorLine(undefined, { isRequired: true, kind: 'choice', names })).toBe(
      'Select Account type to continue',
    );
    expect(errorLine(undefined, { isRequired: true, kind: 'text', names })).toBe(
      'Enter Account type to continue',
    );
  });

  it('an empty message counts as none, for every control alike', () => {
    for (const empty of ['', false, null, undefined]) {
      expect(errorLine(empty, { isRequired: true, kind: 'choice', names })).toBe(
        'Select Account type to continue',
      );
      expect(present(errorLine(empty, { isRequired: false, kind: 'choice', names }))).toBe(false);
    }
  });
});

// Select, Combobox and RadioGroup map their props through this one helper (02-REVIEW WR-04)
describe('namesOf', () => {
  it('a visible label is the subject, and errorLabel wins over it', () => {
    expect(fieldSubject(namesOf({ label: 'Account type' }))).toBe('Account type');
    expect(fieldSubject(namesOf({ label: 'Account type', errorLabel: 'an account type' }))).toBe(
      'an account type',
    );
  });

  it('without a label the aria-label is the subject, not the label', () => {
    expect(namesOf({ 'aria-label': 'Payee' })).toEqual({
      errorLabel: undefined,
      ariaLabel: 'Payee',
    });
    expect(fieldSubject(namesOf({ 'aria-label': 'Payee', errorLabel: 'a payee' }))).toBe('a payee');
  });
});

describe('fieldSubject', () => {
  const node = createElement('strong', null, 'Up sync');

  it('uses errorLabel first, keeping its capitals', () => {
    expect(fieldSubject({ errorLabel: 'target date', label: 'Target date' })).toBe('target date');
    expect(fieldSubject({ errorLabel: 'ABN', label: 'Business number' })).toBe('ABN');
  });

  it('uses a visible string label next', () => {
    expect(fieldSubject({ label: 'Account type' })).toBe('Account type');
    expect(fieldSubject({ label: 'Account type', ariaLabel: 'Type' })).toBe('Account type');
  });

  it('uses the aria-label when there is no visible label', () => {
    expect(fieldSubject({ ariaLabel: 'Frequency' })).toBe('Frequency');
  });

  it('passes over a label that is a React node and uses the aria-label', () => {
    expect(fieldSubject({ label: node, ariaLabel: 'Up sync' })).toBe('Up sync');
  });

  it('passes over an empty string to the next name', () => {
    expect(fieldSubject({ errorLabel: '', label: 'Payee' })).toBe('Payee');
    expect(fieldSubject({ label: '', ariaLabel: 'Payee' })).toBe('Payee');
  });

  it('builds a default message and a Clear name that never say "undefined"', () => {
    expect(requiredMessage('choice', fieldSubject({ ariaLabel: 'Frequency' }))).toBe(
      'Select Frequency to continue',
    );
    expect('Clear ' + fieldSubject({ ariaLabel: 'Payee' })).toBe('Clear Payee');
    const cases = [
      fieldSubject({ errorLabel: 'target date', label: 'Target date' }),
      fieldSubject({ label: 'Account type' }),
      fieldSubject({ ariaLabel: 'Frequency' }),
      fieldSubject({ label: node, ariaLabel: 'Up sync' }),
    ];
    for (const subject of cases) {
      expect(subject).not.toBe('');
      for (const kind of ['text', 'choice', 'toggle'] as const)
        expect(requiredMessage(kind, subject)).not.toContain('undefined');
      expect('Clear ' + subject).not.toContain('undefined');
    }
  });
});

// Type checks, run by the client build (tsc -b), not by Vitest: a call that could leave the
// subject undefined does not compile
// @ts-expect-error no name at all
export const nameless = () => fieldSubject({});
// @ts-expect-error a React node label alone gives no string to use
export const nodeOnly = () => fieldSubject({ label: createElement('span') });
