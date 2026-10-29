import http from 'http';
import type { AddressInfo } from 'net';
import { richUpHistory } from './upRichData.js';

// No real bank calls or credentials. Also used by server integration tests.
export const UP_TEST_TOKEN = 'up-test-token';
const money = (valueInBaseUnits: number) => ({ currencyCode: 'AUD', valueInBaseUnits });
export function upMockTransaction(
  id: string,
  amount: number,
  status = 'SETTLED',
  accountId = 'spending',
) {
  return {
    id,
    attributes: {
      description: id === 'coffee' ? 'Coffee shop' : id,
      message: null,
      amount: money(amount),
      status,
      createdAt: '2026-10-01T00:30:00+10:00',
      settledAt: status === 'SETTLED' ? '2026-10-02T10:00:00+10:00' : null,
      cashback: null,
      note: null,
    },
    relationships: { account: { data: { id: accountId } }, transferAccount: { data: null } },
  };
}

export async function startUpMock(port = 0) {
  let mode = 'normal';
  let calls = 0;
  let richData: ReturnType<typeof richUpHistory> | undefined;
  const histories = new Map<string, ReturnType<typeof upMockTransaction>[]>();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const send = (body: unknown, status = 200) => {
      if (
        mode === 'round-ups-current' &&
        body &&
        typeof body === 'object' &&
        'data' in body &&
        Array.isArray(body.data)
      ) {
        for (const row of body.data)
          if (row.attributes?.status) {
            row.attributes.createdAt = new Date().toISOString();
            if (row.attributes.status === 'SETTLED')
              row.attributes.settledAt = new Date().toISOString();
          }
      }
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname.startsWith('/__mock/')) {
      if (req.method === 'POST') {
        mode = url.pathname.split('/').pop()!;
        richData = undefined;
      }
      return send({ mode, calls });
    }
    if (req.headers.authorization !== `Bearer ${UP_TEST_TOKEN}`) return send({}, 401);
    calls++;
    if (mode === 'unauthorized') return send({}, 401);
    if (mode === 'rate-limit') return send({}, 429);
    if (mode === 'malformed') return send({ data: [{ id: 1 }] });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 100));
    // A realistic quarter of history with Up's own categories (see upRichData.ts)
    if (mode === 'rich') {
      const rich = (richData ??= richUpHistory());
      if (url.pathname === '/accounts')
        return send({
          data: (['spending', 'saver'] as const).map((id) => ({
            id,
            attributes: {
              displayName: id === 'spending' ? 'Up Everyday' : 'Up Saver',
              accountType: id === 'spending' ? 'TRANSACTIONAL' : 'SAVER',
              ownershipType: 'INDIVIDUAL',
              balance: money(rich.balances[id]),
            },
          })),
          links: { next: null },
        });
      const account = /^\/accounts\/(spending|saver)\/transactions$/.exec(url.pathname)?.[1];
      if (account)
        return send({
          data: rich.transactions[account as 'spending' | 'saver'],
          links: { next: null },
        });
      return send({}, 404);
    }
    const overridden = [...histories].find(
      ([id]) => url.pathname === `/accounts/${id}/transactions`,
    );
    if (overridden) return send({ data: overridden[1], links: { next: null } });
    // Synthetic shape with no separate spending-side round-up debit: the purchase settles
    // after the first sync and the account balance includes its round-up.
    const implicit = mode.startsWith('implicit-round-ups');
    if (implicit && url.pathname === '/accounts/spending/transactions') {
      const purchase = upMockTransaction('later-purchase', -1_760);
      const now = new Date().toISOString();
      return send({
        data: [
          upMockTransaction('salary', 10_000),
          ...(mode === 'implicit-round-ups-start'
            ? []
            : [
                {
                  ...purchase,
                  attributes: {
                    ...purchase.attributes,
                    createdAt: now,
                    settledAt: now,
                    roundUp: { amount: money(-240), boostPortion: money(-200) },
                  },
                },
              ]),
        ],
        links: { next: null },
      });
    }
    const roundUps = mode.startsWith('round-ups');
    if (url.pathname === '/accounts') {
      const a = (id: string, accountType: string, balance: number) => ({
        id,
        attributes: {
          displayName: id === 'spending' ? 'Up Everyday' : 'Up Saver',
          accountType,
          ownershipType: id === 'spending' ? 'INDIVIDUAL' : 'JOINT',
          balance: money(balance),
        },
      });
      return send({
        data: [
          a(
            'spending',
            'TRANSACTIONAL',
            implicit
              ? ({ 'implicit-round-ups-start': 10_000, 'implicit-round-ups-odd': 7_999 }[mode] ??
                  8_000)
              : roundUps
                ? mode === 'round-ups-mismatch'
                  ? 7_444
                  : 7_445
                : 8_500,
          ),
          a('saver', 'SAVER', roundUps ? 5_240 : 5_000),
        ],
        links: { next: null },
      });
    }
    // Synthetic explicit debit/credit posting shape, not captured bank data. The public
    // schema does not prove this is how every round-up is journalled by Up.
    if (roundUps && url.pathname === '/accounts/spending/transactions') {
      const purchase = upMockTransaction('purchase', -1_760);
      const debit = upMockTransaction('round-debit', -240);
      return send({
        data: [
          upMockTransaction('salary', 10_000),
          {
            ...purchase,
            attributes: {
              ...purchase.attributes,
              roundUp: {
                amount: money(-240),
                boostPortion: money(-200),
              },
            },
          },
          {
            ...debit,
            relationships: { ...debit.relationships, transferAccount: { data: { id: 'saver' } } },
          },
          upMockTransaction('held', -555, 'HELD'),
        ],
        links: { next: null },
      });
    }
    if (roundUps && url.pathname === '/accounts/saver/transactions') {
      const credit = upMockTransaction('round-credit', 240, 'SETTLED', 'saver');
      return send({
        data: [
          {
            ...credit,
            relationships: {
              ...credit.relationships,
              transferAccount: { data: { id: 'spending' } },
            },
          },
        ],
        links: { next: null },
      });
    }
    if (url.pathname === '/accounts/spending/transactions') {
      if (mode === 'bad-page')
        return send({ data: [], links: { next: 'https://example.com/steal' } });
      if (mode === 'repeat-page') return send({ data: [], links: { next: req.url } });
      if (url.searchParams.has('cursor')) {
        if (mode === 'page-failure') return send({}, 503);
        return send({ data: [upMockTransaction('held', -500, 'HELD')], links: { next: null } });
      }
      return send({
        data: [upMockTransaction('salary', 10_000), upMockTransaction('coffee', -1_000)],
        links: { next: '/accounts/spending/transactions?cursor=second' },
      });
    }
    if (url.pathname === '/accounts/saver/transactions')
      return send({
        data: [upMockTransaction('interest', 50, 'SETTLED', 'saver')],
        links: { next: null },
      });
    return send({}, 404);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    setMode: (next: string) => {
      mode = next;
      richData = undefined;
      histories.clear();
    },
    setHistory: (id: string, rows: ReturnType<typeof upMockTransaction>[]) => {
      histories.set(id, rows);
    },
    calls: () => calls,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
