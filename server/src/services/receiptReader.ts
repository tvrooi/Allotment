// Reading receipts with a local Ollama vision model (docs/RECEIPTS-AND-TAX.md §5). Off until the
// owner turns it on and names the Ollama address and model. The photo goes only to that address
// (on a home server, typically the Home Assistant Ollama app), never anywhere else. What the model
// reads only fills fields that are still empty, and then the receipt is matched like a typed one.
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { categories, categoryGroups, receiptFiles, receipts } from '../db/schema.js';
import { getBudgetSettings, updateBudgetSettings } from './mainAmountService.js';
import { lineItems, type LineItemInput } from './receiptMatching.js';
import { ReceiptError, updateReceipt } from './receiptService.js';
import { SAMPLE_RECEIPT, SAMPLE_RECEIPT_PNG } from './receiptSample.js';

/** A photo on a CPU can take minutes; give up after this long */
const READ_TIMEOUT_MS = 10 * 60 * 1000;
/** Free the model's memory a few minutes after the last receipt (the Ollama app keeps it forever) */
const KEEP_ALIVE = '5m';
/**
 * Room for a photo (a receipt can be a few thousand image tokens), the prompt and the answer.
 * Ollama's default is 4096 (2048 in older versions), which can cut an image off.
 */
const CONTEXT_TOKENS = 8192;
/** Largest reply accepted from Ollama */
const MAX_REPLY_BYTES = 256 * 1024;
const READABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function readerSettings() {
  const s = getBudgetSettings();
  return {
    enabled: s.receiptReaderEnabled === 1,
    url: s.receiptReaderUrl,
    model: s.receiptReaderModel,
  };
}

/** An Ollama address: http(s), a host, no credentials, no path beyond a trailing slash */
export function cleanOllamaUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ReceiptError('That is not an address, e.g. http://ollama-host:11434');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new ReceiptError('The Ollama address must start with http:// or https://');
  if (url.username || url.password)
    throw new ReceiptError('The Ollama address must not contain a user name or password');
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== ''))
    throw new ReceiptError('Give only the Ollama address, without a path');
  return url.origin;
}

export function updateReaderSettings(change: {
  enabled?: boolean;
  url?: string | null;
  model?: string | null;
}) {
  const patch: Record<string, unknown> = {};
  if (change.enabled !== undefined) patch.receiptReaderEnabled = change.enabled ? 1 : 0;
  if (change.url !== undefined)
    patch.receiptReaderUrl = change.url ? cleanOllamaUrl(change.url) : null;
  if (change.model !== undefined) patch.receiptReaderModel = change.model?.trim() || null;
  if (Object.keys(patch).length) updateBudgetSettings(patch);
  const s = readerSettings();
  if (s.enabled && (!s.url || !s.model)) {
    updateBudgetSettings({ receiptReaderEnabled: 0 });
    throw new ReceiptError('Choose the Ollama address and a model before turning reading on');
  }
  return s;
}

async function ollama(base: string, path: string, init: RequestInit & { timeoutMs: number }) {
  const { timeoutMs, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      // An address the owner chose; never follow it somewhere else
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const name = (e as Error).name;
    throw new ReceiptError(
      name === 'TimeoutError' || name === 'AbortError'
        ? 'Ollama took too long to answer'
        : `Ollama could not be reached at ${base}`,
      502,
    );
  }
  const text = await res.text();
  if (text.length > MAX_REPLY_BYTES) throw new ReceiptError('Ollama sent too long a reply', 502);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ReceiptError('Ollama sent a reply that is not JSON', 502);
  }
  if (!res.ok) {
    const error = (body as { error?: unknown })?.error;
    throw new ReceiptError(
      `Ollama: ${typeof error === 'string' ? error.slice(0, 200) : `error ${res.status}`}`,
      502,
    );
  }
  return body;
}

/** The models on an Ollama server, and which of them can read images */
export async function listOllamaModels(rawUrl: string) {
  const base = cleanOllamaUrl(rawUrl);
  const body = z
    .object({
      models: z.array(
        z.object({
          name: z.string(),
          size: z.number().optional(),
          capabilities: z.array(z.string()).optional(),
          details: z.object({ parameter_size: z.string().optional() }).partial().optional(),
        }),
      ),
    })
    .parse(await ollama(base, '/api/tags', { method: 'GET', timeoutMs: 10_000 }));
  return {
    url: base,
    models: body.models.map((m) => ({
      name: m.name,
      size: m.size ?? null,
      parameters: m.details?.parameter_size ?? null,
      // Older Ollama versions don't say; then the owner decides
      vision: m.capabilities ? m.capabilities.includes('vision') : null,
    })),
  };
}

// ─── What is asked for, and what is accepted back ───────────────────────────

const money = { type: ['number', 'null'] };
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    total: money,
    subtotal: money,
    tax: money,
    tip: money,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: 'number' },
          category: { type: ['string', 'null'] },
        },
        required: ['description', 'amount', 'category'],
      },
    },
  },
  required: ['merchant', 'date', 'total', 'subtotal', 'tax', 'tip', 'items'],
};

function prompt(categoryNames: string[]) {
  return [
    'Read this shop receipt and reply with JSON only.',
    'merchant: the shop or business name printed at the top, not the card terminal or payment',
    'provider (EFTPOS, Tyro, Square, Visa and the like are not the merchant).',
    'date: the purchase date as YYYY-MM-DD. Australian receipts write dates day first:',
    '03/04/2026 is 3 April 2026, so it is 2026-04-03.',
    'total: the amount paid, in dollars (e.g. 23.45), including GST and any surcharge.',
    'subtotal: only if a subtotal is printed. Prices on Australian receipts already include GST.',
    'tax: the GST amount printed (often "Total includes GST $2.10"), if any; never add it to the total.',
    'tip: tips, delivery, service fees or card surcharges, if any.',
    'items: each purchased line with its price in dollars as printed, after any quantity',
    '(2 x 1.50 is 3.00). Leave out discounts, subtotals, totals, GST, change and payments.',
    categoryNames.length
      ? `For each item, category is the best fit from this list, exactly as written, or null: ${categoryNames.join('; ')}.`
      : 'category is always null.',
    'Use null for anything not printed on the receipt. Never guess numbers.',
  ].join('\n');
}

const Reply = z.object({
  merchant: z.string().nullish(),
  date: z.string().nullish(),
  total: z.number().nullish(),
  subtotal: z.number().nullish(),
  tax: z.number().nullish(),
  tip: z.number().nullish(),
  items: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number(),
        category: z.string().nullish(),
      }),
    )
    .nullish(),
});

/** Dollars to cents, or null for anything that is not a sensible positive amount */
export function toCents(dollars: number | null | undefined) {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  return cents > 0 && cents <= 1_000_000_00 ? cents : null;
}

/** A real calendar date from 2000 to tomorrow, or null */
export function toDate(text: string | null | undefined, today = new Date()) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) return null;
  const tomorrow = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
  return text >= '2000-01-01' && text <= tomorrow ? text : null;
}

/** What a model's reply says, made safe to store; null where it said nothing usable */
export function parseReply(raw: unknown, categoryIds: Map<string, string>) {
  const r = Reply.parse(raw);
  const merchant = r.merchant?.replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  const items: LineItemInput[] = (r.items ?? [])
    .map((i) => ({
      description: i.description.replace(/\s+/g, ' ').trim().slice(0, 200),
      amount: toCents(i.amount),
      categoryId: (i.category && categoryIds.get(i.category.trim().toLowerCase())) || null,
    }))
    .filter((i): i is LineItemInput => !!i.description && i.amount !== null)
    .slice(0, 200);
  return {
    merchant,
    receiptDate: toDate(r.date),
    total: toCents(r.total),
    subtotal: toCents(r.subtotal),
    tax: toCents(r.tax),
    tip: toCents(r.tip),
    items,
  };
}

// ─── Checking what was read ──────────────────────────────────────────────────

/** Card terminals and payment providers a model may report instead of the shop */
const PAYMENT_PROVIDER =
  /^(eftpos|tyro|square|squareup|stripe|zeller|smartpay|windcave|linkly|adyen|paypal|afterpay|zip pay|visa|mastercard|amex|american express|apple pay|google pay|debit|credit card)\b/i;
/** Items within this much of the total add up (rounding, or rounding cash to 5c) */
const itemsTolerance = (total: number) => Math.max(10, Math.round(total * 0.02));
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Keep only what is consistent: a merchant that isn't the card terminal, tax, tip and subtotal
 * below the total, and items that add up to the total (or the total less any tip, with or
 * without tax, or the printed subtotal). Items that don't add up aren't kept, because a matched transaction
 * would be split by them; what was dropped is said in plain words for the receipt to show.
 */
export function checkRead(read: ReturnType<typeof parseReply>) {
  const notes: string[] = [];
  let { merchant, tax, tip, subtotal, items } = read;
  const { total } = read;
  if (merchant && PAYMENT_PROVIDER.test(merchant)) {
    notes.push(`The merchant was left empty: "${merchant}" looks like the card terminal.`);
    merchant = null;
  }
  if (total !== null) {
    if (tax !== null && tax >= total) {
      notes.push(`The tax (${dollars(tax)}) wasn't kept: it isn't less than the total.`);
      tax = null;
    }
    if (tip !== null && tip >= total) {
      notes.push(`The tip or fees (${dollars(tip)}) weren't kept: not less than the total.`);
      tip = null;
    }
    if (subtotal !== null && subtotal > total) {
      notes.push(`The subtotal (${dollars(subtotal)}) wasn't kept: it is more than the total.`);
      subtotal = null;
    }
    if (items.length) {
      const sum = items.reduce((s, i) => s + i.amount, 0);
      const paid = total - (tip ?? 0);
      // A surcharge may be both an item and the tip, so the whole total counts too
      const fits = [total, paid, paid - (tax ?? 0), subtotal].some(
        (x) => x !== null && Math.abs(sum - x) <= itemsTolerance(total),
      );
      if (!fits) {
        notes.push(
          (items.length === 1
            ? `The item wasn't kept: it comes to ${dollars(sum)}`
            : `The ${items.length} items weren't kept: they add up to ${dollars(sum)}`) +
            `, not the ${dollars(total)} total. ` +
            (items.length === 1 ? 'Add it' : 'Add them') +
            ' by hand, or read it again.',
        );
        items = [];
      }
    }
  }
  return { read: { ...read, merchant, tax, tip, subtotal, items }, notes };
}

/** Spending categories by name (lower case), for the model to choose from */
function categoryChoices() {
  const rows = db
    .select({ id: categories.id, name: categories.name, isIncome: categoryGroups.isIncome })
    .from(categories)
    .innerJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
    .where(eq(categories.hidden, 0))
    .orderBy(asc(categories.sortOrder))
    .all()
    .filter((c) => !c.isIncome);
  const byName = new Map<string, string>();
  for (const c of rows)
    if (!byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c.id);
  return { names: [...new Set(rows.map((c) => c.name))].slice(0, 150), byName };
}

/** Send one photo (base64) to the model and return what it read, made safe to store */
async function askModel(url: string, model: string, image: string) {
  const choices = categoryChoices();
  const body = (await ollama(url, '/api/chat', {
    method: 'POST',
    timeoutMs: READ_TIMEOUT_MS,
    body: JSON.stringify({
      model,
      stream: false,
      // A "thinking" model would reason at length first; reading a receipt needs none of it
      think: false,
      keep_alive: KEEP_ALIVE,
      format: REPLY_SCHEMA,
      options: { temperature: 0, num_ctx: CONTEXT_TOKENS },
      messages: [{ role: 'user', content: prompt(choices.names), images: [image] }],
    }),
  })) as { message?: { content?: unknown } };
  const content = body.message?.content;
  if (typeof content !== 'string') throw new ReceiptError('Ollama sent no answer', 502);
  try {
    return parseReply(JSON.parse(content), choices.byName);
  } catch {
    throw new ReceiptError('The model did not answer in the expected form', 502);
  }
}

// ─── Reading ─────────────────────────────────────────────────────────────────

function setStatus(id: string, readStatus: string | null, readError: string | null = null) {
  db.update(receipts)
    .set({ readStatus, readError, readAt: new Date().toISOString() })
    .where(eq(receipts.id, id))
    .run();
}

/**
 * Read one receipt now. Fields already typed are kept; empty ones are filled, line items only
 * when it has none. The receipt is then saved through updateReceipt, so it is matched and its
 * transaction enriched exactly as if the details had been typed.
 */
export async function readReceiptNow(id: string) {
  const s = readerSettings();
  if (!s.enabled || !s.url || !s.model) throw new ReceiptError('Reading receipts is turned off');
  const row = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!row) throw new ReceiptError('Receipt not found', 404);
  const file = db.select().from(receiptFiles).where(eq(receiptFiles.id, row.fileId)).get();
  if (!file) throw new ReceiptError("This receipt's file is not on this installation", 404);
  if (!READABLE.has(file.mimeType))
    throw new ReceiptError('Only photos (JPEG, PNG, WebP) can be read, not PDFs or HEIC');

  const { read: parsed, notes } = checkRead(
    await askModel(s.url, s.model, Buffer.from(file.data as Buffer).toString('base64')),
  );

  // The owner's typed details win; a receipt edited while it was being read keeps its edits
  const now = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!now) throw new ReceiptError('Receipt not found', 404);
  const change: Parameters<typeof updateReceipt>[1] = {};
  for (const key of ['merchant', 'receiptDate', 'total', 'subtotal', 'tax', 'tip'] as const) {
    const value = parsed[key];
    if (now[key] === null && value !== null) (change as Record<string, unknown>)[key] = value;
  }
  if (parsed.items.length && lineItems(id).length === 0) change.lineItems = parsed.items;
  // Saved with the receipt: what reading left out, for the page to show
  setStatus(id, 'read', notes.length ? notes.join(' ').slice(0, 1000) : null);
  const found = Object.keys(change).length;
  return { ...updateReceipt(id, change), filled: found, notes };
}

// One at a time: a small home server runs one model, and photos queue behind each other
let chain: Promise<unknown> = Promise.resolve();
const queued = new Set<string>();

/** Read a receipt in the background, after the ones already waiting */
export function queueRead(id: string) {
  if (queued.has(id)) return;
  queued.add(id);
  setStatus(id, 'pending');
  chain = chain.then(async () => {
    try {
      await readReceiptNow(id);
    } catch (e) {
      const still = db.select({ id: receipts.id }).from(receipts).where(eq(receipts.id, id)).get();
      if (still) setStatus(id, 'failed', (e as Error).message.slice(0, 300));
    } finally {
      queued.delete(id);
    }
  });
}

/** After an upload: read it if reading is on and it is a photo */
export function readIfEnabled(id: string, mimeType: string) {
  const s = readerSettings();
  if (s.enabled && s.url && s.model && READABLE.has(mimeType)) queueRead(id);
}

/** On startup: receipts left waiting when the server stopped are read again */
export function resumePendingReads() {
  const waiting = db
    .select({ id: receipts.id })
    .from(receipts)
    .where(eq(receipts.readStatus, 'pending'))
    .all();
  const s = readerSettings();
  for (const r of waiting) {
    if (s.enabled && s.url && s.model) queueRead(r.id);
    else setStatus(r.id, null);
  }
  return waiting.length;
}

// ─── Trying a model on the sample receipt ────────────────────────────────────

type SampleRead =
  | { status: 'running'; model: string; startedAt: string }
  | {
      status: 'done';
      model: string;
      startedAt: string;
      seconds: number;
      read: ReturnType<typeof parseReply>;
      expected: typeof SAMPLE_RECEIPT;
      /** Merchant, date, total, tax and every item right */
      correct: { merchant: boolean; date: boolean; total: boolean; tax: boolean; items: number };
    }
  | { status: 'failed'; model: string; startedAt: string; seconds: number; error: string };

let sample: SampleRead | null = null;

export const sampleRead = () => sample;

/**
 * Read the made-up sample receipt with the chosen model, in the background (it can take minutes
 * on a CPU). Nothing in the budget changes; the result says what was read and how long it took.
 */
export function startSampleRead() {
  const s = readerSettings();
  if (!s.url || !s.model) throw new ReceiptError('Choose the Ollama address and a model first');
  if (sample?.status === 'running') return sample;
  const { url, model } = s;
  const startedAt = new Date().toISOString();
  sample = { status: 'running', model, startedAt };
  const began = Date.now();
  chain = chain.then(async () => {
    try {
      const read = await askModel(url, model, SAMPLE_RECEIPT_PNG);
      const norm = (t: string | null) => (t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const items = SAMPLE_RECEIPT.items.filter((want) =>
        read.items.some(
          (got) => got.amount === want.amount && norm(got.description) === norm(want.description),
        ),
      ).length;
      sample = {
        status: 'done',
        model,
        startedAt,
        seconds: Math.round((Date.now() - began) / 1000),
        read,
        expected: SAMPLE_RECEIPT,
        correct: {
          merchant: norm(read.merchant) === norm(SAMPLE_RECEIPT.merchant),
          date: read.receiptDate === SAMPLE_RECEIPT.receiptDate,
          total: read.total === SAMPLE_RECEIPT.total,
          tax: read.tax === SAMPLE_RECEIPT.tax,
          items,
        },
      };
    } catch (e) {
      sample = {
        status: 'failed',
        model,
        startedAt,
        seconds: Math.round((Date.now() - began) / 1000),
        error: (e as Error).message.slice(0, 300),
      };
    }
  });
  return sample;
}

/** For tests: wait until every queued read is done */
export function readsSettled() {
  return chain;
}
