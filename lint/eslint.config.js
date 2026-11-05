// ESLint for Allotment (audit F-08, docs/AUDIT-2026-11.md). Run from this folder with
// `npm run lint`: it lints from the repository root, so paths below are relative to it.
//
// Why a package of its own: typescript-eslint parses with TypeScript's JavaScript API, which
// TypeScript 7 (the app's compiler) doesn't have. TypeScript 6 here only parses; type checking
// stays with each package's own `tsc`. ESLint stays on 9 until eslint-plugin-jsx-a11y accepts 10.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import iconOnlyControl from './rules/icon-only-control.js';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_name` marks a value left out on purpose (an omitted field, an unused argument)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      // `set.has(id) ? set.delete(id) : set.add(id)` is the toggle idiom here
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
      // Burn-down: tracked as warnings, and CI's warning cap stops new ones (lint/README.md)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Bank and file text is cleaned of control characters on purpose (cleanUpText and kin)
      'no-control-regex': 'off',
    },
  },
  {
    // Audit F-22. `toISOString()` is the UTC instant, so cutting it down to a date gives the
    // previous day for the morning hours east of UTC (Sydney), and `addDays(parseISO(day), n)`
    // read back through it came out a day short. A calendar day goes through utils/date.ts
    // (server) or utils/calendarDay.ts (client): addDaysIso, todayIso, localDayIso, utcDayIso.
    files: ['server/src/**/*.ts', 'client/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'server/src/test/**', 'client/src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name=/^(slice|substring|substr|split)$/][callee.object.callee.property.name='toISOString']",
          message:
            'toISOString() cut down to a date is the UTC day, not the calendar day (audit F-22). Use todayIso, localDayIso, utcDayIso or addDaysIso from utils/date (server) or utils/calendarDay (client).',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'server/src/test/**', 'client/src/test/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['client/src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { allotment: { rules: { 'icon-only-control': iconOnlyControl } } },
    rules: { 'allotment/icon-only-control': 'error' },
  },
  {
    files: ['client/src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
    // Accessibility (audit F-15) is a burn-down: every jsx-a11y finding is a warning, and CI's
    // warning cap (lint/package.json) stops the count growing while it is worked down.
    rules: {
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules)
          .filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) !== 'off')
          .map(([rule, setting]) => [
            rule,
            Array.isArray(setting) ? ['warn', ...setting.slice(1)] : 'warn',
          ]),
      ),
      // Not in the recommended set: a header cell, option or heading with nothing a screen
      // reader can read. (Icon-only buttons and links are `allotment/icon-only-control`.)
      'jsx-a11y/control-has-associated-label': [
        'warn',
        {
          depth: 4,
          ignoreElements: [
            'audio',
            'canvas',
            'embed',
            'input',
            'textarea',
            'tr',
            'td',
            'video',
            'button',
            'a',
          ],
        },
      ],
    },
  },
);
