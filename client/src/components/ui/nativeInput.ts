// Whether this browser draws its own picker for <input type="month"> (02-REVIEW WR-02). Firefox,
// on desktop and Android, does not: the input stays a plain text box with no hint of the format,
// so a phone there gets the month grid instead. A browser that does not know an input type keeps
// "text" when the type is set, which is the check.

/** Whether an input made by `doc` keeps type "month" once it is set */
export function detectMonthInput(doc: { createElement(tag: 'input'): { type: string } }): boolean {
  const input = doc.createElement('input');
  input.type = 'month';
  return input.type === 'month';
}

let supported: boolean | undefined;

/**
 * Whether the phone branches can use the native month input, checked once per page. Server
 * rendering (the unit tests) has no document and renders the native input, as a phone usually
 * gets.
 */
export function supportsMonthInput(): boolean {
  if (typeof document === 'undefined') return true;
  supported ??= detectMonthInput(document);
  return supported;
}
