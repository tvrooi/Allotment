# Email codes and reminders for separate budgets

Status: **Part 1 (D2a, email codes) built in up.128; Part 2 (D2b, reminders) not built.** Design
approved 7 November 2026: the owner took every recommendation except decision 5, where each person
chooses where their codes go (see "Owner decisions"). D2 of the Larger features group. It finishes
step 3 of [MULTI-USER-PLAN.md](MULTI-USER-PLAN.md) (SMTP email) and, with D2b, the reminders gap in
HANDOVER open items 3 and 9. "What is true today" below describes the code before D2a; "As built"
says where D2a differs from the design.

## The problem

Two things work with one budget but not behind the multi-user gateway:

1. **Password codes only reach a phone.** A person's forgotten-password code goes to a Home
   Assistant notify service (the Companion app) or, through the administrator, the app's Log.
   Someone without the Companion app depends on the administrator. The plan named email (SMTP) as
   the third way; it was never built.
2. **Bill reminders don't send.** Each budget still finds what is due (FINX-02, up.103), but it
   has no way to deliver a message, so Settings → Server → Reminders says reminders are not
   available.

## What is true today (checked in code, 7 November 2026)

- **Only the gateway can notify.** `processLauncher` (`gateway/budgets.ts`) deletes
  `SUPERVISOR_TOKEN` from each budget's environment. The budget's `canNotify()` is false, so
  `createRemindersRouter` reports `available: false` and the schedule timer's `afterTick`
  (`server/src/index.ts`) sends nothing.
- **Budgets run all the time.** `startGateway` starts every person who may sign in at boot and
  restarts a budget that stops. So each budget's hourly timer runs even when nobody is signed in;
  reminders can still be worked out where they are today.
- **The reminder code is ready for another channel.** `sendDueReminders(notify)` takes a `Notify`
  function, marks occurrences only after a send succeeds, and keeps the daytime window and the
  generic lock-screen text. The router takes `notify` and `available` as parameters.
- **A phone is saved without proof.** `PUT /people/me/notify` stores any valid service name. Person
  A could point their own codes, or (with this design's reminders) their schedule names, at
  person B's phone.
- **Codes:** `codes` in `people.db` holds one hashed code per person and kind, with expiry and a
  try count. Its `kind` has a `CHECK (kind in ('invite', 'reset'))`, so a new kind would mean
  rebuilding the table. `people.db` has never been migrated: `GatewayStore` only runs
  `create table if not exists`.
- **Forgot password:** the administrator always gets a 24-hour code in the Log (and on their phone
  if set); anyone else gets a 10-minute six-digit code only if they set a phone. The answer is the
  same whoever asks. `/auth/forgot` allows five requests per IP address every 15 minutes.
- **The environment leaks to budgets.** Budgets get the gateway's `process.env` minus a short
  list. A mail password put in the environment would reach every budget unless deleted there.
  The Home Assistant options arrive on a descriptor that root opens (`ha-launch.cjs`), so they
  can be passed to the gateway as a value instead.
- **Single-budget installs** (Home Assistant without `multi_user`, Docker, desktop) reset a
  forgotten password with a code in the server log and a Home Assistant persistent notification
  (`auth/resetNotify.ts`). This design leaves them alone unless decision 7 says otherwise.

## Part 1: email codes

### Where the mail server is set

- **S1, the app's options in Home Assistant (recommended).** New optional options: `smtp_host`,
  `smtp_port`, `smtp_security` (`tls` or `starttls`), `smtp_username`, `smtp_password` (a
  password field, hidden in the UI) and `smtp_from`. All empty means email is off. The Home
  Assistant administrator, who is already trusted with every budget's files, sets it once.
  `ha-launch.cjs` validates the set as a whole and hands it to `startGateway` as an argument, never
  through the environment, so no budget sees the password.
- **S2, an administrator page in Allotment.** The password would be stored encrypted in
  `people.db` with a new key. More screens, another secret to keep, and a second place for server
  settings.
- **S3, environment variables** for a multi-user Docker install. Possible later; today the
  gateway is only offered as a Home Assistant option.

### How mail is sent

- **M1, Nodemailer (recommended).** Version 10, MIT-0 licence, no runtime dependencies, no install
  scripts, about 1.7 MB unpacked, widely maintained. It handles STARTTLS, authentication, header
  encoding and line rules, which are where hand-written SMTP clients go wrong. Server only; not
  bundled into the demo or the client.
- **M2, our own client on `node:tls`.** About 250 lines, and every protocol and injection edge
  case becomes ours to get right in security-sensitive code.

### Recommended design

- `gateway/mail.ts`: `Mailer = (to, subject, text) => Promise<void>` and `canEmail()`, beside
  `notify.ts`. Plain text only, fixed subjects, no links (so a real code email never looks like
  the phishing kind), 10-second timeouts. TLS always: `tls` (usually port 465) or `starttls`
  with TLS required, and the certificate verified (decision 4). Errors are logged without the
  address or the password.
- **Each person's address, confirmed.** In Settings → Server, the section now called "Password
  codes to your phone" becomes "Password codes" with a phone and an email. Adding an address sends
  a six-digit code there; the address is saved only once the person types it back. They can
  remove it at any time. Confirmation uses a new table (`email_codes`: person, address, hash,
  expiry, tries) instead of rebuilding `codes`.
- **`people.db` gets its first additive change:** `people.email`, `people.email_confirmed_at` and
  `people.code_channel`,
  added after a `pragma table_info` check, so an existing `people.db` keeps every row and a second
  start changes nothing. It is not part of any budget's backup; the app's cold backup includes it.
- **Forgot password:** a person with a confirmed address gets the same 10-minute code by email
  (subject "Allotment password code"). A person with both a phone and a confirmed address chooses
  where codes go: phone, email or both (decision 5; both until they choose, stored as
  `people.code_channel`). The administrator's 24-hour code also goes where they chose and stays in
  the Log. The answer stays the same for
  everyone, now "…to their phone or email…".
- **Limits:** the limit per IP address stays. Per person, at most one code a minute and ten emails a
  day across reset and confirmation codes, so Allotment can't be used to flood an inbox. Over the
  limit, the forgot page still gives its usual answer.
- `/auth/status` says whether email is on, so the settings page only offers an address when it
  can be used.

### As built (D2a, up.128)

- **Code:** `gateway/mail.ts` (`smtpTransportOptions`, `mailMessage`, `smtpMailer`,
  `EMAIL_ADDRESS`); `GatewayOptions.mail` is the `Mailer`, absent when no mail server is set, and
  `/auth/status` reports `canEmail`. `ha-launch.cjs` `smtpSettings` checks the six `smtp_`
  options as a set and passes the result to `startGateway({ smtp })`. Nodemailer opens no
  connection until the first email.
- **Routes** (`/api/people/me/…`, the signed-in person only): `POST phone` `{ service }` and
  `POST email` `{ email }` send a code and save nothing (202; 409 when that channel is off here;
  422 when the send fails; 429 within a minute of the last); `POST phone/confirm` and
  `POST email/confirm` `{ code }` save it; `DELETE phone` and `DELETE email` remove it;
  `PUT code-channel` `{ channel: 'phone' | 'email' | 'both' }`. They replace `PUT /me/notify`
  and its **Test** button: the confirmation code proves the phone.
- **`people.db`:** `people.email` and `people.code_channel` (with its `CHECK`), added by
  `GatewayStore.upgrade()` after `pragma table_info`. No `email_confirmed_at`: an address is saved
  only once confirmed, so a saved address is a confirmed one. One table, `destination_codes`
  (person, `phone` or `email`, address, hash, expiry, tries), confirms both phones and addresses
  instead of `email_codes`; `code_sends` (person, destination, purpose, time, kept a day) holds
  the limits.
- **Limits:** at most one code a minute per person, purpose (reset or confirmation) and
  destination (the Log counts as one), so a reset straight after confirming an address still
  goes; ten emails a day per person across both purposes. Within the minute no new reset code is
  issued at all, so the one already sent still works.
- **Where codes go:** where the person chose (both until they choose). If none of what they chose
  can be used here any more (email or notifications turned off), the other destination they have,
  so a server setting doesn't lock anyone out.
- **Development and tests:** `FLYBUDGET_DEV_MAIL_PORT` (the gateway's autostart only) sends
  plain SMTP to that loopback port; `mail.ts` refuses plain SMTP to any other host. The e2e
  global setup starts the mail catcher (`e2e/mailCatcher.ts`) before the gateway, which needs
  its port at start.

## Part 2: reminders for separate budgets

### Options

- **R1, the budget names the notify service and the gateway forwards it.** The same screen as a
  single budget. But a person could send reminder text they wrote (schedule names) to anyone's
  phone, and email would need its own setting in every budget.
- **R2, the gateway owns where messages go (recommended).** The budget asks the gateway to
  "send this to my person"; the gateway delivers to that person's own confirmed phone or email.
  One place per person for where messages go, email for free, and no budget holds a notify
  credential or names a destination.
- **R3, the gateway asks each budget hourly what is due and sends it.** It moves timing into the
  gateway and adds a second internal API, for no gain while budgets run all the time.

### Recommended design (R2)

- **A loopback-only listener in the gateway** (`127.0.0.1`, port 4100 by default, one below the
  budgets) with one route, `POST /notify`. It is not on the public port.
- **One notify token per budget.** On each launch the gateway passes the budget
  `FLYBUDGET_NOTIFY_URL` and a fresh random `FLYBUDGET_NOTIFY_TOKEN`, and keeps token → person in
  memory (compared in constant time). It is separate from the shared gateway secret, so one
  budget can't send as another person.
- **What a budget may send:** `{ title, message }`, validated with Zod (`.strict()`, title up to
  100 characters, message up to 2,000). The gateway sends to the person's chosen reminder
  destination: 409 if they have none, 422 if delivery fails. The budget's timer leaves those
  occurrences unmarked and tries next hour, as today.
- **Budget side:** `gatewayNotify()` is the `Notify` used when `FLYBUDGET_NOTIFY_URL` is set.
  Settings → Server → Reminders in a multi-user budget has no service field. It reads "Reminders
  go to your phone or email, chosen under Password codes", with on/off, **Include the name and
  amount** and **Send a test**. On/off needs one additive column on the budget's settings
  (`reminders_via_gateway`, kept in backups with the other settings); a single budget ignores it,
  so turning multi-user off brings back its own service field unchanged.
- **Gateway side:** each person chooses where reminders go: phone, email or both (decision 6).
- The daytime window, once-per-occurrence marking and generic text are unchanged. Email uses the
  same text, with the subject "Allotment: coming up".

## Proving a phone is yours

Today a notify service is saved without proof. With R2, reminder text a person wrote reaches that
destination. Recommended (decision 3): a new or changed phone is saved only after the person
types back a code sent to it, as for email. Phones already saved stay as they are.

## Out of scope

- Email codes for a single budget (decision 7), and Docker configuration (S3).
- Receiving email (the Files design deliberately has no inbox), HTML email, links or attachments.
- Messages about shared households across budgets, and a channel per schedule.

## Tests

- `gateway/mail.test.ts`: the transport options (TLS required, certificate checked, no plaintext
  to a non-loopback host) and the message built (fixed subject, plain text, no link), through
  Nodemailer's stream transport.
- `gateway/gateway.test.ts` with an injected mailer: confirming an address (right code saves;
  wrong code, five tries, expiry and another person's code refused), forgot password by email
  (sent; the same answer for an unknown name or a person with no destination; the per-person
  limits), codes going only where the person chose (phone, email or both), the administrator's
  code by email and in the Log, and the launch environment of a
  budget holding no SMTP setting.
- The notify listener: the right token reaches only its own person's destination; a missing or
  other token is refused (401); the public port has no `/notify` (404); oversized or extra fields
  are refused (400); no destination answers 409; a failed send answers 422 and the budget marks
  nothing (`reminderService` test with `gatewayNotify` against a fake gateway).
- `people.db` upgrade: a database made by today's `GatewayStore` keeps every person, session and
  code, and a second start changes nothing.
- `homeassistant/ha-launch.test.cjs`: SMTP options valid as a set, a partial set refused with a
  clear message, and the password absent from `process.env`.
- `e2e/tests/multi-user/people.spec.ts`: add an address with its code and reset a password by
  email, against a small mail catcher on loopback started by the test (decision 4 allows plain
  SMTP only to a loopback host, which a real install never uses).
- Smoke test: the container starts with the SMTP options empty and set; nothing connects to a mail
  server at start.

## Size and release

Recommended as two app PRs, each with a version bump, CHANGELOG entry, `homeassistant/DOCS.md`
("Separate budgets for more than one person") and the user guide:

1. **D2a, email codes:** options, `ha-launch.cjs`, `gateway/mail.ts`, `people.db` columns and
   `email_codes`, the Password codes screen, phone confirmation if decision 3 says so. No budget
   migration.
2. **D2b, reminders through the gateway:** the loopback listener, notify tokens, `gatewayNotify`,
   one additive budget migration, and the multi-user Reminders screen.

Neither moves, replaces or migrates a live budget. The new options are optional, so an existing
install starts unchanged. Before installing on the live app, take the usual cold backup.

## Owner decisions

Taken on 7 November 2026: the owner endorsed every recommendation except decision 5, where each
person chooses where their codes go (phone, email or both). D2a is built (up.128); D2b is next.

1. **Where the mail server is set.** Recommended: S1, the app's options in Home Assistant. Or S2,
   an administrator page in Allotment; S3 for Docker can follow either.
2. **Mail library.** Recommended: Nodemailer (M1). Or our own SMTP client (M2).
3. **Prove a phone too.** Recommended: yes, for a new or changed phone; saved phones stay.
4. **TLS.** Recommended: always (`tls` or `starttls`, certificate checked), with plain SMTP only to
   a loopback host for tests. Or also allow plain SMTP to an internal relay on your network.
5. **A person with both a phone and an email.** Recommended: the code goes to both. Or each
   person picks one. **Owner's choice: each person chooses phone, email or both.**
6. **Reminders.** Recommended: R2, with each person choosing phone, email or both (phone by
   default when they have one). Or R1 or R3.
7. **Single-budget installs.** Recommended: not now; a single budget's forgotten password stays a
   code in the Log and a Home Assistant notification.
8. **Delivery.** Recommended: two PRs (D2a, then D2b). Or one.
