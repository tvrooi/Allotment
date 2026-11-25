import { describe, expect, it } from 'vitest';
import { detectMonthInput, supportsMonthInput } from './nativeInput';

/** A document whose inputs know only `types`, as a browser keeps "text" for one it does not */
const browser = (types: string[]) => ({
  createElement: () => {
    let type = 'text';
    return {
      get type() {
        return type;
      },
      set type(value: string) {
        type = types.includes(value) ? value : 'text';
      },
    };
  },
});

describe('detectMonthInput', () => {
  it('is true where the browser keeps type month', () => {
    expect(detectMonthInput(browser(['text', 'date', 'month']))).toBe(true);
  });

  it('is false where the input falls back to text (Firefox)', () => {
    expect(detectMonthInput(browser(['text', 'date']))).toBe(false);
  });
});

describe('supportsMonthInput', () => {
  it('renders the native input where there is no document (server rendering)', () => {
    expect(typeof document).toBe('undefined');
    expect(supportsMonthInput()).toBe(true);
  });
});
