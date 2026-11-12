# Files

Status: built (0.2.0-up.79). A document library kept with the budget, after PocketSmith's
[Files](https://www.pocketsmith.com/features/files/): bills, warranties, insurance policies,
receipts and photos or videos of what you own, each linked to what it belongs to.

Receipts, matching and tax:
[RECEIPTS-AND-TAX.md](RECEIPTS-AND-TAX.md).

## 1. What PocketSmith does, and what we take from it

- **A library:** browse, upload, preview, rename, describe and download files in one place.
  Files have labels, can be flagged **important**, and **starred** as a temporary reminder.
- **Many-to-many links:** one file can be linked to many transactions and many budgets. Removing a
  link keeps the file; only deleting removes it.
- **Search** by date, label and type. Results show what each file is linked to.
- **Types:** documents, spreadsheets, images, PDFs and video.
- **Email inbox:** a private address to forward bills to.
- **Storage** by plan, from 250 MB to 50 GB, with a usage meter.

Allotment takes all of these except the email inbox. As for receipts (RECEIPTS-AND-TAX.md §1), it
would mean running an inbound mail service on the internet, which a private, self-hosted budget
should not do. Instead, the installed web app is a **share target** (§7): a phone's share sheet
sends files straight to Files. Links go to Allotment's **categories** (its budgets), **goals**,
**accounts** and **transactions**. Allotment also searches inside files, which PocketSmith doesn't
mention, and there are no paid plans: storage is the owner's own disk, with an optional limit.

## 2. Storage

| Table            | Holds                                                                                                                      | In JSON backups |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `receipt_files`  | the bytes, once per content (id = SHA-256), type, size, and `on_disk` (1 = in the files folder)                            | no              |
| `documents`      | a file in the library: file id, name, type, size, description, date, important, starred, text found in it (`search_text`)  | yes             |
| `document_links` | what a document belongs to: one row per link, with exactly one of `transaction_id`, `category_id`, `goal_id`, `account_id` | yes             |
| `document_tags`  | a document's labels: the budget's `tags`, shared with transactions                                                         | yes             |
| `receipts`       | a receipt's details (RECEIPTS-AND-TAX.md), and its document (`document_id`; deleting the document deletes the receipt)     | yes             |

- **Every stored file is a document.** Migration 0062 made a document for each existing receipt,
  with the receipt's id. `addReceipt` makes both. Restoring a backup from before Files (format 22
  or older) gives each receipt its document (`ensureReceiptDocuments`, also run at startup).
- **Bytes live in the database**, as for receipts, so a cold copy of the database holds them. The
  limit is 25 MB a file and 50,000 documents.
- **Videos** (MP4, MOV) over 25 MB, up to 250 MB, are kept on disk instead: in
  `<database name>-files/` beside the database (`budget-files/` for `budget.db`), named by their
  hash, with `receipt_files.on_disk = 1`. Each budget has its own folder: the multi-user gateway
  gives each person their own data folder. The Home Assistant backup (`/data`), the desktop data
  folder and `docker exec flybudget node backup.cjs` (which copies the folder next to its
  database copy) all include it. A large upload is read as it arrives
  (`fileStore.receiveUpload`): in memory up to 25 MB, then, only if its first bytes are a video's,
  into `<files folder>/incoming/` and renamed into place once it is kept.
- **A file is deleted** once no document and no receipt uses it (`fileStore.releaseFiles`, after the
  rows are gone). Deleting a receipt deletes its document. Deleting a document deletes its
  receipt.
- **JSON backups** (format 23) carry documents, links and labels, not bytes. Restored on the same
  installation every file is found by its hash; elsewhere a document says its file is not on this
  installation (`hasFile: false`).
- **Backup with files** (Settings → Data, audit decision I-6, `services/backupArchive.ts`,
  `GET /api/backup-archive`): a ZIP of `backup.json` (the JSON backup, unchanged) and
  `files/<sha256>` for every file a document or receipt refers to, streamed (a video is read from
  disk as it is written; up to 4 GB, ZIP's limit). Restoring it (`POST /api/backup-archive/restore`,
  the ZIP as the body) saves the upload beside the files, checks every file against its name's
  hash and stores the missing ones, and only then replaces the budget with `restoreBackup`. A
  damaged file, or a budget that won't restore, changes nothing, and the files this restore
  added are removed again. The storage limit doesn't apply to a restore. Not in the in-browser
  demo, and no access token reaches either route. **Download all** (§5) stays the way to get the
  files out by name, for people.
- **Limit:** Files → Storage → **Set a limit** (`budget_settings.files_cap_mb`, null = none). An
  upload that would take the stored bytes over it is refused. The same bytes stored again take no
  more room, and aren't counted again.

## 3. Types and safety

- **Type from the bytes** (`fileTypes.sniffFileType`), never from the browser's claim:
  - photos: JPEG, PNG, WebP, GIF, HEIC; PDF; video: MP4 and MOV (by their `ftyp` brand);
  - Word, Excel and PowerPoint (`.docx`, `.xlsx`, `.pptx`): a ZIP with `[Content_Types].xml` and
    the part that makes it that kind; OpenDocument (`.odt`, `.ods`, `.odp`): a ZIP whose `mimetype`
    entry says so. A macro-enabled file (`vbaProject.bin`) is refused whatever it is called;
  - CSV, Markdown and plain text: by the name's extension, and only when the whole file is UTF-8
    with no NUL bytes.
  - Anything else is refused, SVG and HTML included.
- **The ZIP reader** (`utils/unzip.ts`) reads only stored and deflated entries, and never inflates
  an entry past a set size, so a small file can't expand into a huge one.
- **Serving** (`GET /api/files/:id/file`): `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox`.
  Photos (not HEIC) and videos are inline, with byte ranges for video players; everything else is
  a download (`?download` forces one for photos too). Nothing that is a document ever renders in
  the app's own origin.
- **Previews** in the page:
  - photos as images and videos with the browser's player;
  - text and CSV as plain text (never rendered as HTML or Markdown);
  - **PDFs drawn by PDF.js** (`client/src/components/files/PdfPreview.tsx`, `pdfjs-dist`, loaded
    only when a PDF is opened), page by page onto canvases, so no script, form or link in a PDF
    runs. Its worker is a file the app serves (`worker-src` falls back to `script-src 'self'`).
    The first 20 pages are drawn;
  - Office files are downloaded to open.
- **Access tokens:** `/api/files` is not on the allowlist. No token sees, adds or changes a file
  (tested in `routes/files.test.ts`). Files are not in MCP.
- **Demo:** the in-browser demo shows an empty library and refuses uploads ("not in the demo").
- Mock data and made-up files only, in tests and the demo.

## 4. Links

- **Kinds:** transaction, category, goal, account, asset (a depreciating asset's records,
  DEPRECIATING-ASSETS-PLAN.md; migration 0066), and investmentSale and investmentIncome (a sale's
  contract note, a payment's statement; INVESTMENT-SALES-AND-INCOME.md, migration 0083), and
  homeYear (a working-from-home year's bills; TAX-CAR-AND-HOME.md, migration 0085; the target id
  is the financial year, kept in `document_links.home_year_fy`, and linking creates the year's
  `tax_home_years` row) (`LINK_TARGETS` in `documentService.ts`).
  Adding a kind is one nullable foreign-key column on `document_links` (an additive migration, with
  `ON DELETE CASCADE` and a partial unique index) and one entry in `LINK_TARGETS`. The
  depreciating assets plan adds `asset` this way
  ([DEPRECIATING-ASSETS-PLAN.md](DEPRECIATING-ASSETS-PLAN.md) §3.1). A file's **Link** offers
  Asset once there is one; an asset's Records on Tax time → Assets lists and adds its files. A
  sale's or a payment's files are added from its row under Investments (Sales or Income), not from
  a file's **Link**; the year's ZIP on Tax time includes them.
- A file belongs to the whole transaction: a link to a split part goes to its parent.
- **Deleting what a file is linked to** removes only the link (`ON DELETE CASCADE` on the link,
  never the document). **Merging a category** moves its files' links to the category it joins
  (`moveCategoryLinks`).
- **A receipt's match is a link too**: a receipt document shows its matched transaction as a link
  marked `viaReceipt`. Removing that link in Files unmatches the receipt (it goes back to the
  Receipts inbox), exactly as Unmatch does.
- **Use as a receipt** (`POST /files/:id/receipt`) makes a photo or PDF in Files a receipt, so
  Receipts can read, match and split it. When the file is linked to exactly one transaction, the
  receipt is matched to it and that link becomes the receipt's match.
- **Counts** (`GET /files/counts?kind=`): files per target, receipts included, without counting a
  receipt that is also linked twice.

## 5. The Files page and elsewhere

- **Files** in the sidebar (`/files`): views All files, Starred, Important, Receipts and Not
  linked; **labels** to drill into; search; kind and date filters; **Download all**; the storage
  meter and limit. URL state: `q`, `view`, `tag`, `kind`, `from`, `to`, and `file` for the one
  open. An unfiltered empty library shows a promise, an illustrative example and Add a file
  using the existing picker and drop target; search and filter controls appear once useful.
- **A file's details** (`FileDetailModal`): preview, Important, Star, Download, name, date,
  description, labels (choose or add one), **Linked to** with Link (a transaction by search, or a
  category, goal or account) and remove, Use as a receipt or Open the receipt, Read its text
  (photos, §6), Delete (asks first; says when it deletes a receipt too).
- **Elsewhere** (`FilesSection`): the transaction panel (**Other files**, below Receipts),
  a category's page, a goal's menu (**Files**) and an account's page (**Files**). Each lists its
  files, adds new ones linked to it, links one already in Files, and unlinks.
- **The register:** a paperclip on rows with receipts or files, and the **Receipts and files**
  filter (`has_files=1|0`, allowed in saved views).
- **Tax time:** files linked to a claimed transaction are listed with its receipts and count as its
  evidence (the written-evidence check and Missing receipts), in the CSV (**Other files**) and in
  the year's ZIP (`files/<date> <label> <name>`; videos on disk are left out).
- **Download all** (`GET /files/export`): a ZIP of every file (`files/<date> <name>.<ext>`) and
  `files.csv` saying what each is, its labels and what it is linked to. It is written as it is
  sent, a file at a time (`ZipWriter`), and refused over 4 GB (ZIP's limit; copy the data folder
  instead). Spreadsheet formulas in the index are neutralised.

## 6. Search inside files

`documents.search_text` (up to 100,000 characters) is searched with the name, description, labels
and a receipt's merchant and notes (`LIKE`, with `%` and `_` taken literally).

- **Read on this server** (`fileText.ts`), just after an upload and at startup for files never
  read (receipts from before Files):
  - text, CSV and Markdown as they are;
  - Word, Excel, PowerPoint and OpenDocument from their XML (paragraphs, shared strings and
    cells, slides), with formulas left out;
  - PDFs best effort: the text drawn by each page's content streams (Flate-compressed or plain).
    Text drawn in a font's own encoding can't be read without the font, so it is left out rather
    than stored as nonsense.
- **Photos** are read only by the model the owner chose, when reading receipts is turned on
  (RECEIPTS-AND-TAX.md §5): **Read its text** sends the photo, only to that provider (their own
  model server, Anthropic or OpenAI), with a
  prompt to write out its words. It queues behind receipt reads, one at a time. With reading off,
  photos are found by name, description and labels only.
- `text_status`: null (not read yet), `pending`, `read`, `none` (nothing found) or `failed`.

## 7. Sharing from a phone

The self-hosted web app has a manifest (`client/public/manifest.webmanifest`, linked by
`main.tsx` only where the service worker runs) with a `share_target`. Once Allotment is installed
on the phone's home screen, it appears in the share sheet:

1. The share sheet posts the files to `/share-target`.
2. The service worker (`public/sw.js`, `receiveShare`) takes the request, holds at most 20 files in
   a cache on the device (`flybudget-shared`) and opens `/files?shared=N`. The files never reach
   the server here.
3. The Files page uploads them like any upload (signed in as usual), then deletes the cache.

Browsers only support share targets for installed apps with a service worker: Chrome on Android,
for example, not Safari on iOS (use **Add files**, which offers the camera and photo library).

## 8. API

| Method and path                                   | What it does                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /files`                                      | search: `q`, `tag`, `kind`, `from`, `to`, `starred`, `important`, `linked`, `receipt`, `linkKind`+`linkId`, `limit`, `offset` |
| `POST /files?fileName=&linkKind=&linkId=&tagIds=` | upload; the body is the file                                                                                                  |
| `GET /files/:id`, `PATCH /files/:id`              | one document; change `fileName`, `description`, `documentDate`, `important`, `starred`, `tagIds`                              |
| `POST /files/:id/links`                           | link: `{ kind, id }`                                                                                                          |
| `DELETE /files/:id/links/:kind/:targetId`         | unlink (a receipt's match: unmatch)                                                                                           |
| `POST /files/:id/receipt`                         | use as a receipt                                                                                                              |
| `POST /files/:id/text`                            | read its text again                                                                                                           |
| `DELETE /files/:id`                               | delete it (and its receipt)                                                                                                   |
| `GET /files/:id/file`                             | the file (ranges; `?download`)                                                                                                |
| `GET /files/counts?kind=`                         | files per transaction, category, goal or account                                                                              |
| `GET /files/storage`, `PUT /files/storage`        | what is stored, and the limit (`{ capMb }`)                                                                                   |
| `GET /files/export`                               | every file as a ZIP                                                                                                           |

## 9. Tests

- `server/src/routes/files.test.ts`: types from bytes, text extraction, the ZIP size limit,
  search, labels, every kind of link, unlinking, category merges, the register filter, serving
  headers and ranges, videos on disk, the storage limit, receipts as documents and shared files,
  Use as a receipt, tax evidence and the archive, backups (format 23 and 22), Download all, and
  tokens.
- `client/src/utils/transactionFilters.test.ts`: the register filter.
- `e2e/tests/files.spec.ts`: add, search inside, label, star, link to two transactions, unlink,
  the transaction panel and the filter. `phone/phone.spec.ts` visits Files at phone width.

## 10. Not built

- An email inbox (§1).
- Files for the read-only assistant (it would need an owner-approved exception to the allowlist).
- Video previews' thumbnails (a video shows an icon until opened).
- Reading text from HEIC photos, and from PDFs that are scans (no OCR without the local model,
  which reads photos only).
