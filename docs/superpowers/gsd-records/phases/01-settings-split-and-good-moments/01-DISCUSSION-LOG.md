# Phase 1: Settings split and good moments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 01-settings-split-and-good-moments
**Areas discussed:** Goal reached: seedling to flower

Areas offered but not selected (left to Claude within recorded rules): Connected banks on
Accounts, Categories in Budget, $0 Ready to assign moment.

---

## Goal reached: seedling to flower

### How much of the goal bar does the idea take over?

| Option | Description | Selected |
|--------|-------------|----------|
| Growth along the bar | Seed, seedling, bud, flower at 100%; the bar stays | ✓ |
| Completion only | Plain bar until 100%, then a sprout tick or flower | |
| The plant replaces the bar | Plant instead of the bar, percentage as text | |

### When does the bloom animation play?

| Option | Description | Selected |
|--------|-------------|----------|
| Once per goal, remembered | First time on this device, then static | ✓ |
| On every visit | Each time Goals opens | |
| Only when you cause it | Only when reached during the session | |

**Notes:** later moved to Phase 2 together with the animation.

### How should the plant look?

| Option | Description | Selected |
|--------|-------------|----------|
| Built from the brand mark | Inline SVG from the logo's sprout, brand colours | |
| Lucide icons | Existing Sprout/Flower icons | |
| You decide | The /impeccable plan picks, within BRAND.md | ✓ |

### Which goals get the flower?

| Option | Description | Selected |
|--------|-------------|----------|
| Money reached only | Existing `complete` rule incl. fundingComplete | ✓ |
| Both | Hand-marked completion also flowers | |
| Both, different looks | Flower for reached, quieter mark for hand-closed | |

### Rendering technology (owner asked whether three.js can be used)

Claude explained that three.js works but costs about 150 KB gzipped, needs one WebGL context per
canvas (browsers cap about 16), cannot read the CSS colour tokens, and needs hand-built reduced
motion and Safe mode handling; it recommended SVG + CSS.

| Option | Description | Selected |
|--------|-------------|----------|
| SVG + CSS, no new package | Tokens, reduced motion, many rows | |
| Allow a small animation library | e.g. motion, only if SVG/CSS can't | |
| three.js / 3D | Real 3D plant | ✓ |

### How much is 3D?

| Option | Description | Selected |
|--------|-------------|----------|
| 3D bloom, SVG stages | SVG stages; three.js lazy-loaded for the bloom only, one shared canvas | ✓ |
| 3D at every stage | Live 3D plant per row, one shared renderer | |
| 3D on the goal's own view | 3D only in a single goal's view | |

### three.js dependency in Phase 1 (roadmap allows new packages only in Phase 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Allow it in Phase 1 | Owner exception, lazy-loaded, still fallback | |
| Move the animation to Phase 2 | Phase 1 ships static SVG stages and flower | ✓ |

---

## Claude's Discretion

- Plant drawing (within BRAND.md).
- Where Connected banks lives on Accounts; where Categories lives in Budget.
- Old-link redirects, Settings default tab, guide and palette updates (ids unchanged).
- $0 Ready to assign wording and caveat handling (no unqualified "Fully budgeted").

## Deferred Ideas

- three.js bloom animation, once per goal, remembered per device: Phase 2 (with the dependency
  decision).
- WAVES.md lifetime: owner question before closing Phase 1.
