import { amountStyle, amountToInput, readTypedAmount, type AmountStyle } from './currency';

/**
 * An amount typed into a budget field, which may be a sum (BUD-05): `100+50` is 150 and
 * `150*2` is 300. Returns minor units, or null when the text isn't an amount or a sum.
 *
 * - Text without an operator between two numbers is read exactly as any amount field reads it
 *   (`readTypedAmount`), so `-50`, `(50)`, `$1,234.50` and `12,50` mean what they always have.
 * - A sum is `+ - * /` (also `×` and `÷`) and brackets, with the usual order. Each number in it is
 *   read like an amount, in the budget's currency and separators.
 * - It is never relative to what the field held: `+50` is 50, like typing 50. A sum that starts
 *   with `*` or `/` (`*2`) is refused rather than guessed, so nothing is saved by surprise.
 * - Worked in exact fractions (BigInt), never floats, and rounded to the currency's minor unit
 *   once at the end, half away from zero. Dividing by zero, or a result beyond what the server
 *   accepts, is unreadable.
 *
 * No `eval`: a small recursive-descent reader of the characters above.
 */
export function readAmountExpression(
  text: string,
  style: AmountStyle = amountStyle(),
): number | null {
  // The symbol goes first: some have a slash in them (S/)
  const bare = style.symbol ? text.split(style.symbol).join(' ') : text;
  const plain = bare.replace(/×/g, '*').replace(/÷/g, '/');
  if (!isExpression(plain)) return readTypedAmount(text, style);
  const scale = 10n ** BigInt(style.minor ?? 2);
  const tokens = tokenize(plain);
  if (!tokens) return null;
  const reader = new Reader(tokens, style, scale);
  const value = reader.expression();
  if (!value || !reader.done()) return null;
  const cents = roundToInteger(reduce(value.n * scale, value.d));
  if (cents === null) return null;
  return Math.abs(cents) > MAX_AMOUNT ? null : cents;
}

/** The server's bound on an assignment (routes/budget.ts `cents`) */
const MAX_AMOUNT = 1e13;

/** A multiply or divide anywhere, or a plus or minus between two numbers (`50-` and `-50` are
 * amounts, as they always were) */
function isExpression(text: string) {
  return /[*/]/.test(text) || /[\d)]\s*[+-]\s*[\d(.,]/.test(text);
}

type Token = { kind: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')' } | { kind: 'num'; text: string };

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let number = '';
  const flush = () => {
    if (number.trim()) tokens.push({ kind: 'num', text: number.trim() });
    number = '';
  };
  for (const ch of text) {
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      flush();
      tokens.push({ kind: 'op', op: ch });
    } else number += ch;
  }
  flush();
  return tokens.length ? tokens : null;
}

/** A fraction n/d with d > 0 */
type Fraction = { n: bigint; d: bigint };

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
};
const reduce = (n: bigint, d: bigint): Fraction => {
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d < 0n ? -d : d);
  return { n: (sign * n) / g, d: (sign * d) / g };
};

function roundToInteger({ n, d }: Fraction): number | null {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / d;
  const rounded = (abs % d) * 2n >= d ? whole + 1n : whole;
  const value = Number(negative ? -rounded : rounded);
  return Number.isSafeInteger(value) ? value : null;
}

class Reader {
  private at = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly style: AmountStyle,
    /** Minor units in one unit of the currency: 100 for cents */
    private readonly scale: bigint,
  ) {}
  done() {
    return this.at === this.tokens.length;
  }
  private peekOp() {
    const t = this.tokens[this.at];
    return t?.kind === 'op' ? t.op : null;
  }
  // expression := term (('+' | '-') term)*
  expression(): Fraction | null {
    let left = this.term();
    while (left && (this.peekOp() === '+' || this.peekOp() === '-')) {
      const op = this.peekOp();
      this.at++;
      const right = this.term();
      if (!right) return null;
      left =
        op === '+'
          ? reduce(left.n * right.d + right.n * left.d, left.d * right.d)
          : reduce(left.n * right.d - right.n * left.d, left.d * right.d);
    }
    return left;
  }
  // term := factor (('*' | '/') factor)*
  private term(): Fraction | null {
    let left = this.factor();
    while (left && (this.peekOp() === '*' || this.peekOp() === '/')) {
      const op = this.peekOp();
      this.at++;
      const right = this.factor();
      if (!right) return null;
      if (op === '/' && right.n === 0n) return null;
      left =
        op === '*'
          ? reduce(left.n * right.n, left.d * right.d)
          : reduce(left.n * right.d, left.d * right.n);
    }
    return left;
  }
  // factor := ('+' | '-') factor | '(' expression ')' | number
  private factor(): Fraction | null {
    const t = this.tokens[this.at];
    if (!t) return null;
    if (t.kind === 'op') {
      if (t.op === '+' || t.op === '-') {
        this.at++;
        const inner = this.factor();
        return inner && (t.op === '-' ? { n: -inner.n, d: inner.d } : inner);
      }
      if (t.op === '(') {
        this.at++;
        const inner = this.expression();
        if (!inner || this.peekOp() !== ')') return null;
        this.at++;
        return inner;
      }
      return null;
    }
    this.at++;
    const minorUnits = readTypedAmount(t.text, this.style);
    // An empty piece reads as 0 in an amount field; inside a sum it's a mistake
    if (minorUnits === null || !/\d/.test(t.text)) return null;
    // A whole number of units, as a fraction: 250 cents is 250/100
    return reduce(BigInt(minorUnits), this.scale);
  }
}

/**
 * An assignment as the text its editor starts with. Unlike other amount fields it keeps a minus
 * sign: an assignment can be negative (money taken back), and an editor that dropped the sign
 * would save it positive on Enter.
 */
export function assignmentToInput(cents: number, style: AmountStyle = amountStyle()): string {
  const text = amountToInput(cents, style);
  return cents < 0 ? `-${text}` : text;
}
