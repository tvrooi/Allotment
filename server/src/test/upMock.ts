import http from 'http';
import type { AddressInfo } from 'net';

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
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const send = (body: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname.startsWith('/__mock/')) {
      if (req.method === 'POST') mode = url.pathname.split('/').pop()!;
      return send({ mode, calls });
    }
    if (req.headers.authorization !== `Bearer ${UP_TEST_TOKEN}`) return send({}, 401);
    calls++;
    if (mode === 'unauthorized') return send({}, 401);
    if (mode === 'rate-limit') return send({}, 429);
    if (mode === 'malformed') return send({ data: [{ id: 1 }] });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 100));
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
        data: [a('spending', 'TRANSACTIONAL', 8_500), a('saver', 'SAVER', 5_000)],
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
    },
    calls: () => calls,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
