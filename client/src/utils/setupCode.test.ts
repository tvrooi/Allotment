import { describe, expect, it } from 'vitest';
import { codeFromPaste } from './setupCode';

describe('codeFromPaste', () => {
  it('keeps a code typed or pasted on its own', () => {
    expect(codeFromPaste('5AWD-HGGY-HL4B-BJEX')).toBe('5AWD-HGGY-HL4B-BJEX');
    expect(codeFromPaste('  5awd-hggy-hl4b-bjex ')).toBe('5AWD-HGGY-HL4B-BJEX');
  });

  it('finds the code in a whole log line or block', () => {
    const log =
      'Allotment needs a password. Open it in your browser and enter this setup code:\n\n    5AWD-HGGY-HL4B-BJEX\n\nCreated 68 default categories';
    expect(codeFromPaste(log)).toBe('5AWD-HGGY-HL4B-BJEX');
    expect(codeFromPaste('[12:00:01] setup code: 5AWDHGGYHL4BBJEX')).toBe('5AWD-HGGY-HL4B-BJEX');
  });

  it('finds a code made only of letters when it is written in its groups', () => {
    expect(codeFromPaste('enter this setup code:\n    ABCD-EFGH-JKLM-NPQR\n')).toBe(
      'ABCD-EFGH-JKLM-NPQR',
    );
  });

  it('ignores plain words that happen to be sixteen letters long', () => {
    expect(codeFromPaste('characteristical')).toBe('characteristical');
  });

  it('finds a six-digit reset code only where one is allowed', () => {
    expect(codeFromPaste('Your reset code is 123456', { allowShort: true })).toBe('123456');
    expect(codeFromPaste('Your reset code is 123456')).toBe('Your reset code is 123456');
  });

  it('leaves text without a code as it was typed, so typing a code works', () => {
    expect(codeFromPaste('5AWD-HG')).toBe('5AWD-HG');
  });
});
