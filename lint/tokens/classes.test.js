import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Class names that undo the design tokens (the make-interfaces-feel-better review, 25 November
// 2026). `transition-all` animates every property that changes, layout included; name the ones
// that should move (transition-colors, transition-opacity, transition-[width]). A Tailwind palette
// colour (bg-red-50, text-gray-900) skips the theme, so it stays the same in dark mode: use the
// tokens in client/src/index.css (negative, negative-subtle, text, surface).

const root = new URL('../../client/src/', import.meta.url).pathname;

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const PALETTE =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow|decoration|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

function offending(pattern) {
  const found = [];
  for (const file of sources(root)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const match = line.match(pattern);
        if (match) found.push(`client/src/${relative(root, file)}:${i + 1} ${match[0]}`);
      });
  }
  return found;
}

describe('client class names', () => {
  it('never transition every property', () => {
    assert.deepEqual(offending(/\btransition-all\b/), []);
  });
  it('take colours from the theme, not the Tailwind palette', () => {
    assert.deepEqual(offending(PALETTE), []);
  });
});
