---
status: partial
phase: 03-screens-on-shared-controls
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md, 03-14-SUMMARY.md, 03-15-SUMMARY.md, 03-16-SUMMARY.md, 03-17-SUMMARY.md, 03-18-SUMMARY.md, 03-19-SUMMARY.md, 03-20-SUMMARY.md, 03-21-SUMMARY.md, 03-22-SUMMARY.md, 03-23-SUMMARY.md, 03-24-SUMMARY.md, 03-25-SUMMARY.md]
started: 2026-11-21T00:50:16Z
updated: 2026-11-22T01:36:34.112Z
---

## Current Test

[testing complete]

## Tests

### 1. Add transaction dialog
expected: Open Add transaction from the register. Payee, category, account, date and amount are the new shared controls (React Aria Select/Combobox, segmented date on desktop, money field that formats on leaving). Saving adds the row with the right amount, and account balances update as before, including for a Private account and a Cash account.
result: issue
reported: "on mobile, i like the drawer that opens when accounts is pressed. when category is pressed, another modal opens shifted to the right and the keyboard opens. it is quite busy and overloaded. can category is pressed, it should hage a similar subtle drawer open as accounts with the option to search if needed (without automatic keyboard)"
severity: minor
screenshots: [~/.local/state/herdr-core/default/files/t4x/photo-121218.jpg, ~/.local/state/herdr-core/default/files/t4x/photo-121222.jpg]

### 2. Bulk edit, bulk delete and split
expected: Select several register rows; Bulk edit (category, payee, date etc.) uses the shared controls and saves the same result as before; Bulk delete removes them. Splitting a transaction uses the shared amount and category fields; the parent keeps the total and the parts add up.
result: issue
reported: "I should be able to select individual transactions in addition. I do not want an edit modal as is currently present, I should be able to just right click after selecting and edit them with the same options that way"
severity: major
screenshots: [~/.local/state/herdr-core/default/files/t4x/Deskeen_2026-11-21_at_14.03.05_2x.jpg]

### 3. Transfer suggestion and pick-to-share checkboxes
expected: The transfer-suggestion review and the pick-to-share list use the shared Checkbox. Ticking a row (or its label) toggles it once; linking/sharing works as before.
result: pass

### 4. Inline transaction form row
expected: Adding/editing a transaction in the register's inline row uses the shared controls and saves the same values as before (payee, category, date, amount, memo).
result: pass

### 5. Transaction detail panel
expected: In the detail panel, picking a date saves straight away (no extra Save). Notes is a multi-line text area. On a phone (390 px) the payee field is 44 px tall. Pressing Escape twice in the payee field keeps the payee you had.
result: pass

### 6. Receipt editor
expected: The receipt editor's date, category, payee, item text and amounts are the shared controls; item rows show "Uncategorised" when unset. While saving is paused, every button that writes is disabled with the paused hint.
result: blocked
blocked_by: server
reason: "I can't edit receipts in Demo version." (receipts are excluded from the demo by design: server/src/browser/app.ts:114-117; needs a real server)

### 7. Receipt reader settings
expected: Receipt settings use the shared Checkbox, Select, Combobox and Input. The local model can be picked and unset again, and is saved only when one is picked. The photo input still opens the native file/camera picker.
result: pass

### 8. Goals and investments dialogs
expected: Goal form: Progress source is the category picker with "Manual tracking". Goal status: Move to category picker, "Replaced by (optional)" combobox; a bad amount like 12.5.0 is marked when you leave the field. Investment dialogs: dates are date pickers (required ones marked, Add purchase disabled until Bought on is set), Security is a filterable combobox, parcels are radio buttons.
result: pass

### 9. Cash runway (forecast)
expected: Runway percent and growth fields don't clamp: typing 501 in Variable spending % shows an error and blocks Save instead of turning into 500. Typing abc in Base spending per day shows "That isn't an amount. Type it like 12.50 or 12,50." Dates, lists and saved scenarios are the shared controls.
result: pass

### 10. Long-term forecast look
expected: The long-term forecast page, event editor and panels look right with the moved controls: labels are the shared 14 px label, and Select/Combobox triggers sit cleanly. Recurring event Last year accepts blank/1900–2300 and marks 1800, 2301 or 2025.5.
result: pass

### 11. Reports and month grid
expected: Report builder Group by is the shared Select; account and category-tree rows are shared checkboxes; trend category picker disables further picks when full. In a month picker, Next year is disabled at the last allowed year (no empty year to step into).
result: pass

### 12. Files page and file details
expected: Files page: search box with a clear (×) button, Kind select with "Any kind" first, From/To date pickers that bound each other. File details dialog: date picker, Description text area, and link target is the category picker (category links) or a combobox (accounts/goals/assets). Adding files still opens the native file dialog.
result: pass

### 13. CSV/CAMT import wizard
expected: Rows above the header is a text field taking 0 up to min(1000, rows − 1); outside that it shows "Enter a whole number from 0 to {max}." and Preview stays disabled. Separator, Encoding, Dates, Amounts, Statement and column roles are shared Selects (native on phones). Importing gives the same rows, with no duplicates on re-import.
result: pass

### 14. YNAB import and category mapping
expected: YNAB import: Date format and Amount format are Selects; each account's target is a combobox with "Create a new account" first. Category mapping: each target is the category picker offering Uncategorised, Create "{name}" as new, then categories; the group combobox shows under it when creating. The table has two columns and the category list isn't cut off. Import results are as before.
result: pass

### 15. G2 and G3 pull requests landed
expected: G2 (#278) and G3 (#279) are merged into redesign with green CI (checked 21 Nov: both MERGED; #279 has 16 success, 2 skipped, 1 pending check). Confirm you are happy with them as merged.
result: pass

### 16. numberText parsers (readWholeNumber, readDecimal) and D-14 numeric range message builders in fieldMessages.ts
expected: numberText parsers (readWholeNumber, readDecimal) and D-14 numeric range message builders in fieldMessages.ts
result: pass
source: automated
coverage_id: 03-02 D1

### 17. Shared bounded NumberField built from Field and Input with draft preservation and AmountFields validity reporting
expected: Shared bounded NumberField built from Field and Input with draft preservation and AmountFields validity reporting
result: pass
source: automated
coverage_id: 03-02 D2

### 18. CurrencyInput extended with forwardRef, fieldHeights (44 px on phones), opt-in expression parsing (readMoneyText), onTextChange, commitOnBlur and pass-through attributes
expected: CurrencyInput extended with forwardRef, fieldHeights (44 px on phones), opt-in expression parsing (readMoneyText), onTextChange, commitOnBlur and pass-through attributes
result: pass
source: automated
coverage_id: 03-02 D3

### 19. Number field and Money field gallery specimens and Linux baselines at 1280 and 390 px in light and dark themes
expected: Number field and Money field gallery specimens and Linux baselines at 1280 and 390 px in light and dark themes
result: pass
source: automated
coverage_id: 03-03 D1

### 20. Mounted React 19 Playwright interaction coverage for NumberField and CurrencyInput, replacing hookTestHarness.ts (03-02 WR-03)
expected: Mounted React 19 Playwright interaction coverage for NumberField and CurrencyInput, replacing hookTestHarness.ts (03-02 WR-03)
result: pass
source: automated
coverage_id: 03-03 D2

### 21. Phase 2 review fixes closed: IN-04 (local gallery theme toggle), R2-IN-02 (unique non-empty offline category ids), IN-01 (picker classes in fieldClasses.ts), R2-IN-03 (non-vacuous Select error absence assertion)
expected: Phase 2 review fixes closed: IN-04 (local gallery theme toggle), R2-IN-02 (unique non-empty offline category ids), IN-01 (picker classes in fieldClasses.ts), R2-IN-03 (non-vacuous Select error absence assertion)
result: pass
source: automated
coverage_id: 03-03 D3

### 22. MonthRangePicker short month display on phones ('MonthRangePicker phone: short' owner answer) with unclipped 390 px check and updated 390 px baselines
expected: MonthRangePicker short month display on phones ('MonthRangePicker phone: short' owner answer) with unclipped 390 px check and updated 390 px baselines
result: pass
source: automated
coverage_id: 03-03 D4

### 23. Controls gallery stays absent from the built production app
expected: Controls gallery stays absent from the built production app
result: pass
source: automated
coverage_id: 03-03 D5

### 24. MerchantSelect rebuilt on shared Combobox with transactionCount/name sort, PayeeIcon, blur clearing, and paused-saving footer
expected: MerchantSelect rebuilt on shared Combobox with transactionCount/name sort, PayeeIcon, blur clearing, and paused-saving footer
result: pass
source: automated
coverage_id: 03-04 D1

### 25. CategoryPicker extraItem, hint, allowCreate, includeHidden, and useCanSave gating; CategorySelectButton label/allowNone/noneLabel/groups forwarding
expected: CategoryPicker extraItem, hint, allowCreate, includeHidden, and useCanSave gating; CategorySelectButton label/allowNone/noneLabel/groups forwarding
result: pass
source: automated
coverage_id: 03-04 D2

### 26. CurrencySelect on shared Select (with aria-describedby, standalone w-* check, native on phones) and CurrencyDifference on CategorySelectButton/CategoryPicker (D-15 parity)
expected: CurrencySelect on shared Select (with aria-describedby, standalone w-* check, native on phones) and CurrencyDifference on CategorySelectButton/CategoryPicker (D-15 parity)
result: pass
source: automated
coverage_id: 03-04 D3

### 27. AccountTypeSelect, AddAccountModal, EditAccountModal, and DeleteAccountModal migrated to shared Select, Field/Label+Input, and Checkbox with EditAccountModal logo file input kept native (D-17), zero raw non-file controls, and accounts/assign-pools/cleanup/currencies/first-run/switchers/accounts-access specs passing
expected: AccountTypeSelect, AddAccountModal, EditAccountModal, and DeleteAccountModal migrated to shared Select, Field/Label+Input, and Checkbox with EditAccountModal logo file input kept native (D-17), zero raw non-file controls, and accounts/assign-pools/cleanup/currencies/first-run/switchers/accounts-access specs passing
result: pass
source: automated
coverage_id: 03-05 D1

### 28. ReconcilePage select-all and per-row cleared checkboxes migrated to shared Checkbox with indeterminate state and label-only click stopPropagation (T-03-07), verified by single-toggle e2e guard in financial-integrity.spec.ts (baseline run on old page passed 5/5; post-migration run passed 19/19 with accounts.spec.ts)
expected: ReconcilePage select-all and per-row cleared checkboxes migrated to shared Checkbox with indeterminate state and label-only click stopPropagation (T-03-07), verified by single-toggle e2e guard in financial-integrity.spec.ts (baseline run on old page passed 5/5; post-migration run passed 19/19 with accounts.spec.ts)
result: pass
source: automated
coverage_id: 03-05 D2

### 29. Payees page (search, phone & desktop select-all/row checkboxes, phone & desktop inline rename) and merge dialog (card-row RadioGroup) use only shared controls, with 0 raw non-file inputs
expected: Payees page (search, phone & desktop select-all/row checkboxes, phone & desktop inline rename) and merge dialog (card-row RadioGroup) use only shared controls, with 0 raw non-file inputs
result: pass
source: automated
coverage_id: 03-06 D1

### 30. Rules page search box uses shared Input; role=switch button unchanged (no audit row)
expected: Rules page search box uses shared Input; role=switch button unchanged (no audit row)
result: pass
source: automated
coverage_id: 03-06 D2

### 31. ApplyRulesModal select-all and row checkboxes use shared Checkbox with indeterminate state, padding clicks still toggle the row, and Apply respects useCanSave / SavingPausedHint
expected: ApplyRulesModal select-all and row checkboxes use shared Checkbox with indeterminate state, padding clicks still toggle the row, and Apply respects useCanSave / SavingPausedHint
result: pass
source: automated
coverage_id: 03-06 D3

### 32. Split percentage in `RuleEditorModal.tsx` converted from raw `type='number'` to shared `NumberField` (`Split percentage`, `0..100` decimal, `%` suffix, `sm`, `'Enter a percentage from 0% to 100%.'`, Save gated via `AmountFields`) with stable split-row keys (`WR-01`), verified test-first
expected: Split percentage in `RuleEditorModal.tsx` converted from raw `type='number'` to shared `NumberField` (`Split percentage`, `0..100` decimal, `%` suffix, `sm`, `'Enter a percentage from 0% to 100%.'`, Save gated via `AmountFields`) with stable split-row keys (`WR-01`), verified test-first
result: pass
source: automated
coverage_id: 03-07 D1

### 33. All fixed lists, user-grown lists, condition dates (`DatePicker` `fieldSize='sm'` + `hideLabel`), tag-list field wrapper + borderless `Input`, notes inputs, apply checkbox, `CurrencyInput` callers, and `OptionPicker` (single-value delegation with `'(deleted)'` + multi-value shared checklist) migrated onto shared controls with all 5 UI-SPEC accessible names wired and tested
expected: All fixed lists, user-grown lists, condition dates (`DatePicker` `fieldSize='sm'` + `hideLabel`), tag-list field wrapper + borderless `Input`, notes inputs, apply checkbox, `CurrencyInput` callers, and `OptionPicker` (single-value delegation with `'(deleted)'` + multi-value shared checklist) migrated onto shared controls with all 5 UI-SPEC accessible names wired and tested
result: pass
source: automated
coverage_id: 03-07 D2

### 34. RecurringFormModal migrated to shared Select, Combobox, DatePicker (required Start date + optional End date with DatePicker optionalHint keeping exact name "End date"), Field/Label+Input, Checkbox, and NumberField (0-14, keeping Advanced open and Save disabled while invalid) inside AmountFields, with unit tests and updated recurring, accessibility, and server-mode selectors
expected: RecurringFormModal migrated to shared Select, Combobox, DatePicker (required Start date + optional End date with DatePicker optionalHint keeping exact name "End date"), Field/Label+Input, Checkbox, and NumberField (0-14, keeping Advanced open and Save disabled while invalid) inside AmountFields, with unit tests and updated recurring, accessibility, and server-mode selectors
result: pass
source: automated
coverage_id: 03-08 D1

### 35. UpcomingLengthModal, AllTab, DiscoverSchedulesModal (with capture-phase Shift+click range selection), and OccurrenceMatchModal migrated to shared Select, NumberField (>= 1), Input, and Checkbox, with UI-SPEC accessible names, failing-first D-14 test, and Playwright coverage
expected: UpcomingLengthModal, AllTab, DiscoverSchedulesModal (with capture-phase Shift+click range selection), and OccurrenceMatchModal migrated to shared Select, NumberField (>= 1), Input, and Checkbox, with UI-SPEC accessible names, failing-first D-14 test, and Playwright coverage
result: pass
source: automated
coverage_id: 03-08 D2

### 36. Budget table assigned cell on shared Input keeping every BUD-05 sum, keyboard, and h-14 row-height rule intact; phone BudgetAmountSheet on CurrencyInput (expression, allowNegative, initial-mount autoFocus) and shared Checkbox; CardPayments both money fields on CurrencyInput (allowNegative, negative refusal, Enter-without-blur validation)
expected: Budget table assigned cell on shared Input keeping every BUD-05 sum, keyboard, and h-14 row-height rule intact; phone BudgetAmountSheet on CurrencyInput (expression, allowNegative, initial-mount autoFocus) and shared Checkbox; CardPayments both money fields on CurrencyInput (allowNegative, negative refusal, Enter-without-blur validation)
result: pass
source: automated
coverage_id: 03-09 D1

### 37. Budget search Input, row Checkbox (inside pl-10, h-14 preserved), AnnualBudget Select (native on phones), AutoAssign RadioGroup/Radio and Select (Months to average + How to apply covered by e2e), FundingRows Checkbox, and NoteField Field + Textarea (isReadOnly when saving paused) on shared controls with zero raw controls remaining
expected: Budget search Input, row Checkbox (inside pl-10, h-14 preserved), AnnualBudget Select (native on phones), AutoAssign RadioGroup/Radio and Select (Months to average + How to apply covered by e2e), FundingRows Checkbox, and NoteField Field + Textarea (isReadOnly when saving paused) on shared controls with zero raw controls remaining
result: pass
source: automated
coverage_id: 03-09 D2

### 38. Move money From/To on CategorySelectButton with '($X available)' hints and pinned 'Ready to assign'; amount on CurrencyInput
expected: Move money From/To on CategorySelectButton with '($X available)' hints and pinned 'Ready to assign'; amount on CurrencyInput
result: pass
source: automated
coverage_id: 03-10 D1

### 39. Category target editor on shared Select, CurrencyInput, DatePicker and a 1-to-60 NumberField cycle (D-14)
expected: Category target editor on shared Select, CurrencyInput, DatePicker and a 1-to-60 NumberField cycle (D-14)
result: pass
source: automated
coverage_id: 03-10 D2

### 40. Payday plan editor, funding panel and plan list on shared controls with a 0-to-100 NumberField percent (D-14)
expected: Payday plan editor, funding panel and plan list on shared controls with a 0-to-100 NumberField percent (D-14)
result: pass
source: automated
coverage_id: 03-10 D3

### 41. CategoryManager inline rename, new group, and add category inputs migrated to shared Input at sm size (keeping autoFocus, select-on-focus, Enter, Escape, blur) and EditCategoryModal migrated to shared Label+Input (accessible name 'Category name' preserved), Combobox, card-row RadioGroup, Checkbox, and useCanSave/SavingPausedHint
expected: CategoryManager inline rename, new group, and add category inputs migrated to shared Input at sm size (keeping autoFocus, select-on-focus, Enter, Escape, blur) and EditCategoryModal migrated to shared Label+Input (accessible name 'Category name' preserved), Combobox, card-row RadioGroup, Checkbox, and useCanSave/SavingPausedHint
result: pass
source: automated
coverage_id: 03-11 D1

### 42. DeleteCategoryModal Merge into migrated to CategorySelectButton over CategoryPicker filtered to same income/expense kind with source category excluded, 'Select a category…' placeholder, allowNone=false, allowCreate=false, includeHidden, and listbox-opened T-03-17 assertions in settings.spec.ts
expected: DeleteCategoryModal Merge into migrated to CategorySelectButton over CategoryPicker filtered to same income/expense kind with source category excluded, 'Select a category…' placeholder, allowNone=false, allowCreate=false, includeHidden, and listbox-opened T-03-17 assertions in settings.spec.ts
result: pass
source: automated
coverage_id: 03-11 D2

### 43. WholeNumberField and RateField on NumberField, names, props, messages and Use default kept
expected: WholeNumberField and RateField on NumberField, names, props, messages and Use default kept
result: pass
source: automated
coverage_id: 03-19 D1

### 44. Recurring event Last year: blank, 1900 and 2300 accepted; 1800, 2301, 2025.5 marked and block Create
expected: Recurring event Last year: blank, 1900 and 2300 accepted; 1800, 2301, 2025.5 marked and block Create
result: pass
source: automated
coverage_id: 03-19 D2

### 45. Long-term page, editor and panels on shared controls; gate prints 0
expected: Long-term page, editor and panels on shared controls; gate prints 0
result: pass
source: automated
coverage_id: 03-19 D3

### 46. Register filters on the shared Input, Checkbox, CurrencyInput and DatePicker, with the same URL parameters
expected: Register filters on the shared Input, Checkbox, CurrencyInput and DatePicker, with the same URL parameters
result: pass
source: automated
coverage_id: 03-24 D1

### 47. Transaction marks (new tag box, Reviewed, Hide from reports) on the shared Input and Checkbox
expected: Transaction marks (new tag box, Reviewed, Hide from reports) on the shared Input and Checkbox
result: pass
source: automated
coverage_id: 03-24 D2

### 48. On the iPhone, Add transaction's Category list opens flush with the field and without the keyboard
expected: In Add transaction on the iPhone, tapping Category opens the list level with the field, like the Account list, with no keyboard; tapping the search field brings up the keyboard and search works. Other category pickers (the details sheet, for example) still open with search focused.
result: pass
source: 03-VERIFICATION.md

### 49. On the iPhone, Add transaction's Date field fits the sheet
expected: The Date field ends inside the sheet, level with Amount, and still opens the iPhone date wheel. This is the gate for the Date part of G-03-1, because no test engine reproduces iOS Safari's date control.
result: issue
reported: "Pass, but the spacing of the date text within the input field appears incorrect."
severity: cosmetic
note: "Fit and date wheel pass: the field ends inside the sheet level with Amount and opens the iOS calendar. Only the text placement is off."
screenshots: [~/Downloads/Allotment.png, ~/Downloads/Allotment-2.png]
source: 03-VERIFICATION.md

### 50. Re-run of test 1 (Add transaction) after the gap fixes
expected: As test 1, on desktop and phone, including a Private and a Cash account, with the calmer phone category list.
result: pass
source: 03-VERIFICATION.md

### 51. Re-run of test 2 (register selection and right-click edits) after the gap fixes
expected: Select, then tick rows, Shift+click a range, Cmd+click, Select all and untick; right-click the selection to change category, payee, notes, tags and reports with Undo, review, share and Delete N (typing delete). Splitting a transaction still works. Check the running build is up.178 or later first.
result: issue
reported: "instead of adding the checkbox to the left and moving the content in the row to the right; a selected row should change colour to indicate it has been selected so the content does not move when selected. No checkbox should show up. Otherwise, the right click options pass."
severity: minor
note: "Right-click menu actions pass (owner, up.179 demo). Only the selection affordance is at issue."
screenshots: [~/.local/state/herdr-core/default/files/t4x/1795311260466-Screenshot 2026-11-22 at 12.34.18 PM.png]
source: 03-VERIFICATION.md

## Summary

total: 51
passed: 46
issues: 4
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-03-1
  truth: "On phones, the Add transaction Category field opens a subtle bottom drawer like the Account list, with search available but no automatic keyboard"
  status: resolved
  resolved_by: 03-29-PLAN
  resolved_at: 2026-11-22
  reason: "User reported: on mobile, i like the drawer that opens when accounts is pressed. when category is pressed, another modal opens shifted to the right and the keyboard opens. it is quite busy and overloaded. can category is pressed, it should hage a similar subtle drawer open as accounts with the option to search if needed (without automatic keyboard)"
  severity: minor
  test: 1
  observed: "Screenshot photo-121218: category picker opens as a popover offset to the right with the search field focused (keyboard up). Screenshot photo-121222: the Date field also runs past the dialog's right edge at phone width (not reported by the user, seen in the screenshot)."
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

- gap_id: G-03-2
  truth: "The register lets the owner select individual transactions (as well as Select all), then right-click the selection to edit category, payee, notes, tags and visibility in place, without the Edit N transactions modal"
  status: resolved
  resolved_by: 03-31-PLAN
  resolved_at: 2026-11-22
  reason: "User reported: I should be able to select individual transactions in addition. I do not want an edit modal as is currently present, I should be able to just right click after selecting and edit them with the same options that way"
  severity: major
  test: 2
  observed: "Screenshot (desktop Safari, wide window): the Edit 44 transactions dialog's Category, Notes, Reports and Review fields render with the native macOS select look (up/down chevrons), although BulkEditModal.tsx uses the shared Select. Check why useIsPhone takes the native branch there. Bulk delete and split were not tested in this pass."
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

- gap_id: G-03-3
  truth: "On the iPhone, the Add transaction Date field's text sits vertically centred with the same inset as the other fields (Amount, Payee, Account)"
  status: failed
  reason: "User reported: Pass, but the spacing of the date text within the input field appears incorrect."
  severity: cosmetic
  test: 49
  observed: "Screenshot Allotment.png (iPhone Safari, 22 Nov): '26 Nov 2026' sits at the top of the Date field instead of centred like the Amount and Payee text; the field's height and width match the others. iOS calendar popover opens correctly (Allotment-2.png)."
  root_cause: "On phones DatePicker renders a native <input type=date> with appearance-none and only min-h-11 (DatePicker.tsx:425). With the native look removed, iOS Safari lays the ::-webkit-date-and-time-value box at the top of the input instead of centring it the way a text input's line is, so the date sits high while Amount and Payee are centred."
  artifacts:
    - path: "client/src/components/ui/DatePicker.tsx"
      issue: "native phone date input: min-h-11 + appearance-none with no fixed height or line-height, so the value box is top-aligned on iOS"
    - path: "client/src/components/ui/DatePicker.test.ts"
      issue: "pins the class string (text-left) but nothing about vertical alignment"
  missing:
    - "Give the native date input a fixed 44px height and centre its value (e.g. h-11 with ::-webkit-date-and-time-value line-height/min-height set to the inner height, or matching vertical padding), keeping text-left, min-w-0 and the fit fix from G-03-1"
    - "Owner check on the iPhone (no test engine reproduces iOS Safari's date control); update the class-string test"
  debug_session: ""

- gap_id: G-03-4
  truth: "Selecting register rows shows no checkboxes: a selected row changes colour, and the row's content does not move when selection starts or a row is selected"
  status: failed
  reason: "User reported: instead of adding the checkbox to the left and moving the content in the row to the right; a selected row should change colour to indicate it has been selected so the content does not move when selected. No checkbox should show up. Otherwise, the right click options pass."
  severity: minor
  test: 51
  observed: "Screenshot 12.34.18 PM (desktop, up.179 demo): Select mode adds a checkbox column at the left of every row and shifts payee, category, account and amount right; the selected Nimbus Mobile row is only lightly tinted."
  root_cause: "Select mode wraps every register row in a checkbox column (TransactionTable.tsx withSelect, ~395-416): when `selected` is non-null each row gets a left cell with a shared Checkbox, which pushes payee, category, account and amount right. A plain click on a desktop row still opens details (only Shift/Cmd clicks select), and the bulk-selected state has no strong colour of its own (TransactionRow's bg-brand-50 + border-l-2 is the open-detail highlight, and the border itself shifts content 2px)."
  artifacts:
    - path: "client/src/components/transactions/TransactionTable.tsx"
      issue: "withSelect adds a checkbox column in select mode; plain click doesn't toggle on desktop"
    - path: "client/src/components/transactions/TransactionRow.tsx"
      issue: "no distinct selected-for-action colour; border-l-2 highlight shifts content"
    - path: "client/src/components/transactions/TransactionCard.tsx"
      issue: "phone card selection state; confirm no checkbox and same colour treatment"
    - path: "e2e/tests/transactions.spec.ts, e2e/tests/household.spec.ts, e2e/tests/phone/register-selection-phone.spec.ts"
      issue: "select rows by their 'Select …' checkboxes"
  missing:
    - "In select mode: no checkbox; a click (desktop) or tap (phone) on a row toggles it, Shift+click selects a range, Cmd/Ctrl+click toggles; a selected row gets a clear selected background (token colour) with no layout change (no added column or border width)"
    - "Keep it operable without a pointer: each row exposes its selected state (aria-selected in a listbox/grid pattern, or aria-pressed) with an accessible name, and Space toggles it; the right-click menu, Select all, untick and the count are unchanged"
    - "Update the three e2e specs to select by row state instead of checkboxes, with the reason in the PR"
  debug_session: ""
