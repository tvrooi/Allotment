import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Audit F-15: text colours must reach WCAG AA (4.5:1) on the backgrounds they are drawn on, in
// both themes. The tokens live in client/src/index.css and this reads them from there, so a
// colour change that drops below the line fails here, not in a screen-reader user's report.
// `text-disabled` is left out on purpose: it is for disabled controls and icons, which WCAG
// exempts. Text people need to read uses `text-tertiary` or darker.

const css = readFileSync(new URL('../../client/src/index.css', import.meta.url), 'utf8');

function tokens(opening) {
  const start = css.indexOf(opening);
  assert.ok(start >= 0, `${opening} not found in index.css`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out = {};
  for (const m of body.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [text token, backgrounds it is drawn on] */
const PAIRS = [
  ['text', ['page', 'surface', 'surface-alt', 'hover']],
  ['text-secondary', ['page', 'surface', 'surface-alt', 'hover']],
  ['text-tertiary', ['page', 'surface', 'surface-alt', 'hover']],
  ['positive', ['page', 'surface', 'surface-alt', 'positive-subtle']],
  ['negative', ['page', 'surface', 'surface-alt', 'negative-subtle']],
  ['caution', ['page', 'surface', 'surface-alt', 'caution-subtle']],
  ['expected', ['page', 'surface', 'surface-alt']],
  ['brand-700', ['page', 'surface', 'brand-50']],
];

const light = tokens('@theme {');
const themes = { light, dark: { ...light, ...tokens('.dark {') } };

for (const [name, colours] of Object.entries(themes)) {
  describe(`${name} theme text contrast`, () => {
    for (const [fg, backgrounds] of PAIRS) {
      for (const bg of backgrounds) {
        it(`${fg} on ${bg} is at least 4.5:1`, () => {
          assert.ok(colours[fg], `--color-${fg} is not defined`);
          assert.ok(colours[bg], `--color-${bg} is not defined`);
          const ratio = contrast(colours[fg], colours[bg]);
          assert.ok(ratio >= 4.5, `${colours[fg]} on ${colours[bg]} is ${ratio.toFixed(2)}:1`);
        });
      }
    }
  });
}

describe('the contrast helper', () => {
  it('knows the extremes', () => {
    assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
    assert.equal(contrast('#777777', '#777777'), 1);
  });
});
