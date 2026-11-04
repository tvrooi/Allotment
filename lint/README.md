# Lint

ESLint for `client/src` and `server/src` (audit F-08, [docs/AUDIT-2026-11.md](../docs/AUDIT-2026-11.md)).

```bash
cd lint && npm ci && npm run lint
```

- **Errors fail CI.** That covers JavaScript and typescript-eslint's recommended rules, and the
  React rules of hooks (a hook called conditionally or in a callback).
- **Warnings are a burn-down.** These are accessibility (jsx-a11y, audit F-15), `any` outside
  tests, and hook dependency lists. `npm run lint` allows at most the current number
  (`--max-warnings` in `package.json`), so new code can't add any. When you fix some, lower the
  number in the same PR. `npm run lint:report` lists them all without the cap.
- **Its own package.** typescript-eslint parses with TypeScript's JavaScript API, which TypeScript 7
  (the app's compiler) doesn't have, so TypeScript 6 here only parses. Type checking stays with
  each package's `tsc`. ESLint stays on 9 until eslint-plugin-jsx-a11y supports 10.
- Install scripts are blocked (`.npmrc`), as in every package here.
