// About 13 weeks of synthetic Up history for the "rich" mock mode: fortnightly salary, rent,
// groceries, subscriptions and transfers to a Saver, with Up's own category on each purchase.
// Dates count back from today, so forecasts and the payday plan see recent activity. Deterministic
// apart from that. No real bank data.
const money = (valueInBaseUnits: number) => ({ currencyCode: 'AUD', valueInBaseUnits });

type Acct = 'spending' | 'saver';
const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function richUpHistory(now = new Date()) {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));

  const tx: Record<Acct, ReturnType<typeof build>[]> = { spending: [], saver: [] };
  let n = 0;
  function build(
    acct: Acct,
    date: string,
    hour: number,
    description: string,
    cents: number,
    category: string | null,
    transferTo: Acct | null,
    message: string | null,
  ) {
    const iso = `${date}T${String(hour).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}:00+10:00`;
    return {
      id: `rich-${acct}-${++n}`,
      attributes: {
        status: 'SETTLED',
        description,
        message,
        amount: money(cents),
        createdAt: iso,
        settledAt: iso,
        cashback: null,
        note: null,
        roundUp: null,
      },
      relationships: {
        account: { data: { id: acct } },
        transferAccount: { data: transferTo ? { id: transferTo } : null },
        category: { data: category ? { type: 'categories', id: category } : null },
        parentCategory: { data: null },
      },
    };
  }
  const add = (
    acct: Acct,
    date: string,
    hour: number,
    description: string,
    cents: number,
    category: string | null = null,
    transferTo: Acct | null = null,
    message: string | null = null,
  ) => tx[acct].push(build(acct, date, hour, description, cents, category, transferTo, message));

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = new Date(today.getTime() - 90 * DAY);
  const end = new Date(today.getTime() - DAY);
  const lastPay = new Date(today.getTime() - 3 * DAY);
  const paydays = new Set<string>();
  for (let d = lastPay; d >= start; d = new Date(d.getTime() - 14 * DAY)) paydays.add(ymd(d));

  const grocers = ['Woolworths Metro', 'Coles', 'Aldi', 'Harris Farm Markets'];
  const dining: [string, string][] = [
    ['Guzman y Gomez', 'takeaway'],
    ['Mr Wong', 'restaurants-and-cafes'],
    ['Bourke Street Bakery', 'restaurants-and-cafes'],
    ['Messina', 'restaurants-and-cafes'],
    ['Chat Thai', 'restaurants-and-cafes'],
    ['Lord Gladstone Hotel', 'pubs-and-bars'],
  ];
  const shops: [string, string | null][] = [
    ['Kmart', 'homeware-and-appliances'],
    ['Amazon AU', null],
    ['JB Hi-Fi', 'technology'],
    ['Chemist Warehouse', 'health-and-medical'],
    ['Bunnings Warehouse', 'maintenance-and-improvements'],
    ['Uniqlo', 'clothing-and-accessories'],
  ];
  const oneDay = (offset: number) => ymd(new Date(start.getTime() + offset * DAY));
  add(
    'spending',
    oneDay(0),
    9,
    'Transfer from Commonwealth Bank',
    250_000,
    null,
    null,
    'Moving to Up',
  );
  add('saver', oneDay(0), 9, 'Transfer from Commonwealth Bank', 300_000);

  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY)) {
    const s = ymd(d);
    const dow = d.getUTCDay();
    const dom = d.getUTCDate();
    if (paydays.has(s)) {
      add('spending', s, 6, 'ACME LOGISTICS PTY LTD SALARY', 320_000);
      add('spending', s, 8, 'Transfer to Emergency fund', -20_000, null, 'saver');
      add('saver', s, 8, 'Transfer from Spending', 20_000, null, 'spending');
      add(
        'spending',
        ymd(new Date(d.getTime() + DAY)),
        10,
        'Ray White Property Mgmt',
        -90_000,
        'rent-and-mortgage',
        null,
        'Rent unit 4',
      );
    }
    if (dow === 2 || dow === 6)
      add('spending', s, between(9, 19), pick(grocers), -between(3500, 18500), 'groceries');
    if (dow >= 1 && dow <= 5 && rnd() < 0.6)
      add('spending', s, 8, 'Single O Surry Hills', -550, 'restaurants-and-cafes');
    if (dow === 1)
      add('spending', s, 7, 'Transport for NSW Opal', -between(3000, 5000), 'public-transport');
    if (rnd() < 0.12)
      add('spending', s, between(18, 23), 'Uber', -between(1400, 4200), 'taxis-and-share-cars');
    if (rnd() < 0.25) {
      const [name, cat] = pick(dining);
      add('spending', s, between(12, 21), name, -between(1500, 9500), cat);
    }
    if (rnd() < 0.08) {
      const [name, cat] = pick(shops);
      add('spending', s, 14, name, -between(1200, 16000), cat);
    }
    if (dom === 5) add('spending', s, 3, 'Netflix', -1899, 'tv-and-music');
    if (dom === 12) add('spending', s, 3, 'Spotify', -1399, 'tv-and-music');
    if (dom === 20) add('spending', s, 3, 'Telstra', -6500, 'mobile-phone');
    // Up could not place these: no category, or a slug Allotment has no category for
    if (dom === 3) add('spending', s, 12, 'ATM Withdrawal Westpac', -10000);
    if (dom === 9) add('spending', s, 13, 'Service NSW', -9500, 'life-admin');
    if (dom === 15)
      add(
        'spending',
        s,
        11,
        'NRMA Insurance',
        -78_000,
        'car-insurance-and-maintenance',
        null,
        'Car insurance',
      );
    if (dom === 18) add('spending', s, 15, 'JB Hi-Fi', 4900, 'technology', null, 'Refund');
    if (dom === 28) {
      add('spending', s, 9, 'Transfer to Holiday', -50_000, null, 'saver');
      add('saver', s, 9, 'Transfer from Spending', 50_000, null, 'spending');
    }
    if (dom === 1) add('saver', s, 2, 'Interest', between(400, 900));
  }
  const sum = (rows: { attributes: { amount: { valueInBaseUnits: number } } }[]) =>
    rows.reduce((t, r) => t + r.attributes.amount.valueInBaseUnits, 0);
  for (const k of Object.keys(tx) as Acct[])
    tx[k].sort((a, b) => b.attributes.createdAt.localeCompare(a.attributes.createdAt));
  return {
    transactions: tx,
    balances: { spending: sum(tx.spending), saver: sum(tx.saver) },
    lastPayday: ymd(lastPay),
  };
}
