# Lint

ESLint for `client/src` and `server/src` (audit F-08, [docs/AUDIT-2026-11.md](../docs/AUDIT-2026-11.md)).

```bash
cd lint && npm ci && npm test && npm run lint
```

- **Errors fail CI.** That covers JavaScript and typescript-eslint's recommended rules, and the
  React rules of hooks (a hook called conditionally or in a callback).
- **Calendar days.** `toISOString()` cut down to a date (`.slice`, `.substring`, `.split`) is an
  error in production code (audit F-22): it is the UTC day, a day behind in Sydney's morning.
  Use `utils/date.ts` on the server and `utils/calendarDay.ts` in the client (`addDaysIso`,
  `todayIso`, `localDayIso`, `utcDayIso`). Tests are exempt: they build UTC dates on purpose.
- **Icon-only controls.** A button or link that holds only an icon needs an `aria-label`
  (`rules/icon-only-control.js`, an error; audit F-15). jsx-a11y's own rule trusts any component
  child, so it never saw a lucide icon.
- **Tests.** `npm test` runs three groups with node's test runner: the rule above, WCAG contrast
  of the theme's text colours in both themes (`tokens/`, read from `client/src/index.css`), and
  the retired names that must not come back (`terms/`, from docs/GLOSSARY.md).
- **Warnings are a burn-down.** These are accessibility (jsx-a11y, audit F-15), `any` outside
  tests, and hook dependency lists. `npm run lint` allows at most the current number
  (`--max-warnings` in `package.json`), so new code can't add any. When you fix some, lower the
  number in the same PR. `npm run lint:report` lists them all without the cap.
- **Its own package.** typescript-eslint parses with TypeScript's JavaScript API, which TypeScript 7
  (the app's compiler) doesn't have, so TypeScript 6 here only parses. Type checking stays with
  each package's `tsc`. ESLint stays on 9 until eslint-plugin-jsx-a11y supports 10.
- Install scripts are blocked (`.npmrc`), as in every package here.
