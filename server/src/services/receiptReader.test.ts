import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Reading receipts with a local Ollama model (docs/RECEIPTS-AND-TAX.md §5). Ollama is mocked;
// made-up receipts only.

const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { eq } = await import('drizzle-orm');
const { db } = await import('../db/index.js');
const {
  accounts,
  budgetSettings,
  categories,
  categoryGroups,
  receiptFiles,
  receiptLineItems,
  receipts,
  tags,
  transactions,
  transactionTags,
} = await import('../db/schema.js');
const { addReceipt, updateReceipt } = await import('./receiptService.js');
const {
  cleanOllamaUrl,
  listOllamaModels,
  parseReply,
  queueRead,
  readIfEnabled,
  readReceiptNow,
  readsSettled,
  resumePendingReads,
  sampleRead,
  startSampleRead,
  toCents,
  toDate,
  updateReaderSettings,
} = await import('./receiptReader.js');

beforeAll(() => migrate(db, { migrationsFolder: './src/db/migrations' }));

const jpeg = (fill: string) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(fill.repeat(32))]);
const pdf = Buffer.from('%PDF-1.4 made up');

beforeEach(() => {
  for (const t of [receiptLineItems, receipts, receiptFiles, transactionTags, tags, transactions])
    db.delete(t).run();
  db.delete(categories).run();
  db.delete(categoryGroups).run();
  db.delete(accounts).run();
  db.delete(budgetSettings).run();
  db.insert(accounts)
    .values({ id: 'card', name: 'Card', type: 'credit', startingBalance: 0 })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'g', name: 'Everyday', sortOrder: 0 },
      { id: 'inc', name: 'Income', sortOrder: 1, isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'groceries', groupId: 'g', name: 'Groceries', sortOrder: 0 },
      { id: 'household', groupId: 'g', name: 'Household', sortOrder: 1 },
      { id: 'salary', groupId: 'inc', name: 'Salary', sortOrder: 0 },
    ])
    .run();
});

afterEach(() => vi.unstubAllGlobals());

const turnOn = () =>
  updateReaderSettings({ enabled: true, url: 'http://ollama.local:11434/', model: 'qwen3-vl:4b' });

/** Ollama answering a chat with this JSON, and remembering what it was sent */
function ollamaSays(reply: unknown) {
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    void init;
    return new Response(JSON.stringify({ message: { content: JSON.stringify(reply) } }), {
      status: 200,
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const coles = {
  merchant: 'Coles Sydney',
  date: '2026-08-01',
  total: 58,
  subtotal: null,
  tax: 5,
  tip: null,
  items: [
    { description: 'Milk', amount: 15, category: 'Groceries' },
    { description: 'Bread', amount: 15, category: 'groceries' },
    { description: 'Detergent', amount: 20, category: 'Household' },
    { description: 'Mystery', amount: 3, category: 'Salary' },
  ],
};

describe('settings', () => {
  it('keeps only an http(s) address with no path or credentials', () => {
    expect(cleanOllamaUrl(' http://76e1-ollama:11434/ ')).toBe('http://76e1-ollama:11434');
    expect(cleanOllamaUrl('https://ollama.example')).toBe('https://ollama.example');
    expect(() => cleanOllamaUrl('ftp://host')).toThrow('http:// or https://');
    expect(() => cleanOllamaUrl('http://user:pw@host')).toThrow('user name or password');
    expect(() => cleanOllamaUrl('http://host/api/chat')).toThrow('without a path');
    expect(() => cleanOllamaUrl('nonsense')).toThrow('not an address');
  });

  it('is off by default, and turns on only with an address and a model', () => {
    expect(updateReaderSettings({})).toEqual({ enabled: false, url: null, model: null });
    expect(() => updateReaderSettings({ enabled: true })).toThrow('address and a model');
    expect(updateReaderSettings({}).enabled).toBe(false);
    expect(turnOn()).toEqual({
      enabled: true,
      url: 'http://ollama.local:11434',
      model: 'qwen3-vl:4b',
    });
  });

  it('lists the models and which can read images', async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            models: [
              { name: 'qwen3-vl:4b-instruct', size: 3, capabilities: ['completion', 'vision'] },
              { name: 'qwen2.5:3b', capabilities: ['completion'] },
              { name: 'old', details: { parameter_size: '7B' } },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const out = await listOllamaModels('http://ollama.local:11434');
    expect(fetch.mock.calls[0][0]).toBe('http://ollama.local:11434/api/tags');
    expect(out.models.map((m) => [m.name, m.vision])).toEqual([
      ['qwen3-vl:4b-instruct', true],
      ['qwen2.5:3b', false],
      ['old', null],
    ]);
  });

  it('says plainly when Ollama cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(listOllamaModels('http://nowhere:11434')).rejects.toThrow(
      'Ollama could not be reached at http://nowhere:11434',
    );
  });
});

describe('what a reply may say', () => {
  it('keeps sensible amounts and real dates only', () => {
    expect([toCents(23.45), toCents(0), toCents(-4), toCents(NaN), toCents(null)]).toEqual([
      2345,
      null,
      null,
      null,
      null,
    ]);
    expect(toCents(0.1 + 0.2)).toBe(30);
    const today = new Date('2026-10-26T00:00:00Z');
    expect(toDate('2026-02-30', today)).toBeNull();
    expect(toDate('14/10/2026', today)).toBeNull();
    expect(toDate('2026-10-27', today)).toBe('2026-10-27');
    expect(toDate('2026-10-28', today)).toBeNull();
    expect(toDate('1999-12-31', today)).toBeNull();
  });

  it('maps categories by name, never to an income category, and drops empty items', () => {
    const byName = new Map([
      ['groceries', 'groceries'],
      ['household', 'household'],
    ]);
    const out = parseReply(
      { ...coles, items: [...coles.items, { description: '  ', amount: 2, category: null }] },
      byName,
    );
    expect(out.items).toEqual([
      { description: 'Milk', amount: 1500, categoryId: 'groceries' },
      { description: 'Bread', amount: 1500, categoryId: 'groceries' },
      { description: 'Detergent', amount: 2000, categoryId: 'household' },
      { description: 'Mystery', amount: 300, categoryId: null },
    ]);
    expect(() => parseReply({ total: 'lots' }, byName)).toThrow();
  });
});

describe('reading a receipt', () => {
  it('sends the photo to the chosen model and fills the empty fields, then matches', async () => {
    turnOn();
    db.insert(transactions)
      .values({
        id: 'shop',
        accountId: 'card',
        date: '2026-08-02',
        amount: -5_800,
        payeeName: 'COLES 0123 SYDNEY',
        createdAt: 'x',
      })
      .run();
    const fetch = ollamaSays(coles);
    const r = addReceipt({ bytes: jpeg('a'), fileName: 'coles.jpg' });
    // Typed already: kept as it is
    updateReceipt(r.id, { merchant: 'Coles' });

    const out = await readReceiptNow(r.id);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://ollama.local:11434/api/chat');
    expect(init.redirect).toBe('error');
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ model: 'qwen3-vl:4b', stream: false, think: false });
    expect(sent.keep_alive).toBe('5m');
    expect(sent.options).toEqual({ temperature: 0, num_ctx: 8192 });
    expect(sent.format.required).toContain('total');
    expect(sent.messages[0].images).toEqual([jpeg('a').toString('base64')]);
    // Spending categories only are offered
    expect(sent.messages[0].content).toContain('Groceries; Household');
    expect(sent.messages[0].content).not.toContain('Salary');

    expect(out).toMatchObject({
      merchant: 'Coles',
      receiptDate: '2026-08-01',
      total: 5_800,
      tax: 500,
      subtotal: null,
      readStatus: 'read',
      transactionId: 'shop',
      matchedBy: 'auto',
    });
    expect(out.lineItems.map((i) => [i.description, i.amount, i.categoryId])).toEqual([
      ['Milk', 1500, 'groceries'],
      ['Bread', 1500, 'groceries'],
      ['Detergent', 2000, 'household'],
      ['Mystery', 300, null],
    ]);
    // Matched and split by category, the same as typed details (the unknown one uncategorised)
    expect(out.outcome?.split).toBe(3);
  });

  it('never replaces line items the owner already typed', async () => {
    turnOn();
    ollamaSays(coles);
    const r = addReceipt({ bytes: jpeg('b') });
    updateReceipt(r.id, {
      lineItems: [{ description: 'Typed', amount: 100, categoryId: null }],
    });
    const out = await readReceiptNow(r.id);
    expect(out.lineItems.map((i) => i.description)).toEqual(['Typed']);
    expect(out.total).toBe(5_800);
  });

  it('reads uploads in the background when on, one at a time, and records failures', async () => {
    // Off: nothing is sent
    const off = ollamaSays(coles);
    const first = addReceipt({ bytes: jpeg('c') });
    readIfEnabled(first.id, first.mimeType);
    await readsSettled();
    expect(off).not.toHaveBeenCalled();

    turnOn();
    readIfEnabled(first.id, first.mimeType);
    const pdfReceipt = addReceipt({ bytes: pdf, fileName: 'r.pdf' });
    readIfEnabled(pdfReceipt.id, pdfReceipt.mimeType);
    const row = () => db.select().from(receipts).where(eq(receipts.id, first.id)).get()!;
    expect(row().readStatus).toBe('pending');
    await readsSettled();
    expect(row()).toMatchObject({ readStatus: 'read', total: 5_800 });
    // A PDF is not sent to the model
    expect(
      db.select().from(receipts).where(eq(receipts.id, pdfReceipt.id)).get()!.readStatus,
    ).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 }),
      ),
    );
    const second = addReceipt({ bytes: jpeg('d') });
    queueRead(second.id);
    await readsSettled();
    expect(db.select().from(receipts).where(eq(receipts.id, second.id)).get()).toMatchObject({
      readStatus: 'failed',
      readError: 'Ollama: model not found',
      total: null,
    });
  });

  it('a reply in the wrong form fails without changing the receipt', async () => {
    turnOn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: { content: 'Sure! It says $5' } }))),
    );
    const r = addReceipt({ bytes: jpeg('e') });
    await expect(readReceiptNow(r.id)).rejects.toThrow('expected form');
    expect(db.select().from(receipts).where(eq(receipts.id, r.id)).get()!.total).toBeNull();
  });

  it('resumes reads left waiting at startup, or clears them when reading is off', async () => {
    const r = addReceipt({ bytes: jpeg('f') });
    db.update(receipts).set({ readStatus: 'pending' }).where(eq(receipts.id, r.id)).run();
    expect(resumePendingReads()).toBe(1);
    expect(db.select().from(receipts).where(eq(receipts.id, r.id)).get()!.readStatus).toBeNull();

    turnOn();
    ollamaSays(coles);
    db.update(receipts).set({ readStatus: 'pending' }).where(eq(receipts.id, r.id)).run();
    resumePendingReads();
    await readsSettled();
    expect(db.select().from(receipts).where(eq(receipts.id, r.id)).get()!.readStatus).toBe('read');
  });
});

describe('trying a model on the sample receipt', () => {
  it('reads the made-up receipt in the background and says what it got right', async () => {
    expect(() => startSampleRead()).toThrow('address and a model');
    turnOn();
    const fetch = ollamaSays({
      merchant: 'Sample Grocer',
      date: '2026-10-14',
      total: 25,
      subtotal: null,
      tax: 1.57,
      tip: null,
      items: [
        { description: 'Bananas 1kg', amount: 4.5, category: 'Groceries' },
        { description: 'Milk 2L', amount: 3.2, category: 'Groceries' },
        { description: 'LED light globe', amount: 12, category: null },
        { description: 'Dish soap', amount: 5.9, category: 'Household' },
      ],
    });
    expect(startSampleRead()).toMatchObject({ status: 'running', model: 'qwen3-vl:4b' });
    await readsSettled();
    expect(sampleRead()).toMatchObject({
      status: 'done',
      correct: { merchant: true, date: true, total: true, tax: true, items: 3 },
    });
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).messages[0].images[0]).toMatch(
      /^iVBORw0KGgo/,
    );
    // The budget is not touched
    expect(db.select().from(receipts).all()).toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'out of memory' }), { status: 500 })),
    );
    startSampleRead();
    await readsSettled();
    expect(sampleRead()).toMatchObject({ status: 'failed', error: 'Ollama: out of memory' });
  });
});
