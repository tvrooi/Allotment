/** A setup or invitation code: four groups of four letters and digits */
const LONG_CODE = /\b([A-Z0-9]{4})[- ]?([A-Z0-9]{4})[- ]?([A-Z0-9]{4})[- ]?([A-Z0-9]{4})\b/i;
/** A short reset code: six digits */
const SHORT_CODE = /\b(\d{6})\b/;

/**
 * The code in whatever was pasted: just the code, or a whole line (or several) copied from the
 * server's log, like "Allotment needs a password. ... enter this setup code: 5AWD-HGGY-HL4B-BJEX".
 * Returns it in the usual XXXX-XXXX-XXXX-XXXX form, or the text unchanged when it holds no code.
 */
export function codeFromPaste(text: string, { allowShort = false } = {}): string {
  const long = text.match(LONG_CODE);
  if (long && /\d/.test(long[0]) && /[A-Z]/i.test(long[0]))
    return long.slice(1, 5).join('-').toUpperCase();
  if (allowShort) {
    const short = text.match(SHORT_CODE);
    if (short) return short[1];
  }
  return text.trim();
}
