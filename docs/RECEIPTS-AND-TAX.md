# Receipts and tax deductions

Status: built (0.2.0-up.42; the Receipts tab in 0.2.0-up.43). Record keeping for an Australian individual tax return, not tax advice.

## 1. What Monarch does, and what we take from it

From `docs/research/monarch-action-catalog.md`, `monarch-live-audit-continued.md` and
`monarch-documented-behavior.md`:

- The transaction register has a **Receipts (New)** tab beside All and Retail Sync.
- Receipts arrive by **upload**, **clipboard paste** (Cmd+V) or a **forwarding email address** with
  authorised senders.
- Monarch **matches** a receipt to its transaction and, as an option, **splits and categorises** it
  from its line items, putting tax, tip and line items into notes. That parsing is done by their
  servers (AI), and it is behind their paid plan.
- A transaction's drawer shows its **attachments**, and the register can be filtered by **Has / No
  attachments**.
- Monarch has no tax-deduction feature.

Allotment takes the upload, paste, inbox, matching and attachment ideas, and (since 0.2.0-up.43) splitting by line items. It leaves out two:

- **Email forwarding** would need an inbound mail service exposed to the internet, which a private,
  self-hosted budget should not run.
- **Server-side AI parsing** would send receipts to a third party. Allotment can instead read
  photos with a model on the owner's own Ollama server (§5, since 0.2.0-up.44).

The owner types a receipt's details and line items, and matching and splitting use those.

## 2. Storage

| Table           | Holds                                                                                                                              | In JSON backups |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `receipt_files` | the bytes, once per content (id = SHA-256), type, size                                                                             | no              |
| `receipts`      | file id, file name, type, size, optional merchant / date / total / notes, and the transaction (null = inbox; `ON DELETE SET NULL`) | yes             |
| `tax_claims`    | one per transaction: return label, work-use share (bps), notes (`ON DELETE CASCADE`)                                               | yes             |

- **Files live in the database**, so a cold copy of it (the Home Assistant backup, or the desktop data
  folder) holds every receipt, and a restore's safety copy keeps them too. Photos are shrunk in the
  browser to at most 2,000 px as JPEG before upload. A PDF or a HEIC photo the browser can't read is
  kept as it is. The limit is 10 MB a file and 20,000 receipts.
- **JSON backups** (format 19) carry receipt details, line items and claims, but not files, so they stay small.
  Restoring on the same installation finds every file by its hash. Elsewhere, a receipt says its
  file is not on this installation (`hasFile: false`) instead of failing. Format 17 and older backups
  restore with no receipts or claims.
- Deleting a receipt deletes its file once no receipt uses it.

## 3. Safety

- **Type from bytes:** the server reads a file's type from its first bytes (JPEG, PNG, WebP, HEIC,
  PDF). Anything else is refused, whatever its name or claimed type.
- **Serving:** files are served with `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; img-src 'self'; sandbox`. Photos are inline; PDFs and
  HEIC are downloads, never documents that render in the app's origin.
- **Read-only tokens:** `/api/receipts` and `/api/tax` are deliberately not on the read-only token
  allowlist. An assistant token never sees a receipt or a claim (tested). Receipts are not under
  `/transactions`, which is allowlisted.
- **Demo:** the in-browser demo has no file uploads ("not in the demo"). Tax claims work there.
- Mock data and made-up files only in tests and the demo.

## 4. Tax deductions

- **Labels** follow the deductions section of the individual return and myTax:
  - D1 car, D2 travel, D3 clothing, laundry and dry-cleaning, D4 self-education, D5 other
    work-related;
  - D6 low-value pool, D7 interest, D8 dividends, D9 gifts and donations, D10 cost of managing tax
    affairs;
  - D15 other deductions (for example income protection insurance).
- **What can be claimed:** any non-split, non-transfer transaction. A split is claimed part by part,
  so the work part of a mixed purchase can be claimed on its own.
- A transaction split or made a transfer after it was claimed keeps its claim row but drops out of
  the year, the markers and the exports, so a split is never counted twice; undoing the split brings it back.
- **Claim** = cost (the expense in the budget's currency) × work-use share, rounded half away from
  zero. A refund that is claimed reduces the claim.
- **Financial year** runs 1 July to 30 June and is named by its start: 2026 is 2026–27.
- **Checks** (prompts only; they never block a claim):
  - **Written evidence:** once D2–D5 claims total more than $300 in a year, every claim without a
    receipt is counted, and the page says the ATO expects written evidence. D1 car expenses have
    their own record-keeping rules (logbook or cents per km) and are left out of the total.
  - **Over $300:** a D2–D5 item costing more than $300 is flagged. Such items are usually claimed as
    decline in value over several years. A claim is never split into years automatically.
- **Rules:** `claim_tax_deduction` with a label claims money out as it imports, or when rules are
  applied. It claims only outflows, the first matching rule wins, and it never replaces an existing
  claim. Created rules follow the usual rule review; tokens can propose such a rule only disabled.
- **Exports:** `GET /api/tax/years/:fy/csv` and `/archive` (a stored ZIP of the CSV plus every
  claimed receipt, named `receipts/<date> <label> <payee>.<ext>`).
  - Spreadsheet formulas in payee names are neutralised with a leading apostrophe.
  - The ZIP writer is dependency-free (stored entries, CRC-32, UTF-8 names), and is checked with
    `unzip -t` and in tests.

## 5. The Receipts tab (Monarch parity)

From Monarch's "Importing Receipts into Monarch" help article: receipts are general purchase
records, not only tax evidence.

- **Where:** **Transactions → Receipts** (`?view=receipts`, with `&receipt=<id>` for the one open),
  beside All. Filters are All, Unmatched and Matched. There are **Upload** (several files, drop or
  paste), **Scan receipt** (`capture="environment"`, the camera on a phone; also in the All tab's
  header, like Monarch's Add → Scan receipt), **Match now** and **Settings**.
- **What a receipt says** (typed, or read by a local model, below): merchant, date, amount (total), subtotal, tax,
  tip and fees, notes, and line items (description, amount, category) in `receipt_line_items`.
- **Automatic matching** (`receiptMatching.findAutoMatch`), on Monarch's rules:
  - money out of exactly the receipt's total, top-level, not a transfer, with no receipt yet;
  - the same merchant (letters and digits, either name containing the other, at least 3
    characters) from 2 days before to 7 days after the receipt's date;
  - otherwise any merchant within a day;
  - more than one candidate means no match (never guess).
- **When it runs:** when a receipt's details are saved (at once, so the page can say what
  happened), and after each new transaction once the import is done (`scheduleReceiptMatching`,
  because a split can't start inside an import's own database transaction). **Match now** retries
  every unmatched receipt.
- **One attach path** (`attachReceipt`) for automatic, Find match, inbox Attach, upload onto a
  transaction and Add transaction:
  - tag **Receipt**;
  - append the receipt's notes and item names to the transaction's notes (unless reconciled);
  - **autosplit**, when items name two or more categories, by `splitTransaction`. Each category's
    weight is its items, plus tax in proportion to those items, plus tip and fees shared evenly
    per item, apportioned exactly to the transaction's own amount (largest remainder, BigInt);
  - with one category, set it only when the transaction has none.
  - Automatic autosplit only touches a transaction with no category and no tax claim ("preserve
    user-edited rows"); a categorised one is split only by **Split by items** (`POST
/receipts/:id/split`), on request. A reconciled, already split, transfer or claimed
    transaction is never split (a split parent is no longer a deduction), and the outcome says why.
  - Saving details on a receipt that is already matched (one added straight to a transaction)
    enriches the transaction again; every step is safe to repeat.
  - **Split by items** saves what is typed first, so it splits by what is on screen.
  - The amount is never changed. Settings live in `budget_settings` (`receipt_auto_split`,
    `receipt_add_notes`, `receipt_add_tag`, all on by default).
- **Unmatched:** **Find match** searches top-level money out by payee, bank description or notes,
  60 days either side. **Add transaction** makes one through `insertNewTransaction` (rules run),
  from the merchant, date and amount, in an account you choose.
- **Unmatch** keeps what was added to the transaction. Deleting a receipt never deletes a
  transaction; deleting a transaction makes its receipts unmatched.
- **Backups:** format 19 adds `receiptLineItems`; format 18 backups restore with no line items.
- **Reading photos with a local model** (`receiptReader.ts`, since 0.2.0-up.44):
  - **Off by default.** Settings → _Read receipts automatically_: an Ollama address (http or
    https, no path or credentials; redirects are refused) and a model. On Home Assistant, the
    Ollama app's address on the internal network is shown in its documentation (`http://<app-hostname>:11434`), so no port needs opening. **Check** lists
    the server's models and which can read images (`vision`).
  - **What is sent:** the photo (JPEG, PNG, WebP; not PDF or HEIC), only to that address, with a
    prompt naming the spending categories. The request asks for JSON in a fixed schema
    (`format`), `temperature: 0`, `think: false` (a thinking model is slow on a CPU) and
    `keep_alive: 5m`, and an 8192-token context (`num_ctx`; Ollama's 4096 default can cut a
    photo off), so the model leaves memory a few minutes after the last receipt.
  - **What is kept:** a sensible positive amount in cents, a real date from 2000 to tomorrow, a
    category only if it matches a spending category by name; anything else is null.
  - **Checked before it is kept** (`checkRead`, since 0.2.0-up.46): the prompt describes
    Australian receipts (day-first dates, GST-inclusive prices, the printed GST amount, card
    surcharges as fees). A merchant that looks like a card terminal or payment provider is left
    empty; tax, tip or a subtotal not below the total is dropped. Items must add up, within
    max(10c, 2%), to the total, the total less tip, the total less tip and tax, or the printed subtotal;
    otherwise they are not kept, because a matched payment would be split by them. What was
    dropped is stored in `read_error` with status `read` and shown on the receipt.
  - **Never replaces what was typed:** only empty fields are filled, and line items only when
    there are none. The receipt is then saved through `updateReceipt`, so it is matched and
    enriched exactly like typed details.
  - **In the background, one at a time** (`read_status` pending → read or failed, with the
    reason). The editor's fields are locked while it is read, so nothing typed is lost. Reads
    left waiting are resumed at startup. **Read receipt** / **Read again** in the editor.
  - **Try a sample receipt** reads a built-in made-up receipt (`receiptSample.ts`) and reports
    what was right and how long it took, without touching the budget.
  - Measured on an Intel N100-class mini PC sharing its CPU with Frigate (`qwen3-vl:4b-instruct`):
    about 75 s to take in even a small image, so allow 2 to 4 minutes a photo.
  - Read-only tokens reach none of it (`/receipts` is not on the allowlist).
- **Not built:** email forwarding (it needs an inbound mail service exposed to the internet) and a
  "pending" state (Allotment imports settled transactions only).

## 6. Not built

- Email forwarding, and reading PDFs (only photos are read).
- Working-from-home hours (the fixed rate per hour), car logbooks and cents per kilometre.
- Depreciation schedules and the low-value pool calculation.
- Income, tax withheld, tax offsets and an estimated refund.
- Lodging with the ATO. myTax has no import, so the CSV is for you or your tax agent.
- A "Has receipt" filter in the register (markers show instead).
- Uploading receipts from the read-only assistant.

Receipts are read only by a model on the owner's own Ollama server (§5). The assistant route
would need an owner-approved exception to the token allowlist, which has not been made.
