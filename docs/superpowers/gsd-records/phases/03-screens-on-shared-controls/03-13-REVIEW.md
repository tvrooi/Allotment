---
phase: 03-screens-on-shared-controls
plan: 03-13
reviewed: 2026-11-20T03:40:00Z
depth: standard
diff_range: 942f1ee0..eda3ecdb
files_reviewed: 5
files_reviewed_list:
  - client/src/components/transactions/TransactionFormRow.tsx
  - client/src/components/transactions/TransactionDetailPanel.tsx
  - e2e/tests/transactions.spec.ts
  - e2e/tests/phone/phone-native.spec.ts
  - e2e/tests/recover.spec.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
  necessity: 0
status: issues_found
---

# Phase 3 (plan 03-13): Code Review Report

**Reviewed:** 2026-11-20T03:40:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

I reviewed `942f1ee0..eda3ecdb`, the three 03-13 commits `da3321ff`, `877dc902` and `eda3ecdb`. The
executor's worktree was merged early into `redesign` (`9f8aedd4`) and then recreated detached at
`eda3ecdb` at the same path. All reading and checks ran against `eda3ecdb`. I left out the
SUMMARY.md planning file, apart from checking its claims.

Overall the port is careful and mostly faithful. I found no blocker.

**What holds:**

- **Money.** Every amount is a `CurrencyInput` (`type="text"`, `inputMode="decimal"`) in integer
  minor units. `parseAmount` is `readTypedAmount(...) ?? 0` (`client/src/utils/currency.ts:345`),
  and `CurrencyInput` reads text with the same `readTypedAmount`. So `allowNegative` keeps the old
  readings of a minus sign.
- **Categories.** The choices match the old list. Old `CategorySelect` (`CategorySelect.tsx:29-60`)
  offered every category in `groups` (hidden ones too), "Uncategorised", and transfers to the other
  open accounts on the main field only. The new code passes `includeHidden`, `allowNone`,
  `allowCreate={false}`, and `transferAccounts` on the main field only.
- **Reconciled rows.** A reconciled transaction can't be edited. The panel date is `isDisabled`.
  The form row only ever creates: both callers, `TransactionTable.tsx:495` and `:699`, pass no
  `initial`.
- **Prohibited files.** `TransactionFilters.tsx`, `TransactionMarks.tsx` and
  `transaction-filters.spec.ts` are untouched.
- **Raw-control gate.** It prints `0` on both components.
- **Enter to save.** The executor says the row never had an Enter-to-save handler. That is true:
  the old row had no `<form>` and no `onKeyDown`, and `TransactionTable` adds neither.
- **Selector changes.** Each changed e2e selector has a reason. No test is skipped, loosened,
  retried or made to sleep.
- **Pick-a-day test.** It is a real regression test. It asserts the server value, the register
  heading, and that focus stayed in the field, so a save that waits for blur fails it.

**Checks run (read-only):**

- `cd client && npx tsc --noEmit -p .`: exit 0.
- `cd e2e && npx tsc --noEmit -p .`: clean.
- `vitest run src/components/ui/DatePicker.test.ts`: 19/19.
- Raw-control gate: `0`.
- Banned-pattern grep on added lines (`any`, `ts-ignore`, `eslint-disable`, `TODO`,
  `waitForTimeout`, `.skip`, `retries`): none.

I did not run Playwright: the shared fixed ports are used by the 03-24 worktree. So the executor's
RED runs are taken from the summary, not reproduced.

**Main concerns:**

1. The panel's new "already sent" guard marks a day as sent before the server accepts it. A failed
   save then can't be retried, and the field keeps showing a date that was never saved (WR-01).
2. A third copy of the "other open accounts" transfer filter (WR-02).

The necessity rubric was applied: no necessity findings.

## Warnings

### WR-01: A failed date save in the detail panel can't be retried, and the field keeps showing the unsaved day

**File:** `client/src/components/transactions/TransactionDetailPanel.tsx:176-180` (with `:110-113`)

**Issue:** `saveDate` sets `sentDate.current = day` before `updateTx.mutate(...)`, and nothing puts
it back when the request fails:

- `useUpdateTransaction` (`client/src/hooks/useTransactions.ts:81-121`) has no `onError` and no
  optimistic update.
- The panel passes no `onError` either.

After a failure, `tx.date` is still the old day O, so the effect at `:110-113` (deps
`[tx.id, tx.date]`) never runs. Three things follow:

- `localDate` and the shown field stay on the new day A.
- `sentDate` stays A, so leaving the field calls `saveDate(A)`, which is a no-op.
- Picking A again is also a no-op.

The panel shows a date the server never saved, and the only way to get it saved is to pick another
day and then A again.

The old code compared against `tx.date` (`localDate !== tx.date`), so every later blur retried.
This is a regression the new guard introduces.

**Steps to reproduce:**

1. Open a transaction's detail panel.
2. Take the server away, or let saving pause. The panel already reads `useCanSave()` at `:169`,
   but `saveDate` ignores it, as before.
3. Choose a day from the calendar. The request fails.
4. Reconnect, then focus and leave the date field. Nothing is sent, and the field still shows the
   unsaved day.

**Fix:** Undo the mark when the request fails, and put the field back on the saved value:

```tsx
function saveDate(day: string) {
  if (day && day !== sentDate.current) {
    sentDate.current = day;
    updateTx.mutate(
      { id: tx.id, data: { date: day } },
      {
        onError: () => {
          sentDate.current = tx.date;
          setLocalDate(tx.date);
        },
      },
    );
  }
}
```

Add an e2e case that routes `PUT /api/transactions/:id` to a 500 once, picks a day, then picks it
again (or leaves the field) and asserts the second request is sent.

### WR-02: A third copy of the "other open accounts" transfer filter

**File:** `client/src/components/transactions/TransactionFormRow.tsx:86`

**Issue:** The same expression now exists three times:

- New: `accounts?.filter((a) => a.id !== accountId && !a.closedAt) ?? []`, in the form row.
- `CategorySelect.tsx:29`, which stays for Payment plans (WAVG-10).
- `TransactionDetailPanel.tsx:172`.

`TransactionTable.tsx:220` keeps a fourth, close variant (`accounts.filter((a) => !a.closedAt)`).
The project review rules ("One implementation per behaviour … A parallel version of logic that
exists is P1") flag exactly this. If transfer targets ever change, for example to exclude
off-budget or different-currency accounts, each copy has to be found by hand.

**Fix:** Add one helper and use it in all three places, for example
`transferTargets(accounts, fromAccountId)` in `client/src/components/transactions/` or `utils/`.
When 03-24/WAVG-10 retires `CategorySelect`, its copy goes with it.

## Info

### IN-01: The panel's typed date saves on leaving the field, not "once complete", and this isn't listed as a deviation

**File:** `client/src/components/transactions/TransactionDetailPanel.tsx:186-189`

**Issue:** The plan's must-have says "typed dates save once complete", and its key_link says
"onChange(iso) calls the update mutation". The implementation saves a typed day only when focus
leaves the field. The reason is sound: React Aria reports year 0002, 0020 and 0202 as whole days
while typing.

The summary records this under "Behaviour changes" but not under "Deviations from Plan". One case
is also untested: a whole typed date followed by Escape to close the panel. That depends on the
browser firing blur when a focused node is removed. Chromium does; WebKit and Firefox don't. The
payee path already depends on the same thing (the second-Escape test passes only in Chromium).

**Fix:** List this under Deviations. Optionally, save a typed day from the panel's Escape handler
or close path, or add a desktop case "type a whole date, press Escape, reopen" so the dependency
is pinned.

### IN-02: A cleared date in the form row still passes the save gate and sends `date: ''`

**File:** `client/src/components/transactions/TransactionFormRow.tsx:244-245, 97, 113`

**Issue:** `DatePicker` reports to `AmountFields` only when a date is half-typed
(`DatePicker.tsx:160`). A field with every segment cleared, or a cleared native picker on phones,
gives `''` and counts as valid. `handleSave` then sends `date: ''`.

This was also true of the old native input, so it is pre-existing. But the summary's line "Save
does nothing until the date is whole or valid" overstates it. I did not check whether the
offline "Save on device" path queues such a row.

**Fix:** In `handleSave`, return early when `!date`, or pass `isRequired` to the DatePicker and
gate on it. Correct the summary line.

### IN-03: `recover.spec.ts` now checks only the calendar button, not the date segments

**File:** `e2e/tests/recover.spec.ts:45, 74`

**Issue:** The old assertion checked that the date field itself was disabled. The new one checks
only "Choose from a calendar". That is a fair proxy today, because `isDisabled` reaches the whole
`AriaDatePicker`. But it would still pass if a later change disabled only the button and left the
segments typeable.

**Fix:** Also assert that the segments are disabled, for example
`expect(panel.getByRole('group', { name: 'Date', exact: true })).toHaveAttribute('data-disabled', 'true')`,
or check one `spinbutton`'s `aria-disabled`.

### IN-04: Clicking the visible "Date" text no longer focuses the field

**File:** `client/src/components/transactions/TransactionFormRow.tsx:237-239`; `client/src/components/transactions/TransactionDetailPanel.tsx:393-395`

**Issue:** The visible "Date" is now an `aria-hidden` `<span>` (the old one was a
`<label htmlFor>`), so clicking it no longer moves focus into the field. Every other field in the
row (Payee, Category, Notes, Outflow, Inflow) still has a working label. The accessible name is
kept through `hideLabel`, so this is a small usability gap, not an a11y failure.

**Fix:** Use the DatePicker's own visible label (drop `hideLabel` and style it through
`className`), or give the span an `onClick` that focuses the first segment.

### IN-05: The form row's `initial` and `onDelete` branches are dead code and were rewritten untested

**File:** `client/src/components/transactions/TransactionFormRow.tsx:71-76, 87, 230, 345-353`

**Issue:** Neither caller (`TransactionTable.tsx:495`, `:699`) passes `initial` or `onDelete`.
That makes these branches unreachable:

- the "Edit transaction" label
- `isEditingParent`
- the Delete button
- the starting outflow and inflow taken from `initial`

The port also changed what those starting values would be. It now uses `-initial.amount`, where
the old code used `centsToInput(initial.amount)`. Nothing exercises either version. This was
already dead before the plan.

**Fix:** Out of scope for this plan. Record it for 04-polish: either remove `initial` and
`onDelete` from `Props`, or add a caller and a test.

---

**Counts:** critical 0, warning 2, info 5 (total 7; necessity 0).

**Warnings:**

- WR-01: `client/src/components/transactions/TransactionDetailPanel.tsx:176`
- WR-02: `client/src/components/transactions/TransactionFormRow.tsx:86`

_Reviewed: 2026-11-20T03:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
