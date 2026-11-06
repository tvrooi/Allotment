// Reading receipts with a vision model the owner chooses (docs/RECEIPTS-AND-TAX.md §5): a model
// server on their own network (the Ollama API), Anthropic or OpenAI with their own API key. Off
// until the owner turns it on. The photo goes only to the provider they chose. What the model
// reads only fills fields that are still empty, and then the receipt is matched like a typed one.
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  categories,
  categoryGroups,
  receiptFiles,
  receiptReaderSecrets,
  receipts,
} from '../db/schema.js';
import { getBudgetSettings, updateBudgetSettings } from './mainAmountService.js';
import { lineItems, type LineItemInput } from './receiptMatching.js';
import { ReceiptError, updateReceipt } from './receiptService.js';
import { SAMPLE_RECEIPT, SAMPLE_RECEIPT_PNG } from './receiptSample.js';
import { addDaysIso, isIsoDay, localDayIso } from '../utils/date.js';

/** A photo on a CPU can take minutes; give up after this long */
const READ_TIMEOUT_MS = 10 * 60 * 1000;
/** Free a local model's memory a few minutes after the last receipt */
const KEEP_ALIVE = '5m';
/**
 * Room for a photo (a receipt can be a few thousand image tokens), the prompt and the answer.
 * A local server's default is often 4096 or less, which can cut an image off.
 */
const CONTEXT_TOKENS = 8192;
/** Largest reply accepted from a model */
const MAX_REPLY_BYTES = 256 * 1024;
const READABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const PROVIDERS = ['local', 'anthropic', 'openai'] as const;
export type Provider = (typeof PROVIDERS)[number];
const PROVIDER_NAME: Record<Provider, string> = {
  local: 'The model server',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

function apiKey() {
  return db.select().from(receiptReaderSecrets).get()?.apiKey ?? null;
}

/** What the owner chose. The API key itself is never sent back, only whether there is one. */
export function readerSettings() {
  const s = getBudgetSettings();
  const provider = (PROVIDERS as readonly string[]).includes(s.receiptReaderProvider)
    ? (s.receiptReaderProvider as Provider)
    : 'local';
  return {
    enabled: s.receiptReaderEnabled === 1,
    provider,
    url: s.receiptReaderUrl,
    model: s.receiptReaderModel,
    hasKey: !!apiKey(),
  };
}

/** Whether the chosen provider has everything it needs */
function ready(s: ReturnType<typeof readerSettings>) {
  if (!s.model) return false;
  return s.provider === 'local' ? !!s.url : s.hasKey;
}

/** A model server address: http(s), a host, no credentials, no path beyond a trailing slash */
export function cleanServerUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ReceiptError('That is not an address, e.g. http://model-server:11434');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new ReceiptError('The server address must start with http:// or https://');
  if (url.username || url.password)
    throw new ReceiptError('The server address must not contain a user name or password');
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== ''))
    throw new ReceiptError('Give only the server address, without a path');
  return url.origin;
}

export function updateReaderSettings(change: {
  enabled?: boolean;
  provider?: Provider;
  url?: string | null;
  model?: string | null;
  /** Write-only; null or empty removes it */
  apiKey?: string | null;
}) {
  const patch: Record<string, unknown> = {};
  if (change.enabled !== undefined) patch.receiptReaderEnabled = change.enabled ? 1 : 0;
  if (change.provider !== undefined) patch.receiptReaderProvider = change.provider;
  if (change.url !== undefined)
    patch.receiptReaderUrl = change.url ? cleanServerUrl(change.url) : null;
  if (change.model !== undefined) patch.receiptReaderModel = change.model?.trim() || null;
  if (change.apiKey !== undefined) {
    const key = change.apiKey?.trim();
    if (key)
      db.insert(receiptReaderSecrets)
        .values({ id: 1, apiKey: key })
        .onConflictDoUpdate({
          target: receiptReaderSecrets.id,
          set: { apiKey: key, updatedAt: new Date().toISOString() },
        })
        .run();
    else db.delete(receiptReaderSecrets).run();
  }
  if (Object.keys(patch).length) updateBudgetSettings(patch);
  const s = readerSettings();
  if (s.enabled && !ready(s)) {
    updateBudgetSettings({ receiptReaderEnabled: 0 });
    throw new ReceiptError(
      s.provider === 'local'
        ? 'Choose the server address and a model before turning reading on'
        : 'Add your API key and a model before turning reading on',
    );
  }
  return readerSettings();
}

async function callModel(
  who: string,
  url: string,
  init: RequestInit & { timeoutMs: number; headers?: Record<string, string> },
) {
  const { timeoutMs, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      // An address the owner chose (or the provider's own); never follow it somewhere else
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  } catch (e) {
    const name = (e as Error).name;
    throw new ReceiptError(
      name === 'TimeoutError' || name === 'AbortError'
        ? `${who} took too long to answer`
        : `${who} could not be reached at ${new URL(url).origin}`,
      502,
    );
  }
  const text = await res.text();
  if (text.length > MAX_REPLY_BYTES) throw new ReceiptError(`${who} sent too long a reply`, 502);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ReceiptError(`${who} sent a reply that is not JSON`, 502);
  }
  if (!res.ok) {
    const error = (body as { error?: unknown })?.error;
    const message =
      typeof error === 'string'
        ? error
        : typeof (error as { message?: unknown })?.message === 'string'
          ? (error as { message: string }).message
          : `error ${res.status}`;
    throw new ReceiptError(`${who}: ${message.slice(0, 200)}`, 502);
  }
  return body;
}

const ollama = (
  base: string,
  path: string,
  init: Omit<RequestInit, 'headers'> & { timeoutMs: number },
) => callModel(PROVIDER_NAME.local, `${base}${path}`, init);

/**
 * Ask the chosen model about one photo and return its text answer. `schema`, when given, asks
 * for JSON in that shape: the local server and Anthropic enforce the schema itself (Anthropic
 * through structured outputs), OpenAI only that the answer is a JSON object.
 */
async function askImage(
  s: ReturnType<typeof readerSettings>,
  text: string,
  image: string,
  mimeType: string,
  schema?: object,
) {
  const model = s.model!;
  if (s.provider === 'anthropic') {
    const body = (await callModel('Anthropic', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      timeoutMs: READ_TIMEOUT_MS,
      headers: { 'x-api-key': apiKey() ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        // Current models think before answering, and that counts towards this limit
        max_tokens: 16_000,
        // No temperature: current Claude models refuse a non-default one with an error
        ...(schema && { output_config: { format: { type: 'json_schema', schema } } }),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: image } },
              { type: 'text', text },
            ],
          },
        ],
      }),
    })) as { stop_reason?: unknown; content?: { type?: string; text?: unknown }[] };
    // Either way the answer may not follow the schema, so it is not read at all
    if (body.stop_reason === 'refusal')
      throw new ReceiptError('Anthropic declined to read this photo', 502);
    if (body.stop_reason === 'max_tokens')
      throw new ReceiptError("Anthropic's answer was cut off before it finished", 502);
    const answer = body.content?.find((c) => c.type === 'text')?.text;
    if (typeof answer !== 'string') throw new ReceiptError('Anthropic sent no answer', 502);
    return answer;
  }
  if (s.provider === 'openai') {
    const body = (await callModel('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      timeoutMs: READ_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${apiKey() ?? ''}` },
      body: JSON.stringify({
        model,
        ...(schema && { response_format: { type: 'json_object' } }),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
            ],
          },
        ],
      }),
    })) as { choices?: { message?: { content?: unknown } }[] };
    const answer = body.choices?.[0]?.message?.content;
    if (typeof answer !== 'string') throw new ReceiptError('OpenAI sent no answer', 502);
    return answer;
  }
  const body = (await ollama(s.url!, '/api/chat', {
    method: 'POST',
    timeoutMs: READ_TIMEOUT_MS,
    body: JSON.stringify({
      model,
      stream: false,
      // A "thinking" model would reason at length first; reading a receipt needs none of it
      think: false,
      keep_alive: KEEP_ALIVE,
      ...(schema && { format: schema }),
      options: { temperature: 0, num_ctx: CONTEXT_TOKENS },
      messages: [{ role: 'user', content: text, images: [image] }],
    }),
  })) as { message?: { content?: unknown } };
  const answer = body.message?.content;
  if (typeof answer !== 'string') throw new ReceiptError('The model server sent no answer', 502);
  return answer;
}

/** The JSON object in a model's answer, allowing for a code fence or a sentence around it */
export function jsonIn(answer: string) {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? answer.slice(start, end + 1) : answer);
}

/** The models on the owner's model server, and which of them can read images */
export async function listServerModels(rawUrl: string) {
  const base = cleanServerUrl(rawUrl);
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
      // Older servers don't say; then the owner decides
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
        additionalProperties: false,
      },
    },
  },
  required: ['merchant', 'date', 'total', 'subtotal', 'tax', 'tip', 'items'],
  // Anthropic's structured outputs accept a schema only when every object is closed
  additionalProperties: false,
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
  if (!isIsoDay(text)) return null;
  const tomorrow = addDaysIso(localDayIso(today), 1);
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
async function askModel(s: ReturnType<typeof readerSettings>, image: string, mimeType: string) {
  const choices = categoryChoices();
  const answer = await askImage(
    s,
    `${prompt(choices.names)}\nReply with one JSON object with exactly these keys: ` +
      'merchant, date, total, subtotal, tax, tip, items (each item: description, amount, category).',
    image,
    mimeType,
    REPLY_SCHEMA,
  );
  try {
    return parseReply(jsonIn(answer), choices.byName);
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
  if (!s.enabled || !ready(s)) throw new ReceiptError('Reading receipts is turned off');
  const row = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!row) throw new ReceiptError('Receipt not found', 404);
  const file = db.select().from(receiptFiles).where(eq(receiptFiles.id, row.fileId)).get();
  if (!file) throw new ReceiptError("This receipt's file is not on this installation", 404);
  if (!READABLE.has(file.mimeType))
    throw new ReceiptError('Only photos (JPEG, PNG, WebP) can be read, not PDFs or HEIC');

  const { read: parsed, notes } = checkRead(
    await askModel(s, Buffer.from(file.data as Buffer).toString('base64'), file.mimeType),
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
  if (s.enabled && ready(s) && READABLE.has(mimeType)) queueRead(id);
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
    if (s.enabled && ready(s)) queueRead(r.id);
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
  if (!ready(s)) throw new ReceiptError('Choose the provider and a model first');
  if (sample?.status === 'running') return sample;
  const model = s.model!;
  const startedAt = new Date().toISOString();
  sample = { status: 'running', model, startedAt };
  const began = Date.now();
  chain = chain.then(async () => {
    try {
      const read = await askModel(s, SAMPLE_RECEIPT_PNG, 'image/png');
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

// ─── Reading any photo's text, for searching Files (fileText.ts) ─────────────

/** Whether the chosen model is set up to read photos */
export function canReadPhotos() {
  const s = readerSettings();
  return s.enabled && ready(s);
}

export const isReadablePhoto = (mimeType: string) => READABLE.has(mimeType);

/** Every word on a photo, as plain text, from the chosen model (never anywhere else) */
export async function transcribePhoto(image: string, mimeType = 'image/png') {
  const s = readerSettings();
  if (!s.enabled || !ready(s)) throw new ReceiptError('Reading receipts is turned off');
  return askImage(
    s,
    'Write out all the text you can read in this image, as plain text, line by line. ' +
      'Write nothing else. If there is no text, answer with nothing.',
    image,
    mimeType,
  );
}

/** Run a model task after the reads already waiting (one model, one task at a time) */
export function afterReads(task: () => Promise<void>) {
  chain = chain.then(task).catch(() => undefined);
  return chain;
}
