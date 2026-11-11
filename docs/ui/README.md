# UI sessions: start here

For any UI or design work. Read in this order and stop as soon as you have enough:

1. [HANDOVER-UI.md](HANDOVER-UI.md): what the last UI session did, what is next, traps.
   While the design re-review waves are running, also read [WAVES.md](WAVES.md): wave status,
   open PRs, owner decisions and the per-wave routine.
2. The screen's row in [MAP.md](MAP.md): route, page file, component folder, hooks, e2e spec.
3. Only the files that row names. Use `wc -l` before opening a large file and read the part you need.
4. [DESIGN.md](../../DESIGN.md) only when a visual decision is needed (colour, type, spacing, motion).

Do not read [HANDOVER.md](../../HANDOVER.md) history or `docs/handover/ARCHIVE.md` whole; grep them.

## Tokens

`client/src/index.css` `@theme` is the single source of design tokens (light and dark roles).
DESIGN.md describes them; it does not define them. Add or change a token there, never inline.

## Historical, not current guidance

- [docs/UX-UI-AUDIT.md](../UX-UI-AUDIT.md): 7 November 2026 audit (finding IDs AU-001 to AU-014).
- [docs/UX-REVIEW.md](../UX-REVIEW.md): the up.83 UX teardown.
- [docs/PHASE-10-WARM-DESIGN.md](../PHASE-10-WARM-DESIGN.md): the earlier warm design phase.
- [docs/critiques/](../critiques/): dated page critiques.

## Evidence rule

Screenshots and captures go in the git-ignored `.ui-evidence/<date>-<screen>/` (for example
`.ui-evidence/2026-11-11-budget/`). Never commit them; attach them to the PR or issue.
The committed `docs/ux-ui-evidence/` belongs to the 7 November audit; leave it as it is.

## Backlog rule

One GitHub issue per finding on `tvrooi/Allotment`, titled `ui(<screen>): ...`, with labels from
[docs/agents/triage-labels.md](../agents/triage-labels.md) (new findings start as `needs-triage`).
Record the issue numbers in HANDOVER-UI.md, not in HANDOVER.md.
