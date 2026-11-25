import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './no-raw-form-control.js';

// The rule as eslint.config.js wires it, not only the rule on its own: a config `ignores` once
// kept it out of components/ui, so type="number" there passed lint (G5 review)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: path.join(root, 'lint/eslint.config.js'),
});
const ruleErrors = async (file, code) =>
  (await eslint.lintText(code, { filePath: path.join(root, file) }))[0].messages.filter(
    (m) => m.ruleId === 'allotment/no-raw-form-control',
  );

test('the config refuses type="number" inside components/ui', async () => {
  const errors = await ruleErrors(
    'client/src/components/ui/Probe.tsx',
    'export function P() { return <input type="number" />; }\n',
  );
  assert.equal(errors.length, 1);
});

test('the config still lets components/ui use a native text input', async () => {
  const errors = await ruleErrors(
    'client/src/components/ui/Probe.tsx',
    'export function P() { return <input type="text" />; }\n',
  );
  assert.deepEqual(errors, []);
});

test('an allowlist entry needs a file and a reason', () => {
  const tester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  });
  assert.throws(() =>
    tester.run('no-raw-form-control', rule, {
      valid: [
        {
          filename: '/repo/client/src/pages/X.tsx',
          code: 'const a = 1;',
          options: [{ allow: [{ file: '', element: 'select', reason: '' }] }],
        },
      ],
      invalid: [],
    }),
  );
});
