---
phase: 02-shared-form-controls
plan: 19
subsystem: client/ui
tags: [ui, form-controls, combobox, payee, react-aria, e2e]
status: complete
requires:
  - phase: 02-shared-form-controls
    plan: 09
    provides: "The shared Combobox (allowsCustomValue, menuTrigger, filter, emptyState, footer, inputClassName, popoverClassName)"
provides:
  - "client/src/components/transactions/PayeeCombobox.tsx: a thin wrapper over the shared Combobox, with the same props and export, plus the pure payeeSuggestions and isNewPayee rules"
  - "client/src/components/ui/Combobox.tsx: fieldClassName (the caller's own field look, no box or buttons) and D-12 Escape containment for every Combobox"
  - "Characterisation tests for the payee field (e2e/tests/transactions.spec.ts, 'the payee field'), a Payee field gallery specimen and its gallery test"
affects: [02-10, 02-11, CategoryPicker plan]
actuals:
  tasks: 1
  commits: 5
plan_head_before: 9c7064b
plan_head_after: 8748f39
tech-stack:
  added: []
  patterns:
    - "D-12 in the shared Combobox: onOpenChange keeps the open state, onKeyDownCapture snapshots it before React Aria handles the key, and onKeyDown calls preventDefault on an Escape that closed the list, so Modal.tsx stays open"
    - "A wrapper that must keep an existing screen's field look passes fieldClassName: the input alone takes the caller's classes, with no box, chevron or Clear button"
    - "E2E: after filling a React Aria Combobox, press Tab before querying the next field by role (React Aria hides the rest of the page while the list is open); click a field in a sliding sheet before filling it (the list closes when the sheet scrolls)"
key-files:
  created:
    - client/src/components/transactions/PayeeCombobox.test.ts
  modified:
    - client/src/components/transactions/PayeeCombobox.tsx
    - client/src/components/ui/Combobox.tsx
    - client/src/components/ui/Combobox.test.ts
    - client/src/pages/devGallery/ComboboxCard.tsx
    - e2e/tests/gallery/combobox.spec.ts
    - e2e/tests/transactions.spec.ts
    - e2e/tests/rules.spec.ts
    - e2e/tests/settings.spec.ts
    - e2e/tests/connection.spec.ts
    - e2e/tests/server-mode/auth.spec.ts
    - e2e/tests/phone/phone-native.spec.ts
    - e2e/tests/phone/phone.spec.ts
key-decisions:
  - "D-12 lives in the shared Combobox, not the wrapper: from outside, the wrapper cannot reliably tell whether the list is open when a key comes in, and the rule applies to every Combobox (D-12), so the CategoryPicker plan inherits it"
  - "Combobox gained fieldClassName (deviation, Rule 3), so the register row stays bare, the detail panel keeps its bordered input and the phone sheet keeps its 16 px input"
  - "Checkpoint decision, option 1 (orchestrator): at five e2e call sites, Tab on the payee field closes the list after the fill, because React Aria's useComboBox hides the rest of the form while the list is open. No expectation changed"
  - "The popover is 12rem wide in the row and the panel (w-48 min-w-48!, overriding the shared min-width of the trigger), and the field's width in the phone sheet"
requirements-completed: [WAVG-02, WAVG-03]
coverage:
  - id: D1
    description: "Payee rules: first eight in caller order, lower-cased substring, accents significant, the new-payee rule (exact match in any case), name, placeholder, id, non-ASCII value, row/panel/sheet classes"
    requirement: WAVG-02
    verification:
      - kind: unit
        ref: "client/src/components/transactions/PayeeCombobox.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Payee field unchanged on screen: suggestions on focus, narrowing, the new-payee hint, Enter keeps the typed name and saves nothing, Escape in the row keeps it, a suggestion sets the payee (row and detail panel)"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#the payee field"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12: in the phone sheet, Escape with the list open closes only the list, the sheet saves what was typed, and a second Escape closes the sheet"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#in the phone sheet, Escape with suggestions open closes only the list"
        status: pass
    human_judgment: false
  - id: D4
    description: "ArrowDown then Enter picks the first suggestion (row and gallery); the gallery specimen shows the hint row and the first eight"
    requirement: WAVG-02
    verification:
      - kind: e2e
        ref: "e2e/tests/transactions.spec.ts#ArrowDown then Enter picks the first suggestion"
        status: pass
      - kind: e2e
        ref: "e2e/tests/gallery/combobox.spec.ts#the payee field names a new payee, and ArrowDown then Enter picks the first suggestion"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every screen that uses the payee field, through its existing suites (desktop, phone, server mode)"
    requirement: WAVG-03
    verification:
      - kind: e2e
        ref: "desktop: transactions, rules, settings, connection, recurring, accessibility, dialog-focus, unsaved-drafts; phone: phone-native, phone; server-mode: auth"
        status: pass
    human_judgment: false
duration: 100min
completed: 2026-11-18
---

# Phase 02 Plan 19: PayeeCombobox on the shared Combobox Summary

**The payee field now runs on the shared Combobox on every screen. It behaves as before and
gains arrow-key selection. Escape with the list open closes only the list, so the phone sheet
stays open (D-12). Its tests changed only the role they select by, plus a Tab step at five call
sites (the checkpoint decision).**

## Performance

- Duration: about 100 minutes, including the checkpoint (18 November 2026)
- Tasks: 1 of 1 (tracer), in 5 commits
- Files: 1 created, 12 modified

## Accomplishments

- `PayeeCombobox.tsx` is a thin wrapper over `Combobox`, with the same props and export. It
  passes:
  - `aria-label` and `placeholder` "Payee", and `id`
  - `allowsCustomValue` and `menuTrigger="focus"`
  - `filter={false}` with its own items, and `emptyState={null}`
  - the text as `inputValue`, with `onInputChange` reporting `{ id: null, name }`
  - the selection reporting the picked payee's `{ id, name }`
  - the `New payee: "<text>"` footer, under the same condition as before

  The rules are pure functions, `payeeSuggestions` and `isNewPayee`. A ref keeps a choice from
  being reported again as typing. It has no `addEventListener` and does not create, rename or
  merge a payee. `TransactionFormRow.tsx` and `TransactionDetailPanel.tsx` are unchanged.
- In `Combobox.tsx`, `fieldClassName` hands the caller's classes to the input and drops the
  field box, chevron and Clear button. D-12 Escape containment works for every Combobox.
- Unit tests: 8 new in `PayeeCombobox.test.ts` and 1 new in `Combobox.test.ts`.
- Gallery: a "Payee field" specimen (twelve sample payees, starting at the unmatched "Night
  Market") and its test.

## Enter and Escape: before and after

| Key | Before (hand-rolled, pinned in `501c99b`) | After |
|-----|------------------------------------------|-------|
| Enter, add row | nothing: no save, row and typed name kept (the row is a `role="form"` div, not a `<form>`) | same. React Aria commits the typed text and closes an open list; nothing reaches a form. No wrapper code was needed |
| Enter, detail panel | nothing, panel and typed name kept | same |
| Escape, list open, add row | nothing (the list stayed open) | the list closes; row and text kept |
| Escape, list open, detail panel | the panel closed (its own document listener ignores `defaultPrevented`) | the panel still closes. It is a complementary panel, not a dialog or sheet, so the test is unchanged |
| Escape, list open, phone sheet | **the sheet closed**, losing what was typed | **only the list closes** (D-12, owner-approved 17 Nov 2026); a second Escape closes the sheet |

**How D-12 works:** React Aria lets an Escape propagate when `allowsCustomValue` is set, and
`Modal.tsx` closes unless the event was handled. The shared Combobox records whether its list was
open before React Aria handles the key (`onKeyDownCapture`, fed by `onOpenChange`). It then calls
`preventDefault()` on an Escape that closed the list. With the list closed, Escape is left alone,
so the dialog still closes.

**Test changed for it:** "in the phone sheet, Escape with suggestions open closes only the list"
(it was "… closes the sheet"). It now proves the sheet stayed open by saving from it. Then a
second Escape on a closed list closes the sheet. A comment cites `D-12, owner-approved 17 Nov 2026`.

**Negative case** (run and reverted): with the shared Combobox's `preventDefault()` replaced by a
no-op, this test fails, because the sheet closes and Save cannot be clicked. The layer broken was
`Combobox.tsx`'s `onKeyDown`.

## Selectors changed (for the PR body)

The field is now a combobox with a listbox, which is its correct role. Each of these lines
changed only from `getByRole('textbox', { name: 'Payee' })` to
`getByRole('combobox', { name: 'Payee' })`:

- `e2e/tests/rules.spec.ts:85`
- `e2e/tests/transactions.spec.ts:27` (the `fillNewTransaction` helper)
- `e2e/tests/settings.spec.ts:288`
- `e2e/tests/connection.spec.ts:85`
- `e2e/tests/server-mode/auth.spec.ts:437`
- `e2e/tests/phone/phone-native.spec.ts:171` and `:175`
- `e2e/tests/phone/phone.spec.ts:179`
- the four selectors in the new "the payee field" tests in `transactions.spec.ts`, written in
  Step 1 against the old role

`recurring.spec.ts` keeps its three `textbox` selectors (`MerchantSelect`). The plan's grep
expects 3 to remain; there are **4**. The fourth is `gallery/text-fields.spec.ts:73`, a TextField
specimen labelled "Payee" added after the plan's count. It is not PayeeCombobox and stays as it is.

## Deviations from Plan

1. **[Checkpoint decision, option 1, approved by the orchestrator]** React Aria's `useComboBox`
   calls `ariaHideOutside([input, popover])` whenever the list is open, with no prop to turn it
   off. Every other field becomes `aria-hidden` until the list closes. Eight existing tests that
   fill the payee and then query the next field by role timed out. The decision overrides the plan
   line that limited spec edits to the role. One step was added after the payee fill at five call
   sites, each with the comment
   `// React Aria hide-outside: Tab closes the list (02-19 checkpoint decision, option 1)`:
   - the `fillNewTransaction` helper (`transactions.spec.ts:27`)
   - `rules.spec.ts:85`
   - `settings.spec.ts:288`
   - `connection.spec.ts:85`
   - `server-mode/auth.spec.ts:437`

   Each step is `press('Tab')` on the payee field, as a keyboard user does. No expectation
   changed, with no retries and no sleeps.
2. **[Rule 3, blocking] `Combobox.tsx` and `Combobox.test.ts`** (not in the plan's file list):
   - `fieldClassName` keeps the row, panel and sheet looks, which the plan requires and which the
     shared Combobox's fixed field box could not.
   - D-12 is in the shared Combobox rather than the wrapper. The input's `aria-expanded` was not a
     usable signal from outside: after `fill` on a field still sliding in, React Aria had already
     closed the list.
3. **The D-12 test clicks the field before filling it.** React Aria closes an open list when a
   scroll container around the field scrolls (`useCloseOnScroll`). Playwright's `fill` on a field
   still sliding in scrolls the sheet, so the list closed at once. The click waits for the field to
   stop moving, as a person's tap would. On a device, a scroll caused by the virtual keyboard is
   exempt (React Aria's visual-viewport guard). The test also checks `aria-expanded="true"` before
   Escape. An earlier version passed only during the sheet's exit animation.

## Issues Encountered

- `phone/phone.spec.ts:77` ("the welcome screen fits a phone screen", sideways overflow) fails on
  the unmodified code as well, so it was already failing and is unrelated to the payee field.
  Logged here, not fixed.

## What the CategoryPicker plans can reuse

- D-12 is already in the shared Combobox. A Combobox inside a Modal closes only its list on
  Escape, with no code in the picker.
- `fieldClassName`, for keeping an existing screen's trigger look during the move.
- For tests:
  - Press Tab or Escape after filling a Combobox before reaching the next field by role (React Aria
    hide-outside).
  - Click a field in a sliding sheet before typing.
  - Use `aria-expanded` to check the list is open; option visibility also passes during an exit
    animation.
- The characterisation-first pattern: pin Enter and Escape on the hand-rolled control, then change
  only the selector role.

## Verification

- `npm --prefix client test` (all): 88 files, 750 tests passed. This includes
  `PayeeCombobox.test.ts` and `Combobox.test.ts`.
- `npm run build --prefix client`: built.
- Lint (`cd lint && npm ci && npm test && npm run lint`): 0 errors and 128 warnings, within the
  cap of 128. None are in the changed files.
- Desktop: `transactions`, `rules`, `settings`, `connection`, `recurring`, `accessibility`,
  `dialog-focus` and `unsaved-drafts`: 99 passed.
- Phone: `phone-native` and `phone`: 21 passed, 1 failed (`phone.spec.ts:77`, already failing,
  see above).
- Server mode: `auth.spec.ts`: 17 passed.
- Gallery: `combobox.spec.ts`: 14 passed.
- `grep -rn "getByRole('textbox', { name: 'Payee' })" e2e/tests | wc -l`: 4 (3 in
  `recurring.spec.ts`, plus the TextField gallery specimen; see Selectors).
- `grep -c 'react-aria-components\|ui/Combobox' PayeeCombobox.tsx`: 1.
  `grep -c addEventListener PayeeCombobox.tsx`: 0.
- `TransactionFormRow.tsx` and `TransactionDetailPanel.tsx` are unchanged. No `package.json` or
  lockfile changed.

## Task Commits

1. `501c99b` test(e2e): pin the payee field's behaviour before it moves onto the shared Combobox (#267)
2. `4a536fe` docs(02-19): blocked at a decision (checkpoint SUMMARY and WIP patch)
3. `e8a265f` refactor(ui): PayeeCombobox is a wrapper over the shared Combobox (#267)
4. `8748f39` docs(02-19): drop the WIP patch, now applied
5. this SUMMARY

## Self-Check: PASSED

- Commits `501c99b`, `e8a265f` and `8748f39` exist on `worktree-agent-p0219-a1`.
- The created and modified files listed above exist.
- `02-19-WIP.patch` is deleted.
- STATE.md and ROADMAP.md are unchanged.
- No commit mixes a `docs/superpowers/gsd-records/` file with a repository file.
