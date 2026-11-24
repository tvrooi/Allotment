# Phase 4: remaining screens and the guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans (or
> superpowers:subagent-driven-development for the larger tasks) to implement this plan task by task.
> Each task's full steps, file list and acceptance checks are in the linked GSD plan; follow it, but
> skip its GSD bookkeeping (SUMMARY files, `hdispatch job`, `/gsd-*`). Record anything a GSD plan
> says to put in a SUMMARY in the task's PR body instead. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The last screens move onto the shared control set, no money is typed into a number field
anywhere, and a lint rule keeps the shared set the only way to build a field (WAVG-07 to WAVG-10).

**Architecture:** Two PRs to `redesign`: G4 (tasks 1 to 13: the screens and `type="number"`) and G5
(tasks 14 to 16: the lint guard and removal of replaced controls). Decisions D-01 to D-22 are in
[04-CONTEXT.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-CONTEXT.md); the visual
contract is [04-UI-SPEC.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-UI-SPEC.md).

**Tech Stack:** React client, shared controls in `client/src/components/ui/`, Vitest, Playwright,
the lint package.

**Precondition:** the UAT 03 round 2 PR
([close-out plan](2026-11-23-uat-03-round-2-close-out.md)) is merged into `redesign` and the owner
has re-run UAT tests 1 and 2. These plans were written on 19 November 2026, before Phase 3 finished,
so task 1 reconciles them with the tree as merged.

Plan files are in [`../gsd-records/phases/04-remaining-screens-and-the-guard/`](../gsd-records/phases/04-remaining-screens-and-the-guard/).
Tasks run in the listed order; "after" names the tasks that must be done first.

---

## G4: the screens

### Task 1: Reconcile G4 with the merged tree — [04-01-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-01-PLAN.md)

- [x] Record "G4 reconcile: match" or "G4 reconcile: revise" (D-16), with the files Phase 3 left and
      the binding owner answers. If "revise", update the affected tasks below before going on.

### Task 2: Add what G4 needs to the shared set — [04-02-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-02-PLAN.md) (after 1)

- [x] Done

### Task 3: DatePicker and Checkbox form support for Household — [04-17-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-17-PLAN.md) (after 1)

- [x] Done

### Task 4: Settings, first half — [04-03-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-03-PLAN.md) (after 1)

- [x] Done

### Task 5: Settings, second half (People, Server and the rest) — [04-04-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-04-PLAN.md) (after 1, 2)

- [x] Done

### Task 6: Up and Plaid bank sections — [04-05-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-05-PLAN.md) (after 1)

- [x] Done

### Task 7: SimpleFIN and Enable Banking sections — [04-18-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-18-PLAN.md) (after 1)

- [x] Done

### Task 8: Screens with no Phase 3 parent (sign-in and others, D-13) — [04-06-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-06-PLAN.md) (after 1)

- [x] Done

### Task 9: Payment plans, and the last money `type="number"` (WAVG-08) — [04-07-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-07-PLAN.md) (after 1)

- [x] Done

### Task 10: Review and Cash flow, like for like (D-09) — [04-08-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-08-PLAN.md) (after 1)

- [x] Done

### Task 11: Tax, like for like — [04-09-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-09-PLAN.md) (after 1)

- [x] Done

### Task 12: Household components (seven, then five) — [04-10-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-10-PLAN.md), [04-16-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-16-PLAN.md) (after 1; 04-16 after 04-10)

- [x] 04-10 done
- [x] 04-16 done

### Task 13: Household page, then finish G4 — [04-11-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-11-PLAN.md), [04-12-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-12-PLAN.md) (after 2 to 12)

- [x] 04-11: `pages/Household.tsx`'s controls, region by region
- [ ] 04-12: whole-tree gate, cross-screen spec, full check, docs, next `0.2.0-up.N`, the G4 PR to
      `redesign` (no merge)

## G5: the guard (after G4 is merged)

### Task 14: Reconcile G5 and add the lint rule — [04-13-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-13-PLAN.md)

- [ ] Done

### Task 15: Remove what the shared set replaced (D-22) — [04-14-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-14-PLAN.md) (after 14)

- [ ] Done

### Task 16: Finish G5: docs, version, the G5 PR — [04-15-PLAN.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-15-PLAN.md) (after 14, 15)

- [ ] Done; tick this plan and update "Where things stand" in `docs/superpowers/README.md`.
