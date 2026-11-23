---
phase: 03-screens-on-shared-controls
plan: 03-02
iteration: 3
reviewed: "2026-11-19T03:58:26Z"
depth: standard
worktree: .claude/worktrees/agent-p0302-a1
head: 9e55b7b1
diff_base: 2876400e
files_reviewed: 9
files_reviewed_list:
  - client/src/components/ui/CurrencyInput.tsx
  - client/src/components/ui/CurrencyInput.test.ts
  - client/src/components/ui/NumberField.tsx
  - client/src/components/ui/NumberField.test.ts
  - client/src/components/ui/hookTestHarness.ts
  - client/src/components/ui/numberText.ts
  - client/src/components/ui/numberText.test.ts
  - client/src/components/ui/fieldMessages.ts
  - client/src/components/ui/fieldMessages.test.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
  necessity: 1
status: issues_found
---

# Phase 03, plan 03-02: Code Review Report, iteration 3 (final)

**Reviewed:** 2026-11-19T03:58:26Z
**Depth:** standard
**Files reviewed:** 9 (the fix range `2876400e..9e55b7b1`, then the whole plan `80898425..9e55b7b1` for CurrencyInput, NumberField and numberText)
**Status:** issues_found

## Summary

**Checks run.** These ran in the worktree, read-only:

- The four ui test files pass: 52/52.
- `cd client && npx tsc --noEmit` passes.
- ESLint on the six changed source and test files gives 0 errors and 0 warnings.
- `git diff --check 80898425..HEAD -- client` is clean.
- `git status` shows no tracked file changed.

**Mutation testing.** I ran the mutations on a copy of `client/` in the session scratchpad, so the worktree was never edited.

**Real-React confirmation.** I bundled NumberField with the real `Field`, `Input`, `AmountFields` and react-dom into a probe page and drove it in Playwright Chromium. This checked the two NumberField defects below outside the test harness. All data was mock.

**Plan conformance.**

- The prohibitions hold. The change touches no screen file and adds no package, `cn()` or class-merging library. Every changed file is under `client/src/components/ui/`.
- CurrencyInput keeps `type="text" inputMode="decimal"`. It reads money only through `readMoneyText`, which uses `readTypedAmount`/`readAmountExpression` and returns integer minor units.
- NumberField never sets a number type and uses only the shared `Field` and `Input`.
- The change adds no test skips, retries or sleeps, and no e2e selector changed.

**Verdict.** All five iteration-2 findings are addressed, and each fix has a test that fails without it (see the table). However, the CR-02 fix introduced a new defect, CR-01 below. The `pendingEdit` flag stays set when the caller's value does not change. A later external value change is then swallowed, and the field shows one number while Save submits another. Chromium confirms this.

### Iteration 2 recheck

| Prior finding | Status | Fails without the fix? (evidence) |
| --- | --- | --- |
| R2-CR-01 focused reset in explicit-commit CurrencyInput | **Fixed** (`CurrencyInput.tsx:117-123`) | **Yes, by mutation.** Reverting the condition to `if (!focused)` fails "resets valid and invalid explicit-commit drafts…" (`expected '100+50' to be '20.00'`). Removing only the focused `setRaw` also fails it. |
| R2-CR-02 deferred rounding overwrites draft | **Fixed for one deferred acknowledgement** (`NumberField.tsx:105-107`). This fix causes CR-01 below, and WR-01 covers what it still misses. | **Yes, by mutation.** Restoring "consume on the next render" fails the R2-CR-02 test. Ignoring `resetKey` fails it. A no-op `onBlur` fails it. |
| R2-CR-03 tightened bound leaves Save enabled for an out-of-range controlled value | **Fixed** (`NumberField.tsx:120-123`) | **Yes, by mutation.** `const valid = parsed.valid` fails the R2-CR-03 test (`allValid` stays true at max 3.147). |
| R2-CR-04 bound relax commits through a disabled field | **Fixed** (`NumberField.tsx:125`) | **Yes, by mutation.** Dropping `!isDisabled &&` fails the R2-CR-04 test (`onChange` called with 61 while disabled). The second guard, `onChange`'s `if (isDisabled) return` at line 163, can be removed with every test passing (IN-03). |
| R2-WR-01 duplicated hook harnesses / not mounted React | **Partly fixed.** The duplication is gone: both tests import one `hookTestHarness.ts`. The review's actual fix, running the interaction assertions against mounted React, was not done (WR-03). | Not applicable (test infrastructure). |

### Does `hookTestHarness.ts` belong?

It is test-only and lives in `ui/`, so the plan's "no file outside `client/src/components/ui/`" check holds. It is lint-clean, and no app module imports it, so it never ships.

It is acceptable as a stopgap that removed the duplicated runners. It should not be the only interaction coverage for these controls, because it emulates React rather than running it (WR-03). It is also outside the plan's `files_modified` list, and the SUMMARY still says "Deviations: None" (IN-04).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: After an edit that leaves the value unchanged, NumberField ignores external value changes, so it shows one number while Save submits another

**Severity:** BLOCKER (P1, wrong behaviour; a regression introduced by the R2-CR-02 fix)
**File:** `client/src/components/ui/NumberField.tsx:105-107` (also the comment at 94-96, the flag set at 171 and 139)

**Issue:**

1. A valid keystroke sets `pendingEdit: true` (line 171).
2. The flag is cleared only when the `value` prop changes (lines 106-107) or on blur (157-160).
3. If the caller's value does not change after the edit, the flag stays set. This happens when the text means the same number, as with `05`, `5.` or `5.0` over 5, or when the caller rounds back to the current value, as with `6.501` over 6.5 in the basis-point case.
4. The next prop change, whatever its source, is then taken as the acknowledgement of that edit, and the visible draft is kept.

The comment at 94-96 says "an unprompted prop change replaces the draft". That is false in this state.

**Reproduction (real React, Chromium):**

1. Render `NumberField` with value 5, bounds 1 to 60, inside `AmountFields`, with `onChange={setValue}`.
2. Fill `05` (reads as 5, so the value is unchanged).
3. With the field still focused, have the parent call `setValue(7)`.

Result: the textbox shows `05`, the stored value is 7, `aria-invalid` is absent and Save is enabled. Saving submits 7 while the field says 5. In the harness the same sequence gives `text=05 value=7 allValid=true isInvalid=false`.

**Unfocused variant (harness):** this happens through the bound-relax reconciliation (line 139) when the caller does not adopt the emitted value.

1. Type `61` (max 60), blur, then raise max to 100. The field emits 61 and the caller keeps 12.
2. Later the parent sets value 20.

Result: the field keeps showing `61` while the value is 20 and `allValid` is true. With no focus, no blur ever clears the flag.

**Why it's critical:** this is the failure class of iteration-2 CR-01: a stale draft that disagrees with what will be saved, with no invalid indication. Iteration 2's code consumed the edit flag on the next render, so this sequence reset correctly before the fix.

**Fix:** Count a prop change as the acknowledgement only when it is consistent with the typed text. For example, store the emitted number, and keep the draft only when the new `value` equals it or equals the typed number rounded to fewer decimal places. Treat anything else as an external reset. Clear the flag once an acknowledgement is consumed. Add a test that fails today: value 5, type `05`, rerender `{ value: 7 }` without blur, then expect `'7'`.

```ts
} else if (value !== draft.lastValue) {
  const typed = parseDraft(draft.text, min, max, allowDecimal, optional).value;
  const isAck = draft.pendingEdit && typed !== null && value !== null && roundsTo(typed, value);
  setDraft(isAck
    ? (prev) => ({ ...prev, lastValue: value, pendingEdit: false })
    : { text: toDraft(value), lastValue: value, lastResetKey: resetKey, pendingEdit: false, committed: true });
}
```

## Warnings

### WR-01: A single boolean handles only one acknowledgement in flight, so in-order asynchronous acknowledgements put an older value back mid-typing

**Severity:** WARNING (P1, verified in the harness; plausible for asynchronous callers)
**File:** `client/src/components/ui/NumberField.tsx:106-107`

**Issue:**

1. Each keystroke sets the same `pendingEdit` boolean.
2. The first prop change consumes it, so a second acknowledgement already on its way is taken as an external reset.

React batches all pending transition lanes, so plain `startTransition` callers mostly avoid this. A caller whose value arrives later in order does not. Examples are a save-on-change mutation with a query refetch, or a debounced store.

**Reproduction (harness, mock values):** start at value 3, type `3.1`, `3.14` and `3.146`, then deliver the acknowledgements in order: 3.1, 3.14, then 3.15 (rounded).

Result: the textbox ends at `3.15`, not `3.146`. In real timing the text jumps back to an older value while the person is still typing.

**Fix:** Apply the CR-01 rule: keep the draft while each incoming value is consistent with the current text, and reset only on an inconsistent value or `resetKey`. Alternatively, document in the prop docs that `NumberField` needs a synchronous or transition-batched caller. Add a test for acknowledgements that arrive in order after typing has moved on.

### WR-02: Disabling a field that holds out-of-range text, then relaxing its bound, keeps Save disabled with no message

**Severity:** WARNING (P1, UX dead end)
**File:** `client/src/components/ui/NumberField.tsx:123-130` (with 193-196)

**Issue:** While the field is disabled, `needsCommit` is false, so `committed` stays false. As a result:

- The reported validity, `valid && draft.committed`, stays false.
- Once the relaxed bound makes the draft parse as valid, `isInvalid` (`!valid`) becomes false, so no error or alert is shown.

The form's Save stays disabled with nothing on screen to explain why, until the field is re-enabled.

**Reproduction (real React, Chromium, mock values):** with value 12 and max 60, fill `61`, blur, set `isDisabled`, then set max 100.

Result: the textbox shows `61` and is disabled. `aria-invalid` is null, there are 0 `role=alert` elements, the stored value is 12 and Save is disabled. The harness gives the same: `allValid=false isInvalid=false err=undefined`.

**Fix:** While disabled, either report the field as valid and restore the controlled value (a disabled field should not hold a form hostage), or keep showing the range error until the draft is committed. Extend the R2-CR-04 test to assert `allValid`/`isInvalid` between "disable + relax" and "re-enable".

### WR-03: The shared harness emulates React rather than running it, and passes with an infinite render loop

**Severity:** WARNING (P1, test reliability; iteration-2 WR-01 not done in substance)
**File:** `client/src/components/ui/hookTestHarness.ts:215-249` (also 96-99 and 49-113)

**Issue:** Iteration 2 asked for the interaction assertions to run against mounted React. Instead, the harness monkey-patches React's hooks and calls only the top-level component function. Consequences:

1. **Render loops pass silently.** The render loop gives up after 10 passes (218-226) and the effect flush after 5 (248), with no error. React would throw "Too many re-renders". As a mutation, I added `setDraft((prev) => ({ ...prev }))` at the top of NumberField's render. All 5 harness interaction tests still passed, and only the `renderToStaticMarkup` tests failed. CurrencyInput behaves the same way: with a render-phase state loop, its CR-01, CR-04 and WR-02 interaction tests still passed.
2. **Contexts are wrong.** `useContext` returns the validity reporter for every context (96-99). Any context besides the validity one, such as a style or locale provider or React Aria contexts, silently gets the wrong value.
3. **Many hooks are not patched.** `useMemo`, `useReducer`, `useLayoutEffect`, `useImperativeHandle` and `useTransition` are absent. Adding any of them to CurrencyInput or NumberField calls the real hook outside a render and fails with "Invalid hook call", for reasons unrelated to the change.
4. **Child components never run.** `Field`, `Input` and React Aria's `TextField` never render. The wiring the fixes depend on is therefore untested by interaction tests: `onBlur` forwarding through `Input`, `isDisabled` reaching the `<input>`, and `aria-invalid`/`aria-describedby` after an edit. The Chromium probe shows that wiring works today, but no test guards it.

**Fix:** Keep the pure parser and `renderToStaticMarkup` tests. Move the interaction cases (CR-01..CR-04 of both iterations, and CR-01 above) to a mounted test. Either use Playwright against the 03-03 `/dev/controls` specimens, or add a small Playwright component page built the way the e2e suite already builds the app. Then delete `hookTestHarness.ts`. If the harness stays meanwhile, make it throw when it hits the pass limits instead of breaking silently.

## Info

### IN-01: A deferred acknowledgement from a blank or out-of-range start briefly shows and announces the range error

**File:** `client/src/components/ui/NumberField.tsx:120-123`
**Issue:** `valid` requires `controlledValid` once the draft is committed. With a required field at value `null`, typing `5` with a deferred caller renders `isInvalid=true` until the acknowledgement lands (harness: `P4 isInvalid=true allValid=false`). The `role="alert"` span is mounted and unmounted, so screen readers can announce a false error.
**Fix:** While `pendingEdit` is set, judge validity by the draft alone.

### IN-02: A focused reset in explicit-commit mode does not tell `onTextChange`

**File:** `client/src/components/ui/CurrencyInput.tsx:117-123`
**Issue:** After the R2-CR-01 reset, the field shows the new amount. A caller's live preview fed by `onTextChange`, like the Budget cell's `onDraft`, still holds the last typed cents until the next keystroke.
**Fix:** Document that the caller owns the preview on reset, or have the caller's reset also reset its preview. Do not emit from render.

### IN-03: The `isDisabled` guard in NumberField's `onChange` handler is unreachable

**Category:** necessity
**File:** `client/src/components/ui/NumberField.tsx:163`
**Issue:** `Field` passes `isDisabled` to React Aria's `TextField`, which disables the `<input>`, and a disabled input fires no change events. Removing the guard leaves all 14 NumberField tests passing (mutation). The R2-CR-04 behaviour is enforced by the `needsCommit` gate at line 125.
**Fix:** Remove the guard, or keep it with a comment saying it is defensive.

### IN-04: SUMMARY claims no deviations but adds an unplanned file and a new public prop

**File:** `docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-02-SUMMARY.md` ("Deviations from Plan: None")
**Issue:** `hookTestHarness.ts` is not in the plan's `files_modified`. NumberField's new `resetKey` prop is also not among the plan's listed artifacts, yet screen plans will need to know it is the explicit reset path (CR-01). Both are mentioned only inside the iteration-2 fix notes.
**Fix:** List both under Deviations, and add `resetKey` to the "Next Phase Readiness" notes for the screen plans.

## Findings by severity

1 critical, 3 warning, 4 info (8 total; 1 necessity).

- CR-01 `client/src/components/ui/NumberField.tsx:105`: after an edit that leaves the value unchanged, the sticky `pendingEdit` ignores an external value change, so the field shows one number while Save submits another (Chromium-confirmed).
- WR-01 `client/src/components/ui/NumberField.tsx:106`: only one acknowledgement can be in flight; in-order asynchronous acknowledgements put an older value back.
- WR-02 `client/src/components/ui/NumberField.tsx:130`: disabled field plus relaxed bound keeps Save disabled with no message (Chromium-confirmed).
- WR-03 `client/src/components/ui/hookTestHarness.ts:218`: the emulated-React harness passes with infinite render loops, gives every context the validity reporter, and never renders Field/Input.

---

_Reviewed: 2026-11-19T03:58:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
