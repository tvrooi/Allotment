import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect, open, isoDay } from './fixtures';
import { SAMPLE_RECEIPT_PNG } from '../../server/src/services/receiptSample';

// Reading receipts with a local Ollama model (docs/RECEIPTS-AND-TAX.md §5), against a mock
// Ollama. Made-up receipts only.

let ollama: Server;
let base = '';
const chats: { model: string; images: string[]; think: boolean }[] = [];

test.beforeAll(async () => {
  ollama = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/tags')
        return res.end(
          JSON.stringify({
            models: [
              { name: 'qwen2.5:3b', capabilities: ['completion'] },
              { name: 'qwen3-vl:4b-instruct', capabilities: ['completion', 'vision'] },
            ],
          }),
        );
      if (req.url === '/api/chat') {
        const sent = JSON.parse(body);
        chats.push({ model: sent.model, images: sent.messages[0].images, think: sent.think });
        return res.end(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                merchant: 'Coles',
                date: isoDay(),
                total: 58,
                subtotal: null,
                tax: 5.27,
                // The sample, then the photo; reading it again finds the fees too
                tip: chats.length > 2 ? 2 : null,
                items: [
                  { description: 'Milk', amount: 30, category: 'Groceries' },
                  { description: 'Light globes', amount: 28, category: 'Home Maintenance' },
                ],
              }),
            },
          }),
        );
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });
  await new Promise<void>((resolve) => ollama.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((resolve) => ollama.close(() => resolve())));

test('a photo is read by the local model, filled in and matched', async ({ page, api }) => {
  const card = await api.createAccount('Card', 0, 'credit');
  await api.category('Groceries');
  await api.category('Home Maintenance');
  const shop = await api.createTransaction({
    accountId: card.id,
    date: isoDay(),
    amount: -5_800,
    payeeName: 'COLES 0123',
  });

  await open(page, '/transactions?view=receipts');
  await page.getByRole('button', { name: 'Receipt settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Receipt settings' });
  const reading = settings.getByLabel('Read new photos when they are added');
  // Off, and can't be turned on until there's an address and a model
  await expect(reading).not.toBeChecked();
  await expect(reading).toBeDisabled();
  await settings.getByLabel('Ollama address').fill(`${base}/`);
  await settings.getByRole('button', { name: 'Check' }).click();
  await expect(settings.getByLabel('Ollama address')).toHaveValue(base);
  await settings.getByLabel('Model').selectOption('qwen3-vl:4b-instruct');
  await expect(settings.getByRole('option', { name: 'qwen2.5:3b (text only)' })).toBeAttached();
  await expect(reading).toBeEnabled();
  await reading.check();
  await expect(reading).toBeChecked();
  await expect.poll(async () => (await api.call('GET', '/receipts/reader')).enabled).toBe(true);

  // The sample receipt: read without touching the budget
  await settings.getByRole('button', { name: 'Try a sample receipt' }).click();
  await expect(settings.getByRole('status')).toContainText('qwen3-vl:4b-instruct took');
  await page.keyboard.press('Escape');

  await page.getByLabel('Upload receipts: choose files').setInputFiles({
    name: 'coles.png',
    mimeType: 'image/png',
    buffer: Buffer.from(SAMPLE_RECEIPT_PNG, 'base64'),
  });
  const dialog = page.getByRole('dialog', { name: 'Receipt' });
  await expect(dialog.getByText('coles.png', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Merchant')).toHaveValue('Coles', { timeout: 15_000 });
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(isoDay());
  await expect(dialog.getByLabel('Item 2', { exact: true })).toHaveValue('Light globes');
  await expect(dialog.getByRole('region', { name: 'Matched transaction' })).toBeVisible();
  await expect(
    dialog.getByText('Read automatically: fields you had typed were kept.'),
  ).toBeVisible();

  // Typed but not saved, then Read again: what was typed is saved first, so it is kept
  await dialog.getByLabel('Merchant').fill('Coles Local');
  await dialog.getByRole('button', { name: 'Read again' }).click();
  await expect(dialog.getByLabel('Tip and fees')).toHaveValue('$2', { timeout: 15_000 });
  await expect(dialog.getByLabel('Merchant')).toHaveValue('Coles Local');

  // Sent to the chosen model, as a photo, without "thinking"
  const last = chats.at(-1)!;
  expect(last).toMatchObject({ model: 'qwen3-vl:4b-instruct', think: false });
  expect(last.images).toHaveLength(1);
  const parent = (await api.transactions()).find((t) => t.id === shop.id);
  expect((parent.children as unknown[]).length).toBe(2);
});
