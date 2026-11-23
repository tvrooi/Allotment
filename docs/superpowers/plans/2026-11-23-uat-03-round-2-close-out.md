# UAT 03 round 2 close-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this
> plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two UAT 03 round 2 fixes (G-03-3 iPhone date centring, G-03-4 colour-only row
selection) as one PR into `redesign`.

**Architecture:** The code is done and verified on two unpushed local branches. This plan only
combines them, runs the whole-change gate, writes docs and the version, and opens the PR.

**Tech Stack:** React client, Playwright e2e, Node 24.

**Detail:** [docs/handover/UAT-03-ROUND-2.md](../../handover/UAT-03-ROUND-2.md) (the handoff, with
the branch table and verification record) and the original GSD plan
[03-34-PLAN.md](../gsd-records/phases/03-screens-on-shared-controls/03-34-PLAN.md) (the exact file
allowlist). Where they differ, the handoff is newer.

---

### Task 1: One PR branch

- [ ] Create `fix/uat-03-selection-colour-and-date` from `origin/redesign`.
- [ ] Merge `fix/uat-03-date-centre` and `fix/uat-03-row-selection` into it, and nothing else (no
      `.impeccable` or `.ui-evidence` files).

### Task 2: Whole-change gate on Node 24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`)

- [ ] Client unit tests, client tsc and build.
- [ ] Lint, lowering the warning cap if warnings fell.
- [ ] e2e tsc.
- [ ] Playwright, one project at a time: desktop, phone, iphone-webkit, demo, server-mode, gallery.
- [ ] Recheck `transactions.spec.ts:1346` on `origin/redesign` as well, and record whether the branch
      made it flaky.

### Task 3: Docs and version

- [ ] `npm run release:prepare -- 0.2.0-up.180` (confirm no tag exists for it), plus a CHANGELOG entry
      for both fixes.
- [ ] Update `docs/ui/HANDOVER-UI.md`, `docs/ui/MAP.md`, `docs/ui/WAVES.md`, `docs/HOUSEHOLDS.md` and
      `HANDOVER.md` State as the handoff lists. None may still say rows are ticked.
- [ ] Tick this plan and update "Where things stand" in `docs/superpowers/README.md`.

### Task 4: Evidence

- [ ] Screenshots of two selected rows at 1280 px and 390 px, light and dark, from demo or disposable
      data, in the git-ignored `.ui-evidence/2026-11-22-uat-03-round-2/`.

### Task 5: The PR

- [ ] Open one PR into `redesign` with `--repo tvrooi/Allotment`. The body follows the handoff's
      list: owner's words apart from planner choices, the review fixes, the unplanned spec change, and
      G-03-3 reported as awaiting the owner's iPhone check.
- [ ] CI green, including the Linux gallery pixel comparison. Do not merge, tag or release.

### Task 6: Cleanup once the PR is open

- [ ] Remove the local GSD worktrees and their `worktree-agent-*` branches named in the handoff.
