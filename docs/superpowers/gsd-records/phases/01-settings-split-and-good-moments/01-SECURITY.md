---
phase: "1"
slug: "settings-split-and-good-moments"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Code is on `wave-f` in `/Users/tristanvanrooyen/wt-f` (PR #273, head `575c3ea`); every check below ran there
> against `origin/redesign..wave-f`, not in the planning checkout.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| URL → client router | `?provider=` on `/accounts/connections` and `?tab=` (with other parameters) on `/settings` are typed, linked or stored in palette recents | Untrusted query strings choosing what a page shows or where a redirect lands |
| Bank feed label → link | A feed's display label chooses the link's provider | Client-built label, untrusted as a lookup key |
| localStorage → client | `flybudget:palette-recents` and `flybudget:goals-bloomed` are read back | Device-writable JSON; opaque ids and in-app paths only |
| Safe mode → screen | Someone else may be looking | Hidden amounts must not appear in any form |
| Server summary → hero | `BudgetSummary.resolved` decides praise; absent while loading or failed | Server truth vs client inference |
| Server error text → client dialog | The 409 body from account deletion is shown as written | Account and bank names (unchanged) |
| Stored guide progress → guides data | Progress keyed by guide id and version | Guide ids must stay stable |
| Git remote / work tree → GitHub | Push publishes branch, CI, Vercel preview, reviewer | Repository content; `.planning`, `.ui-evidence`, `.omc` must not leave |
| Screenshots and PR text → readers | Images and PR body read off-machine | Must come from demo/disposable budgets only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | `?provider=` in `pages/AccountConnections.tsx` | low | mitigate | `parseProvider` (`utils/movedSections.ts`) exact allowlist, falls back to Up; unit tests cover `UP`, `../x`, `constructor` | closed |
| T-01-02 | Spoofing | `?tab=connections` redirect target | low | mitigate | Constant `CONNECTED_BANKS_PATH` behind `Object.hasOwn` in `utils/movedSections.ts` | closed |
| T-01-03 | Information disclosure | Bank token entry in the moved panel | low | accept | Panel moved unchanged; see accepted risks | closed |
| T-01-04 | Tampering | Merge of `origin/redesign` into `wave-f` | medium | mitigate | No merge was needed (01-01); `git ls-files .planning` on `wave-f` is empty | closed |
| T-01-05 | Tampering | `bankFeedLink` label lookup | low | mitigate | Fixed `FEED_PROVIDERS` map with `Object.hasOwn`; unknown label gives the plain path | closed |
| T-01-06 | Spoofing | Pill opening the wrong bank (Codex P1) | medium | mitigate | `UpSyncBadge.tsx` links via `bankFeedLink(feed.provider)`; labels pinned in unit tests; browser test opens the named provider | closed |
| T-01-07 | Spoofing | Open redirect through `?tab=` in `pages/Settings.tsx` | medium | mitigate | Destinations only from moved-tabs constants via `Object.hasOwn`; `constructor`/`toString` refused in unit test | closed |
| T-01-08 | Tampering | Other query parameters across the redirect | low | mitigate | Copied through `URLSearchParams` into the query string only | closed |
| T-01-09 | Denial of service | Redirect loop | low | mitigate | Targets are not `/settings` routes; `e2e/tests/settings.spec.ts` loads both old links | closed |
| T-01-10 | Tampering | Palette recents holding an old or altered path | low | accept | Unchanged `isRecent` validation and router-only navigation; see accepted risks | closed |
| T-01-11 | Spoofing | Palette entry opening a different page | low | mitigate | `PALETTE_PAGES` paths from the constants module; `command-palette.spec.ts` opens each and checks the URL | closed |
| T-01-12 | Information disclosure | Plant under Safe mode | medium | mitigate | `SafeModeNotice` replaces the list; `safe-mode.spec.ts` asserts `goal-plant` count 0 | closed |
| T-01-13 | Tampering | Malformed `flybudget:goals-bloomed` | low | mitigate | `goals/growth.ts` parses in try/catch, keeps strings, caps at 200 | closed |
| T-01-14 | Information disclosure | Goal ids stored on device | low | accept | Opaque ids only; see accepted risks | closed |
| T-01-15 | Spoofing | False all-clear in `readyToAssignStatus` | medium | mitigate | Praise requires a present summary with `resolved`; absent summary gives no label; unit tests cover absent and each caveat | closed |
| T-01-16 | Information disclosure | $0 labels under Safe mode | low | mitigate | Labels are fixed sentences (`CAVEAT` in `utils/fundingStatus.ts`); only a cause count appears; figure masked by `formatCurrency` | closed |
| T-01-17 | Tampering | Drifting second copy of cause checks | low | mitigate | `unresolvedCauses` is the single source; `unresolvedReason` and the caveat label both call it (`fundingStatus.ts` lines 57, 133) | closed |
| T-01-18 | Tampering | Guide and tip ids | medium | mitigate | No `id:` line changed under `client/src/guides`; `utils/guides.test.ts` passes | closed |
| T-01-19 | Information disclosure | Docs and changelog | low | mitigate | Added doc lines contain no hostname, token or bearer value (diff grep) | closed |
| T-01-20 | Repudiation | Gate passing via a weakened test | medium | mitigate | No added `test.skip`, `.fixme`, `test.only`, `waitForTimeout` or `E2E_SKIP_BUILD` in `e2e/tests` diff | closed |
| T-01-21 | Information disclosure | Screenshots and PR body | medium | mitigate | `.ui-evidence/` is git-ignored (`git check-ignore`); screenshots from demo/disposable budgets (01-08) | closed |
| T-01-22 | Tampering | Pushing content that should not leave the machine | medium | mitigate | `git ls-files .planning .ui-evidence .omc` empty on `wave-f`; push was a plain fast-forward (01-08) | closed |
| T-01-23 | Elevation of privilege | Releasing or merging without the owner | high | mitigate | PR #273 open, #244 and #241 open, no local or remote tag `v0.2.0-up.174` (checked 2026-11-15) | closed |
| T-01-24 | Repudiation | PR body claims not matching the diff | low | mitigate | Body results copied from plan 07's recorded Node 24 run; changed expectations listed (01-08) | closed |
| T-01-25 | Elevation of privilege | Server change beyond message text | medium | mitigate | Exactly two server files changed (`accountDeletion.ts` and its test); nothing else under `server/src/routes`, `auth` or `browser` | closed |
| T-01-26 | Information disclosure | The 409 message text | low | accept | Same names as before; see accepted risks | closed |
| T-01-SC | Tampering | npm installs | high | mitigate | No dependency line changed in any `package.json` (version strings only); every `.npmrc` unchanged | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-03 | The bank panel moved without change; tokens go only to the existing bank routes and stay encrypted server side | Plan 01-01 threat model (owner-approved plans, 14 Nov 2026) | 2026-11-14 |
| AR-01-02 | T-01-10 | Recents are in-app router paths validated by the existing `isRecent`; an old `?tab=` path resolves through the plan 03 redirect | Plan 01-04 threat model | 2026-11-14 |
| AR-01-03 | T-01-14 | `flybudget:goals-bloomed` holds opaque goal ids only, as #273 shipped it, cleared with site data | Plan 01-05 threat model | 2026-11-14 |
| AR-01-04 | T-01-26 | The 409 message carries the same account and bank names as before; only the destination it names changed | Plan 01-04 threat model | 2026-11-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 27 | 27 | 0 | secure-phase orchestrator (L1 grep-depth short-circuit; register authored at plan time; checks run in wt-f against origin/redesign..wave-f) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15
