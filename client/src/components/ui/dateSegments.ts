// The typed date segments' order, from the Date format preference (02-UI-SPEC.md, per-control
// item 10; 02-RESEARCH.md Pitfall 5). Pure: no store, no browser language, so the order is the
// same on every device for the same preference.
import type { DateFormatOption } from '../../store/preferencesStore';

/**
 * A language whose numeric dates put day, month and year in the preference's order. The default
 * 'd MMM yyyy' is day first, so it maps to en-AU, never to en-US's month-first order. Every one is
 * English: React Aria takes the calendar heading, weekday names and screen-reader labels from this
 * locale too, so dd.MM.yyyy is en-CH (day first, dotted), not de-DE, which made them German.
 */
const LOCALES: Record<DateFormatOption, string> = {
  'd MMM yyyy': 'en-AU',
  'dd/MM/yyyy': 'en-AU',
  'dd.MM.yyyy': 'en-CH',
  'MM/dd/yyyy': 'en-US',
  'yyyy-MM-dd': 'en-CA',
};

/** 16 November 2026 as each segment locale types it: the example in the incomplete-date line */
const EXAMPLES: Record<string, string> = {
  'en-AU': '16/11/2026',
  'en-CH': '16.11.2026',
  'en-US': '11/16/2026',
  'en-CA': '2026-11-16',
};

/** The locale the DatePicker's segments use for a Date format preference */
export function segmentLocale(format: DateFormatOption): string {
  return LOCALES[format];
}

/** An example date written in the segments' order, for "Enter the full date, like …" */
export function dateExample(format: DateFormatOption): string {
  return EXAMPLES[segmentLocale(format)];
}
