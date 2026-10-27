# Separate budgets for more than one person on one server

Status: **built in `0.2.0-up.48`** (steps 1 to 3 below, without SMTP). The owner approved the
gateway design on 27 October 2026. It hosts the owner's and a partner's budgets on the same Home
Assistant app, where neither can see the other's, each with their own password and a way to reset
it. User guide: `homeassistant/DOCS.md`, "Separate budgets for more than one person".

**As built:** multi-user mode is opt-in (Home Assistant option `multi_user`). The budget that was
already there stays in place and becomes the first person's: no migration, no moved files, and
turning the option off returns to it and its old password. That replaced step 4 below.

- Code: `server/src/gateway/` (`store.ts` people, sessions and codes; `budgets.ts` child
  processes; `app.ts` sign-in, people and forwarding; `notify.ts` Home Assistant notifications;
  `index.ts` the entry, bundled as `gateway.js`). A budget behind the gateway (`gatewaySecret`
  in `config.ts`) closes its own login routes and accepts only the gateway's secret header
  (`requireSession` in `routes/auth.ts`).
- Access tokens behind the gateway are `fbro_<person id>_<random>`, so the gateway routes them to
  their budget without adding the secret; that budget checks the token as usual.
- A new or reset password revokes that person's access tokens (`POST /api/access-tokens/revoke-all`
  on their budget), as changing the single password does.
- Tests: `server/src/gateway/*.test.ts` (real budget processes from source) and
  `e2e/tests/multi-user/people.spec.ts` (project `multi-user`).

## What "can't see each other's" can and can't mean

- **Through FlyBudget:** fully achievable. Each person signs in to their own budget. No page, API,
  export, MCP endpoint, access token or backup of one budget can reach the other's.
- **Against the server's administrator:** not achievable with ordinary passwords. Whoever administers
  Home Assistant can read the app's data folder, its backups and its logs. A truly private budget
  would need encryption with a key derived from the person's own password, and then **a forgotten
  password would lose the budget**, since nobody could reset it. This plan doesn't do that, and the
  sign-in page and docs say so plainly: the Home Assistant administrator is trusted.

## Recommended design: one budget per person, each in its own process

FlyBudget today is a single-owner app. One SQLite database is opened once
(`server/src/db/index.ts`), and about 100 server files import that connection directly. Background
work (Up sync polling, receipt reading and matching, exchange rates) runs against it. Adding a
`user_id` to every table and query would touch all of that, and a single missed `where` would leak
one person's money to the other. That risk is not acceptable for a budget.

Instead, keep each budget exactly as it is today and add a small **gateway** in front:

```
browser ──► gateway :3001 (sign-in, people, password resets)
               ├──► budget "tristan"  127.0.0.1:4101  /data/budgets/tristan/{budget.db, credentials.key}
               └──► budget "partner"  127.0.0.1:4102  /data/budgets/partner/{budget.db, credentials.key}
```

- **Gateway:** a new process (same image, `server/src/gateway/`). It owns `/data/people.db`, with
  each person's name, scrypt password hash, sessions, an optional reset destination and their budget
  folder. It serves the sign-in, reset and account pages, then proxies every other request (HTTP and
  the MCP endpoint) to that person's budget process. It keeps the existing host/origin checks,
  `trust_proxy` handling and rate limits.
- **Budget processes:** today's server, unchanged apart from one new mode: it listens only on
  loopback and trusts a per-process secret header from the gateway instead of its own password. It
  can't be reached from outside the container. Each has its own database, its own encryption key for
  bank tokens, its own Up token and its own background jobs. Isolation comes from separate files and
  processes, not from query filters.
- **Cost:** about 100 to 150 MB of memory per budget. With 16 GB that is negligible. The gateway
  starts budget processes on first sign-in and stops idle ones (except those with Up polling on).

**Alternative considered:** one process that switches databases per request, using
`AsyncLocalStorage` and a proxy around `db`. That uses less memory, but every background job,
module-level cache (for example the receipt reading queue and exchange-rate state) and timer would
have to become per-budget, and one mistake mixes data. It's worth revisiting only if memory becomes
a problem.

## People and sign-in

- **First run:** the existing setup code (printed in the app's Log) creates the first person, who
  becomes the **administrator**. The administrator can add people. Adding someone creates an empty
  budget and a one-time invitation code, which that person enters to set their own password.
- **Upgrading an existing install:** the current budget becomes the administrator's budget, moved
  into `/data/budgets/<id>/` with its key. This is a migration of a live budget, so per CLAUDE.md it
  needs the owner's explicit go-ahead and a verified cold backup that includes the encryption key.
  It can't ride along with a routine release.
- **The administrator can't open another person's budget** through FlyBudget. They can disable or
  delete a person and reset their password (below), but that doesn't let them in: a reset code goes
  to the person, not the administrator.
- **Desktop app and access tokens:** the desktop app signs in to the gateway like a browser. Read-only
  access tokens and the MCP endpoint belong to one budget, and the gateway routes them by token.

## Changing and resetting passwords

- **Change password:** signed in, from Settings, with the current password, as today. Other sessions
  for that person are ended and their access tokens are revoked.
- **Forgot password:** three ways, chosen per person:
  1. **Home Assistant notification (recommended):** the app gets `homeassistant_api: true`. Each
     person may name a notify service, for example `notify.mobile_app_partners_phone`. **Forgot
     password** sends a six-digit code, valid for 10 minutes, to that phone through the Home
     Assistant Companion app. It needs no mail server and no internet exposure.
  2. **Email:** optional SMTP settings in the app's options (host, port, user, password, from). The
     code is sent to the person's address. It's useful if someone doesn't use the Companion app.
  3. **Administrator reset code:** the administrator chooses **Reset password** for a person, and a
     one-time code is printed in the app's Log (like today's setup code) for the administrator to pass
     on. This is the fallback when nothing else is set up.
- **Code rules:** codes are random, stored only as hashes, single use and expire after 10 minutes.
  At most 5 tries are allowed per code, with rate limits per person and per address. The forgot
  page always says "if that person exists, a code was sent", so it doesn't reveal who uses the
  server.

## Sharing between the two budgets (later)

Households today are a private ledger inside one budget, such as the "King-Grey" and "Tristan"
households. With separate logins, a shared household could live in the gateway, or in a third
"household" budget both people can open. Each would record their own shares, and settlements would
show on both sides. That's a separate phase: it needs its own design for who may edit what, and for
attributing changes to a person.

## Home Assistant app changes

- Options: `smtp_*` (optional). Each person's notify target is set in FlyBudget, not in the options.
- `homeassistant_api: true` only for sending notifications. The app never reads entities.
- The Supervisor TCP watchdog stays on the gateway port. `/data/options.json` stays root-only, as
  today.
- Backups stay `cold` and include every budget folder and `people.db`. Restoring one person's budget
  on its own isn't offered at first.

## Delivery in steps

1. **Gateway and budget mode:** done.
2. **People:** add a person, invitation code, per-person sign-in, administrator page, stop and
   allow sign-in: done. Deleting a person's budget is left to the files (deliberately not a button).
3. **Password resets:** Home Assistant notify codes and administrator reset codes: done. **SMTP
   email is not built yet.**
4. **Migration of the existing install:** not needed; the existing budget stays in place.
5. **Later:** shared households across budgets.

## Verification

- Isolation tests: person A's session, cookies, access tokens and MCP calls get a 404 or 403 for
  every route on B's budget. The proxy never forwards the gateway secret or the session cookie of one
  person to another person's process.
- Reset tests: expiry, single use, try limits, hashed storage, generic answers, and no reset without
  a configured destination.
- Container smoke test with two budgets: both start, both persist across a restart, and the watchdog
  stays healthy.
