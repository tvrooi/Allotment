# Security Policy

## Supported Versions

Allotment is a local-first budgeting app (one budget per person; an optional multi-user mode runs
one separate budget per person) under active development. Security fixes land on `main` and ship in
the next release; older releases are not patched.

| Version                 | Supported          |
| ----------------------- | ------------------ |
| Latest release / `main` | :white_check_mark: |
| Older releases          | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub: go to the
[Security tab](https://github.com/tvrooi/Allotment/security) →
**Report a vulnerability**. Please include:

- what the issue is and where (file, endpoint, or screen)
- steps to reproduce or a proof of concept
- the impact you think it has
- your OS and whether you're using the web app or the desktop (Electron) app

This is a personal community fork. Reports are handled on a best-effort basis; there is no
promised response time. Coordinate upstream vulnerabilities with the original project when appropriate.

## Scope

Allotment runs on your own machine or your own server. See [How Allotment protects your
data](#how-allotment-protects-your-data) below for the full model.

Especially in scope:

- anything that lets a website, another user, or another process read or change
  Allotment data or bank-sync credentials
- ways to make the local API reachable from outside the machine
- vulnerabilities in the Electron desktop app
- in the self-hosted server (Docker or the Home Assistant app): getting past the password login,
  stealing or forging sessions, or reading data or credentials without logging in
- access tokens (read-only, categorise, organise) doing more than their scope allows, or the
  assistant endpoint (`/api/assistant/do`) applying a write that has no row in its policy table
- the multi-user gateway letting one person reach another person's budget
- the desktop app's remote-server connection trusting a page, certificate or origin it should not

Out of scope:

- attacks that require someone who already has full access to your user account
  or machine
- vulnerabilities in third-party services (Up, Plaid, SimpleFIN, Enable Banking, the receipt-reader
  model providers) themselves, which should be reported to them
- outdated dependencies with no demonstrated impact on Allotment (Dependabot
  already tracks these)

## How Allotment protects your data

Allotment is local-first: there is no Allotment-run server, account, telemetry, or
crash reporting. Your data never leaves your computer or your own server except when bank sync
talks to Up, Plaid, SimpleFIN or Enable Banking on your behalf, when you fetch exchange rates, and
when you choose a receipt reader that is not on your own network (see Network).

You can also host Allotment yourself with Docker or the Home Assistant app ("server mode"; see
[DESKTOP-SERVER.md](DESKTOP-SERVER.md), [homeassistant/DOCS.md](homeassistant/DOCS.md) and
[docs/START-HERE.md](docs/START-HERE.md)). Then the data lives on your server, and:

- a password protects every API route (scrypt hash; 10 failed attempts per 15
  minutes, then blocked). Setting the first password also needs a one-time setup
  code printed only in the server log, so whoever reaches a fresh server first
  (or a website using DNS rebinding) can't claim it
- behind HTTPS (`FLYBUDGET_TRUST_PROXY`), responses carry HSTS
- sessions are random 256-bit tokens, stored server-side only as SHA-256
  hashes, sent in an HttpOnly, SameSite=Strict cookie (Secure over HTTPS),
  expiring after 30 days; changing the password ends every other session.
  Settings → Server lists signed-in devices (by an opaque id that can't be used
  to sign in) so you can sign any of them out
- visitors who aren't signed in learn nothing about the server: `/api/health`
  only says it's up, and the version and security check (Settings → Server)
  need a session. The security check names the setting that fixes each
  warning, never a secret value
- the server refuses to start without a credential encryption key, supplied as
  a Docker secret (`FLYBUDGET_DATA_KEY_FILE`) rather than stored with the
  database
- the container runs as an unprivileged user; the example Compose file adds a
  read-only filesystem, drops all capabilities and sets `no-new-privileges`
- images are built in GitHub Actions for amd64 and arm64 without a shared build
  cache, base images are pinned by digest, npm registry signatures are verified
  during the build, each image has an SBOM and signed SLSA build provenance, and
  images are scanned for known vulnerabilities (Grype) weekly
  (`gh attestation verify oci://ghcr.io/tvrooi/flybudget:<version> -R tvrooi/Allotment`)
- read-only access tokens (for an AI assistant or another tool) are random, expire, can be revoked,
  and are stored only as SHA-256 hashes. A token reaches only an allowlist of side-effect-free
  reads, plus writes that each match a row of one policy table, are logged, and are refused
  otherwise (`docs/READ-ONLY-ACCESS.md`, `docs/ASSISTANT-ENDPOINTS.md`). Changing the password
  revokes them all

Run it behind an HTTPS reverse proxy before exposing it to the internet.

### What is stored, and where

| Data                               | Location (desktop app)                     | Protection                                                                                        |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Budget, accounts, transactions     | `budget.db` in the app's data folder       | Your OS user account (not encrypted by Allotment; see below)                                      |
| Up personal access token           | `budget.db`                                | AES-256-GCM, with a key protected by the OS (Windows DPAPI, macOS Keychain, Linux secret service) |
| Plaid secret and access tokens     | `budget.db`                                | Same as above                                                                                     |
| SimpleFIN access URL (credentials) | `budget.db`                                | Same as above                                                                                     |
| Enable Banking key and session     | `budget.db`                                | Same as above                                                                                     |
| Receipt reader API key (optional)  | `budget.db`                                | Same as above; write-only, never shown again, never in a backup                                   |
| Access tokens (read-only, etc.)    | `budget.db`                                | Only a SHA-256 hash is stored                                                                     |
| Uploaded files and receipts        | `budget.db` or the files folder            | Your OS user account; not encrypted by Allotment                                                  |
| Encryption key for the above       | `credentials.key` in the app's data folder | Encrypted by the OS; only usable by your user account on that machine                             |
| Display preferences                | Browser storage inside the app             | Not sensitive                                                                                     |

A copied or backed-up `budget.db` therefore does **not** give bank access. Bank credentials are
never sent to the app's own UI, logs, or backup exports.

### Network

- **Local API.** The embedded server listens only on `127.0.0.1`. It accepts
  requests only from the app's own window: other websites (including DNS
  rebinding and cross-site requests) are rejected, and in the desktop app every
  request needs a random per-launch secret held in an HttpOnly cookie, so other
  programs and users on the same machine can't read your data.
- **Outbound.** The external services contacted are Up (`api.up.com.au`), Plaid, your SimpleFIN
  bridge and Enable Banking when you connect them, the exchange-rate server chosen in Settings →
  Currencies, and, only if you choose one, the receipt reader's model provider (a server on your
  network, Anthropic or OpenAI). Bank and rate requests use HTTPS to public addresses only (checked at
  connection time, so DNS rebinding cannot bypass it), redirects are re-validated, and requests time
  out and have size limits. Fonts and all other assets are bundled with the app; nothing is loaded
  from other sites.
- **Content Security Policy.** The UI can only run code shipped with the app
  and can only talk to its own local server. No third-party scripts or frames
  are allowed, and the page is isolated from other origins (COOP/COEP).

### Bank connections

- **Up:** you create a personal access token at Up and paste it into Allotment; it is stored
  encrypted and never leaves the server except in requests to Up. Only settled AUD transactions are
  imported, and nothing is written back to Up. Delete the token at Up to revoke it fully.
- **Plaid:** you use your own Plaid API keys. You log in to your bank on
  Plaid's own page in your web browser (Plaid Hosted Link), never inside
  Allotment, which is how banks that use OAuth (Chase, Wells Fargo, and others)
  work in the desktop app. Disconnecting a bank revokes its
  access token at Plaid (`/item/remove`); if Plaid can't be reached, the
  connection is kept so you can retry.
- **SimpleFIN:** SimpleFIN has no revoke API. Disconnecting deletes Allotment's
  copy of the access URL; to revoke access completely, also remove the app in
  your [SimpleFIN Bridge](https://bridge.simplefin.org) account.
- Data from banks is treated as untrusted: it is validated, amounts are converted
  exactly, and exported CSV files are protected against formula injection.

### The desktop app

- Sandboxed renderer with no Node.js access, DevTools disabled in releases, all
  permission requests (camera, microphone, location, notifications) denied, and
  the window can't navigate away from the app. Links open in your browser only
  if they are `https://`.
- Electron fuses disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, and `--inspect`,
  and the app refuses to start if its files have been modified (asar integrity).
- Releases are built by GitHub Actions and signed with Sigstore, with SLSA build
  provenance. Verify a download with:
  `gh attestation verify Allotment-Windows-Setup.exe -R tvrooi/Allotment` (the same
  for the macOS and Linux files; each release also has `SHA256SUMS.txt`)

### Development and supply chain

- Every change runs CI (type checks, builds, lint, unit, property-based and browser tests, formatting);
  `main` requires CI to pass. Container images are scanned by Grype and the repository by OpenSSF
  Scorecard.
- npm install scripts are disabled in every package, CI verifies registry
  signatures, and Dependabot waits 7 days before adopting new releases
  (security fixes are not delayed). GitHub Actions are pinned to commit SHAs.
- Secret scanning with push protection is enabled on the repository.

### What you should do

Allotment can't protect against someone who controls your user account. To keep
your financial data safe:

- Use a strong OS login and turn on full-disk encryption (BitLocker on Windows,
  FileVault on macOS), since `budget.db` itself is not encrypted.
- Treat backup exports (`budget-backup-*.json`) and CSV exports as sensitive:
  they contain your full financial history (but no bank credentials).
- Only download Allotment from this repository's Releases page, and verify it
  with the command above.
- Keep your Plaid API keys private, and disconnect banks you no longer use.
- `npm run dev` is for development: it has no per-launch secret, and bank
  credentials are stored unencrypted. Use the desktop app for real accounts.

## Security review guidelines

Used by automatic PR review (Codex) and by people reviewing a security-relevant change. Apply them
together with "Review guidelines" in [AGENTS.md](AGENTS.md). A finding names the file and line, the
attacker (a website, another process, an unauthenticated visitor, a token of a given scope, a bank or
merchant string, another person on a multi-user server), the concrete request or input, and what they
gain. Rank **P0** secret or data exposure, authentication or scope bypass, remote code execution,
data loss; **P1** a missing guard that something else currently covers, an unvalidated input, a
weakened default; **P2** hardening and hygiene. Do not report theoretical issues with no reachable
path, outdated dependencies with no demonstrated impact, or anything in "Out of scope" above.

### How to check

- Trace each new or changed route from `server/src/index.ts` outward: which guards run before it
  (`hostGuard`, `originGuard`, `apiTokenGuard`, `requireSession`, rate limits), who can reach it
  (owner, each token scope, an anonymous visitor, the bank callback), and what it returns. Then do
  the same for the sibling path that does the same job (CSV import and backup restore versus sync;
  owner versus `/api/assistant/do`; desktop versus server mode versus the gateway).
- Read what is logged and returned, not only what is stored: error text, `/api/server/info`, the
  security check, the assistant log, exports and backups, and `console` output.
- Prefer a failing test as evidence. A security or policy change needs the allowed case and the nearest
  refusal (`assistantPolicy.test.ts`, `security.test.ts`, `accessTokens`/`assistantTools` route tests).

### Authentication, sessions and tokens

- Every `/api` route sits behind `requireSession` except `GET /api/health` (which answers exactly
  `{"status":"ok"}`), `/api/auth/*` (each such route checks the session itself) and the Enable Banking
  callback (GET only, authorised solely by its random single-use `state`, own rate limit). A new
  exception is P0 unless it is justified here and tested.
- Passwords use scrypt; sessions are 256-bit random values stored only as SHA-256 hashes, in an
  HttpOnly, SameSite=Strict cookie (Secure over HTTPS). Comparisons of secrets are constant-time.
  Login, setup and password change stay rate limited; retry logic never calls `/api/auth/*`. Changing
  the password must still end other sessions and revoke tokens.
- Access tokens never gain scope silently. Reads need an allowlist entry; every token write goes only
  through `/api/assistant/do`, matches one row of `ASSISTANT_ACTIONS` (`auth/assistantPolicy.ts`), and
  is logged, including refusals, without request bodies. The policy never allows a writing, settings,
  backup, auth, bank or token-management route, and never deletes, enables or reorders for a token.
  Check path matching is case-insensitive, trailing-slash safe, decoded once, and cannot be confused by
  `..`, `//`, encoded slashes or a doubled `/assistant/do/`. Check a body check uses `.strict()` or an
  allowed-keys test, so an extra field is refused. A change to a row needs the docs
  (`docs/READ-ONLY-ACCESS.md`, `docs/ASSISTANT-ENDPOINTS.md`) and the owner-approved exception list
  in AGENTS.md to match, and an owner approval is not implied by a PR author's wording.
- In multi-user mode the gateway signs requests to each budget (`FLYBUDGET_GATEWAY_SECRET`). One
  person's token, session, file, backup or log must never resolve to another person's budget. Check
  any lookup that is not scoped to the current person.

### Network and browser protections

- Keep `hostGuard`, `originGuard`, the desktop `apiTokenGuard`, the strict CSP and CORP/COOP/COEP.
  Loading anything from a new origin means a CSP change and is P1 until justified. Response headers
  set by `helmet` are not loosened, and nothing adds permissive CORS (`*`, reflected origin) or
  credentialed cross-origin access.
- Any request to a URL that came from outside the code (a bank, a token, a rate server, a receipt
  reader address, a redirect) goes through `safeFetch`: HTTPS only, public addresses checked at
  connect time, redirects re-validated with `Authorization` dropped across origins, a timeout and size
  caps. A direct `fetch` of such a URL is P0 (SSRF). Where a feature must contact an address on the
  owner's own network (the local receipt reader), it must be a deliberate, narrow, owner-set setting
  with `redirect: 'error'`, a timeout and a size limit, and never reachable by a token or a bank string.
- Bank, CSV, receipt and file content is untrusted. Check it is validated (Zod), that amounts are
  converted exactly, that text is length-limited and stripped of control characters, that CSV exports
  use `escapeCsv` for every text cell, that file names and types are checked and never used to build a
  filesystem path without containing it inside the files folder (no `..`, absolute paths or symlinks),
  that downloads set `Content-Disposition` through `contentDisposition.ts` and a safe type, and that
  uploaded content is never rendered as HTML or script.
- Client code never builds HTML from data (`dangerouslySetInnerHTML`, `innerHTML`), never puts a secret
  in a URL or `localStorage`, and opens links only as `https://` (`shell.openExternal` never receives
  an arbitrary URL). SQL goes through Drizzle or bound parameters; string-built SQL is P0. Regexes from
  rules are compiled with a length cap, and nothing user-controlled reaches `RegExp`, `eval`,
  `Function`, `child_process` or `require` unvalidated.

### Secrets and data exposure

- Credentials use the `encryptedText` column type and are never returned to the client, logged,
  exported, put in a backup, or added to `/api/server/info`, error messages or the security check. A
  new column that holds a secret is `encryptedText`, is excluded from `BACKUP_TABLES` if it is a
  credential, and cannot be used in a `WHERE` clause. The data key is never regenerated for an existing
  budget, and a missing key still stops the server in server mode.
- Nothing sensitive is committed: tokens, cookies, `.env`, databases, bank exports, `credentials.key`,
  hostnames or IP addresses of a real deployment, or real transactions in a test or fixture. Tests use
  mock data and disposable budgets. Treat any such value in a diff as P0 even if it is later removed
  (it stays in history and must be rotated).
- Errors, logs and audit rows carry no secrets, request bodies, tokens or bank text beyond what is
  needed. `errorHandler` returns generic JSON; `err.stack` and raw exception messages never go to the
  client.

### Desktop (Electron), Home Assistant and supply chain

- Remote pages get no Node access and no preload bridge. The picker page has its own narrow preload,
  and main validates the sender window, main frame and exact URL. Sandbox, context isolation,
  denied permission requests and navigation confined to the saved origin stay on. HTTP needs explicit
  trust confirmation; TLS errors are never bypassed (`certificate-error`, `ignoreCertificateErrors`,
  `rejectUnauthorized: false` and `NODE_TLS_REJECT_UNAUTHORIZED` are P0). The macOS title bar marker
  travels through the user agent, never a bridge.
- Home Assistant: `/data/options.json` stays root-only and the app runs as uid 1000; the watchdog
  stays TCP; an existing key is never regenerated; the image keeps its `io.hass.type`, version and
  architecture labels. Nothing in the repository holds a live hostname, IP or credential.
- Dependencies: install scripts stay disabled in every package (`.npmrc`), lockfiles change only with
  `package.json`, `npm audit signatures` keeps passing, and a new package is justified and well
  maintained. Do not accept a lockfile edit that adds a registry other than npm, a git or tarball
  dependency, or a version that resolves differently from its `package.json` range.
- Workflows: actions are pinned to a commit SHA; `permissions` are least privilege; no secret is
  exposed to a `pull_request` run from a fork; untrusted values (branch names, PR titles, comments) are
  never interpolated into `run:` steps; release tags point at a tested `main` commit and are never
  moved; signing, attestation and `SHA256SUMS.txt` steps stay in place.

### Data integrity as a security property

- Nothing in a code release migrates, replaces or deletes a live budget. A migration is additive and a
  change that can drop or rewrite user data is P0 (see the database rules in AGENTS.md). Restore
  validates every column and saves a pre-restore copy before replacing anything.
- A change must not let any caller (a token, a sync, an import) overwrite reconciled or user-edited
  rows, silently link transfers, or delete data that the owner can no longer recover.

### Keeping this file true

When a change adds or alters a protection, an outbound service, a stored secret, a route exception or
a token scope, update the matching section above in the same PR. A statement here that the code no
longer backs (a service, command, repository name or guard that has changed) is a finding.
