# Redesign finish (milestone v1.0) — design

Migrated from GSD on 23 November 2026. This file is the entry point; the full, owner-approved detail
stays in the GSD records it links to.

**Core value:** every figure the owner sees is right to the cent: bank money lands once, reconciles
exactly, and each dollar sits in exactly one envelope.

## Goal

Finish the UI redesign on branch `redesign`. Wave F splits the crowded Settings page and marks good
moments. Wave G gives every field and selector on desktop one shared, accessible component set,
moves the screens onto it area by area, and adds a lint rule so the set stays the only way to build a
field. No phase changes a money figure, a server route or the token allowlist. Each phase is one or
two wave PRs to `redesign`.

## Phases

1. **Settings split and good moments** (#244, #241). Done 16 Nov 2026.
2. **Shared form controls** (Wave G G0-G1, #267, #264): the field audit and one accessible component
   set built from `@theme` tokens, with a gallery and screenshot test.
3. **Screens on shared controls** (G2-G3, #267): the everyday money screens, then planning, reports
   and files, with no behaviour change.
4. **Remaining screens and the guard** (G4-G5, #267): Settings, the bank sections and the shelved
   pages swapped; no money typed into `type="number"`; a lint rule; the old controls removed.

Success criteria for each phase are in
[ROADMAP.md](../gsd-records/ROADMAP.md#phase-details); requirement IDs (`WAVF-*`, `WAVG-*`) are in
[REQUIREMENTS.md](../gsd-records/REQUIREMENTS.md).

## Source records

- Project, constraints and key decisions: [PROJECT.md](../gsd-records/PROJECT.md),
  [intel/decisions.md](../gsd-records/intel/decisions.md),
  [intel/constraints.md](../gsd-records/intel/constraints.md)
- Phase 4's decisions (D-01 to D-22), UI contract and research:
  [04-CONTEXT.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-CONTEXT.md),
  [04-UI-SPEC.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-UI-SPEC.md),
  [04-RESEARCH.md](../gsd-records/phases/04-remaining-screens-and-the-guard/04-RESEARCH.md)
- Codebase maps (written 14 Nov 2026; check against the code before relying on them):
  [codebase/](../gsd-records/codebase/)
