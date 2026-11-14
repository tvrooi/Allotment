# Context

Running notes from the 13 DOC-classified docs, keyed by topic. Large documents (AUDIT-2026-11, UX-UI-AUDIT, DEVELOPMENT, the 2026-10-20 investigation, START-HERE, UX-REVIEW, MAP) were read by status block, headings, decision tables and selected sections, not line by line.

## Topic: Australian budgeting investigation (phases 1-6, 8)
- source: docs/investigations/2026-10-20-australian-budgeting.md
- notes: 20 Oct 2026 investigation of `v0.2.0-up.4` with implementation notes for phases one to three (later extended to phases four, five, six, eight). Retain the monthly envelope budget; add payday funding, shared-expense attribution and a separate forecasting layer; bank statements must reconcile exactly and a display/report never rewrites a bank payment. Findings table: daily round-ups (verify accounting, then collapsible daily transfer summary), merchant photographs, fortnightly salaries, superannuation, 2Up/Essentials, Tricount-style splitting, progressive-disclosure UI, savings projection. Implementation order: (1) verify round-up accounting and unify report scopes/budget-boundary policy; (2) background sync/review and round-up presentation; (3) payday plan and bill coverage; (4) household/person ledger; (5) savings forecast; (6) YNAB envelope correctness. Each deliverable a focused PR with acceptance example and tests; opt-in setup keeps existing budgets stable; tested backup/restore before any live migration. Read in full only for headings, the findings table and the order table (53 KB document).

## Topic: Budget page critique (9 Nov 2026)
- source: docs/critiques/2026-11-09-budget.md
- notes: Score 27/40. P1: `$` vs `A$` on one screen; Ready to assign buried and coloured as warning. P2: dense rail, uniform green pills, placeholder contrast 3.1:1. Acted on in 0.2.0-up.154 (see decisions). Open: bolder "plots" variant as separate route, placeholder contrast, one recommended action between Hold money and Put the rest in.

## Topic: Full audit (3 Nov 2026, main 948e817, 0.2.0-up.83)
- source: docs/AUDIT-2026-11.md
- notes: Diagnostic only. Findings F-01 to F-24 (P1: left to spend counts savings, stale Budget after register edit, first Up import overspent, deleting an Up row pauses assigning, backup called complete; P2: non-loopback bind without login, `Input`/`Select` drop styles, no linter, terminology, Up sync full history, no code splitting, onboarding layers, many paths for same action, deleted rows remembered only for Up, accessibility, property coverage, Review reconcile prompt, access-token exception surface, documentation drift; P3: casing/dates, theme default, UTC/local date helpers, upstream fixes, test fragility). The status table (updated 4 Nov 2026) marks nearly all Fixed/Done; owner decisions I-1 to I-11 recorded as decisions. Sections: executive assessment, repository/feature map, findings register, design-system matrix, user journeys per persona, test matrix, upstream comparison, documentation drift register (G.2), remediation roadmap, final verdict. Large document (102 KB): read the status table, decisions section and headings; findings bodies skimmed by heading only.

## Topic: Brand and writing rules
- source: docs/BRAND.md
- notes: Allotment (formerly FlyBudget Up fork); tagline "Every dollar gets its plot."; palette Soil `#262520`, Marigold `#F46B35` (`--color-brand-500`), Canvas `#F7F5EF` (`--color-page`), Sprout `#1B7550` (`--color-positive`); filled controls keep darker `--color-brand-600`. Icon sources: `client/public/logo.svg`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `electron/resources/icon*.svg`. Wordmark `client/src/components/ui/BrandName.tsx`. Stored identifiers keep `flybudget` (env vars `FLYBUDGET_*`, cookies `flybudget_session`, `x-flybudget-*` headers, storage keys, data paths `/data/flybudget` and `flybudget_data_key.txt`, HA slug `flybudget_up`, images `ghcr.io/tvrooi/flybudget` and `flybudget-ha`, desktop internal name, Windows app ID `com.flybudget.app`, Linux package `flybudget`, `FlyBudgetMacWindow/1`, `flybudget-mac-window`). Repo moved from `tvrooi/FlyBudget` to `tvrooi/Allotment`; pre-rename desktop apps cannot auto-update and need one manual install. Writing: sentence case; dates via `formatDay` (`client/src/utils/dates.ts`), upcoming lists `formatShortDay`/`formatWeekday`, times `formatDayTime`; money via `client/src/utils/currency.ts`.

## Topic: Glossary and retired words
- source: docs/GLOSSARY.md
- notes: Installing, Up Bank and Budgeting terms for users. "Words in the app": say "Ready to assign" (not Unassigned, Left to assign, To be budgeted), "Payee" (not Merchant; a receipt or payment plan still has a merchant); `lint/terms/` fails when a retired name returns. Zero amounts shown plainly in normal colour; red/caution only for amounts above zero needing a decision.

## Topic: Guides, tips and user guide
- source: docs/GUIDES.md
- notes: Guides are data in `client/src/guides/` (`welcome.ts`, `budget.ts`, `pages.ts`, `tips.ts`); `GUIDES` in `guides/index.ts`; `data-guide="<page>.<thing>"` markers; components `GuideTour`, `GuideBanner`, `Tip`, `HelpMenu`, `GuidesDialog`; server `services/guideService.ts`, `routes/guides.ts` at `/api/guides` (`GET`, `PUT`, `POST /reset`); the user guide served at `/guide` (`client/src/userGuide/articles.tsx`, `DOCS_PAGES` in `client/src/utils/project.ts`); tests `utils/guides.test.ts`, `userGuide/articles.test.ts`, `e2e/tests/guides.spec.ts`, `e2e/tests/phone/guides-phone.spec.ts`, `e2e/tests/user-guide.spec.ts`. Optional navigation states in `client/src/utils/navFeatures.ts`. Prose docs must not list guides/tips (drift).

## Topic: Start here (installation)
- source: docs/START-HERE.md
- notes: Two tracks: A Home Assistant (needs HA OS or Supervised on 64-bit device; HA Container/Core have no app store; about 15 minutes) and B Desktop only; sections on macOS "damaged" warning for unsigned builds, making an Up token, coming from another app, whether HTTP is safe at home and away, troubleshooting. Up account (Australia) needed to import; "Add accounts manually" available without one. Skimmed headings and the opening only.

## Topic: Architecture reference (DEVELOPMENT.md)
- source: docs/DEVELOPMENT.md
- notes: Detailed upstream architecture reference carried from the working preview (copy of AGENTS.md); says AGENTS.md and MAINTENANCE.md govern current fork policy and that upstream CLA/registry/contributor references describe upstream only. Sections: Commands, Architecture, "Keep offline sync possible", License and contributions, Commit Message Conventions, Future Considerations. Line 166 describes `GET /api/export/backup` as "(version 3)" and says new tables go in `BACKUP_TABLES` (see conflicts report: constant is 34). 81 KB; read by headings and selected lines only.

## Topic: UX teardown (3 Nov 2026, 0.2.0-up.81)
- source: docs/UX-REVIEW.md
- notes: Implemented in 0.2.0-up.83 except #7 (owner kept the sidebar as it is; superseded by audit I-4 grouping). Conversion framing: visitor to demo, demo to install, install to activated (Up connected, first dollar assigned). Critical: website sells a different product; demo's sample budget broken on first screen; demo hides distinguishing feature; first run starts with "go read your server log"; Welcome weights Up equal to four banks; "Connect Up" asks for credential without explanation. High: 18 sidebar items, four competing onboarding systems, American default categories, red/green meaning three things, input-box wall budget table, decoded header controls, stacked banners, copy explaining internals, destructive bulk actions, new-device link dumps to Welcome. #1 sent demo links to GitHub (the `website/` left alone then; removed later by audit I-9). Historical per docs/ui/README.md.

## Topic: UI and UX audit (7 Nov 2026, 0.2.0-up.131)
- source: docs/UX-UI-AUDIT.md
- notes: Audit and proposed plan on baseline main `99021a5`; findings AU-001 to AU-014 (modal focus escape, charts suppress focus indicator, failed reads masquerade as empty features, report saving has no pending/failure state, confirmation dismisses before destructive action succeeds, passive dismissal discards multi-field work, amounts break inside digits ...). Sections: assessment, coverage/evidence, strong patterns, proposed design contract, findings, ten highest-value improvements, phased roadmap, before/after specs, verification checklist. Evidence in committed `docs/ux-ui-evidence/` (leave as is). Marked historical by docs/ui/README.md. 93 KB; read assessment, headings and a few findings only.

## Topic: UI sessions entry point
- source: docs/ui/README.md
- notes: Read order for UI work: HANDOVER-UI.md, WAVES.md while waves run, the screen's row in MAP.md, only files that row names, DESIGN.md only for visual decisions; do not read HANDOVER.md history or `docs/handover/ARCHIVE.md` whole. Design tokens only in `client/src/index.css` `@theme`. Historical (not current guidance): UX-UI-AUDIT.md, UX-REVIEW.md, PHASE-10-WARM-DESIGN.md, `docs/critiques/`. Evidence rule: git-ignored `.ui-evidence/<date>-<screen>/`; backlog rule: one GitHub issue per finding titled `ui(<screen>): ...` with triage labels (`docs/agents/triage-labels.md`), issue numbers recorded in HANDOVER-UI.md.

## Topic: UI handover (latest session)
- source: docs/ui/HANDOVER-UI.md
- notes: Overwritten each UI session. Records Waves A-E (add transaction from every page and phone tab bar up.167; Wave B up.168; palette up.169/171; Wave C dashboard up.170; Wave D up.172; Wave E up.173), refined dashboard now `/dashboard`, goals/forecast/household/investments redesign passes. In progress: none; `redesign` ahead of `main` with up.154 to up.172 prepared, not tagged (WAVES.md says up.154 to up.171). Next: issues #211-#220, #263, #264, #241, #244. Decisions: `@theme` sole token source; one brand colour for goal bars; `formatWholeCurrency` for long-range forecast amounts; `CategoryPicker`/shared `Select`; `PAGE_GUTTER`; undo announces via `undoStore.push`. Traps: scroll memory keyed by history key (`useScrollMemory`); phone tab bar safe-area and toast offset; `PREFERENCES_VERSION` is 4; `E2E_SKIP_BUILD=1` reuses stale build; global CSS in `@layer`.

## Topic: UI route map
- source: docs/ui/MAP.md
- notes: One row per route in `client/src/App.tsx` with page file, component folder, key hooks and e2e spec; Dashboard, Budget and Transactions in the main bundle, every other page `lazy()`. Split candidates over 800 lines: `Budget.tsx` (1466), `Household.tsx` (1598), `CashFlow.tsx` (1329). Line counts are snapshots refreshed 13 Nov 2026. Read the first 30 lines only; rows for other routes not individually checked.

