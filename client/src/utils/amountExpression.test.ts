import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { assignmentToInput, readAmountExpression } from './amountExpression';
import type { AmountStyle } from './currency';

const dollars: AmountStyle = { format: 'dot', position: 'before', symbol: '$' };
const euros: AmountStyle = { format: 'comma', position: 'after', symbol: '€' };
const sol: AmountStyle = { format: 'dot', position: 'before', symbol: 'S/', space: true };
const yen: AmountStyle = { format: 'dot', position: 'before', symbol: '¥', minor: 0 };
const read = (s: string, style = dollars) => readAmountExpression(s, style);

describe('readAmountExpression (BUD-05)', () => {
  it('works out sums, in cents', () => {
    expect(read('100+50')).toBe(15000);
    expect(read('150*2')).toBe(30000);
    expect(read('150×2')).toBe(30000);
    expect(read('300/2')).toBe(15000);
    expect(read('300÷2')).toBe(15000);
    expect(read('100 - 150')).toBe(-5000);
    expect(read('(100+50)*2')).toBe(30000);
    expect(read('100+50*2')).toBe(20000);
    expect(read('$100 + $50')).toBe(15000);
    expect(read('1,234.50+0.50')).toBe(123500);
    expect(read('-(20+30)')).toBe(-5000);
  });

  it('is exact where floats are not', () => {
    expect(read('0.1+0.2')).toBe(30);
    expect(read('10/3')).toBe(333);
    expect(read('20/3')).toBe(667);
    expect(read('-20/3')).toBe(-667);
    expect(read('1.15*3')).toBe(345);
  });

  it('never makes an amount relative to what the field held', () => {
    expect(read('+50')).toBe(5000);
    expect(read('*2')).toBeNull();
    expect(read('/2')).toBeNull();
  });

  it('reads a plain amount exactly as before', () => {
    expect(read('')).toBe(0);
    expect(read('50')).toBe(5000);
    expect(read('-50')).toBe(-5000);
    expect(read('(50)')).toBe(-5000);
    expect(read('$1,234.50')).toBe(123450);
  });

  it('refuses what is not a sum', () => {
    for (const bad of ['100+', '100++', '2*(3', '2*3)', '10/0', '10/(5-5)', '1+abc', '()'])
      expect(read(bad), bad).toBeNull();
  });

  it('refuses a result beyond what the server accepts', () => {
    expect(read('99999999999*99999999999')).toBeNull();
  });

  it('follows the budget’s separators and symbol', () => {
    expect(read('12,50+1', euros)).toBe(1350);
    expect(read('1.234,56+0,44', euros)).toBe(123500);
    expect(read('10 €*2', euros)).toBe(2000);
    // The symbol's slash isn't a divide
    expect(read('S/ 12.50', sol)).toBe(1250);
    expect(read('S/ 10*2', sol)).toBe(2000);
    expect(read('1000/3', yen)).toBe(333);
  });

  it('adds and multiplies like integer cents', () => {
    const cents = fc.integer({ min: -1e9, max: 1e9 });
    fc.assert(
      fc.property(cents, cents, fc.integer({ min: 1, max: 99 }), (a, b, k) => {
        const text = (c: number) => (c < 0 ? `(0-${(-c / 100).toFixed(2)})` : (c / 100).toFixed(2));
        expect(read(`${text(a)}+${text(b)}`)).toBe(a + b);
        expect(read(`${text(a)}*${k}`)).toBe(a * k);
      }),
    );
  });
});

describe('assignmentToInput', () => {
  it('keeps the sign, so an unchanged negative assignment saves as it was', () => {
    expect(assignmentToInput(-5000, dollars)).toBe('-50');
    expect(assignmentToInput(-5050, dollars)).toBe('-50.50');
    expect(assignmentToInput(230000, dollars)).toBe('2300');
    expect(read(assignmentToInput(230000, dollars))).toBe(230000);
    expect(assignmentToInput(123400, euros)).toBe('1234');
    expect(read(assignmentToInput(123400, euros), euros)).toBe(123400);
    expect(read(assignmentToInput(-5000, dollars))).toBe(-5000);
    expect(assignmentToInput(123450, euros)).toBe('1234,50');
    expect(assignmentToInput(0, dollars)).toBe('');
  });
});
