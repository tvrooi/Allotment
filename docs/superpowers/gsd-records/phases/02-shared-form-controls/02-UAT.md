---
status: testing
phase: 02-shared-form-controls
source: [02-VERIFICATION.md]
started: 2026-11-18T15:40:48Z
updated: 2026-11-19T01:35:00Z
---

## Current Test

number: 1
name: Screen-reader pass over the controls gallery
expected: |
  With VoiceOver on /dev/controls (npm run dev), each control announces its name, role, state and value; help and error lines are read as descriptions; listbox options announce position and selection.
awaiting: user response

## Tests

### 1. Screen-reader pass over the controls gallery
expected: With VoiceOver on /dev/controls, each control announces its name, role, state and value; help and error lines are read as descriptions; listbox options announce position and selection.
result: [pending]

### 2. Native pickers on a real iPhone
expected: At 390 px, tapping Select, DatePicker, MonthPicker and MonthRangePicker From/To opens the iOS wheel or calendar, and the page does not zoom.
result: [pending]

### 3. MonthRangePicker phone clip (owner decision)
expected: Owner chooses between stacking From and To on phones and accepting the "November 202" clip; also note whether Safari clips.
result: pass
source: owner answer 19 Nov 2026, "Change dates to shorthand Nov, Sep, Oct etc." = MonthRangePicker phone: short (short month names, so "Nov 2026" shows whole; done in 03-03); recorded in docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md

### 4. Welcome page after the Switch restyle (owner check)
expected: On /welcome at 390 px and desktop, the owner accepts the shared toggle label style (14 px primary text, wrapped rows ~20 px taller) or asks Phase 3 to restore text-secondary.
result: pass
source: owner answer 19 Nov 2026, "accept" = Welcome switch rows: accept (the shared toggle label style stands; nothing restored in Phase 4); recorded in docs/superpowers/gsd-records/phases/03-screens-on-shared-controls/03-01-SUMMARY.md

### 5. CI on the fixed head of #277
expected: Every CI job is green on da59f6d7 (pushed 19 Nov), including the gallery pixel tests against the remade baselines, lint within its cap, and combobox.spec.ts:134.
result: pass
source: CI on da59f6d7, all jobs green (client, lint, server, electron, e2e 1-4 incl. gallery pixels, builds, homeassistant), checked 19 Nov by the orchestrator

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
