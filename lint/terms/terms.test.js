import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Audit F-09: one name per concept (docs/GLOSSARY.md, "Words in the app"). These are the
// alternate names the app used to show for the same thing. A new one fails here, so a screen
// can't quietly bring back "Unassigned" beside "Ready to assign".

const root = fileURLToPath(new URL('../../', import.meta.url));

const RETIRED = [
  [/\bUnassigned\b/, 'Ready to assign'],
  [/\bunassigned (money|today)\b/, 'Ready to assign'],
  [/Left to assign/i, 'Ready to assign'],
  [/To Be Budgeted|To be budgeted/, 'Ready to assign'],
  [/Search merchants|Your merchants|No merchants found|Create new merchant/, 'payee'],
];

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) yield path;
  }
}

/** Code with comments blanked, so a note about a name isn't mistaken for showing it */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('one term per concept', () => {
  for (const [pattern, use] of RETIRED) {
    it(`nothing in the client or server says ${pattern}; it is "${use}"`, () => {
      const found = [];
      for (const base of ['client/src', 'server/src']) {
        for (const file of sources(join(root, base))) {
          const text = withoutComments(readFileSync(file, 'utf8'));
          text.split('\n').forEach((line, i) => {
            if (pattern.test(line))
              found.push(`${file.slice(root.length)}:${i + 1}: ${line.trim().slice(0, 90)}`);
          });
        }
      }
      assert.deepEqual(found, []);
    });
  }
});
