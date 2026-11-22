// Draws the demo budget's sample receipts and documents and writes them to
// server/src/demo/demoFiles.ts as base64 (the in-browser demo has no files folder: every file is
// in its database). Receipts are small JPEG "photos"; the rest are plain PDFs and a text note.
// The amounts here must match the receipts in server/src/demo/demoBudget.ts (demoBudget.test.ts
// checks the items add up); receipts have no printed date because the demo's dates move with today.
//
// Run from client/ after changing one (needs the e2e Playwright install):
//   node scripts/generate-demo-files.mjs
import { writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('../../e2e/node_modules/playwright');
} catch {
  playwright = require('playwright');
}
const { chromium } = playwright;

const money = (cents) => (cents / 100).toFixed(2);

/** key → what the receipt says; items are [description, cents] */
const RECEIPTS = {
  woolies: {
    store: 'WOOLWORTHS',
    lines: ['Newtown 1142', 'Open 7am to 10pm'],
    items: [
      ['Bananas 1kg', 450],
      ['Free range eggs 12pk', 780],
      ['Sourdough loaf', 650],
      ['Full cream milk 2L', 360],
      ['Chicken thighs 1kg', 1300],
      ['Baby spinach 120g', 400],
      ['Dishwasher tablets 40pk', 1800],
      ['Toothpaste 2pk', 600],
      ['Shampoo 400ml', 950],
    ],
    gst: 305,
    paid: 'EFTPOS  ****4417',
  },
  costwise: {
    store: 'COSTWISE WAREHOUSE',
    lines: ['Warehouse 0487', 'Member 1103 8820 4471'],
    items: [
      ['Toilet paper 36pk', 2199],
      ['Coffee beans 1kg', 3299],
      ['Olive oil 3L', 2999],
      ['Basmati rice 10kg', 1849],
      ['Paper towel 12pk', 1699],
    ],
    gst: 354,
    paid: 'MASTERCARD  ****4417',
  },
  wellway: {
    store: 'WELLWAY CHEMIST',
    lines: ['King St 0921', 'Pharmacist on duty'],
    items: [
      ['Paracetamol 500mg 24pk', 549],
      ['Sunscreen SPF50 200ml', 1499],
    ],
    gst: 136,
    paid: 'EFTPOS  ****2290',
  },
  dailyGrind: {
    store: 'DAILY GRIND COFFEE',
    lines: ['Shop 3, 1142 King St'],
    items: [
      ['Flat white (large)', 520],
      ['Banana bread', 650],
    ],
    gst: 0,
    paid: 'TAP  ****4417',
  },
};

function receiptHtml(r) {
  const total = r.items.reduce((n, [, c]) => n + c, 0);
  const row = (left, right, bold = false) =>
    `<div class="row${bold ? ' bold' : ''}"><span>${left}</span><span>${right}</span></div>`;
  return `<!doctype html><html><head><style>
    body { margin: 0; background: #d9d4cc; }
    .paper { width: 300px; padding: 22px 20px 28px; margin: 14px; background: #fbfaf6;
      font: 13px/1.45 'Courier New', monospace; color: #2b2b2b; box-shadow: 0 2px 8px #0003;
      transform: rotate(-0.8deg); }
    .store { text-align: center; font-weight: 700; font-size: 16px; letter-spacing: 1px; }
    .line { text-align: center; color: #555; }
    .rule { border-top: 1px dashed #888; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .bold { font-weight: 700; font-size: 15px; }
    .foot { text-align: center; margin-top: 14px; color: #555; }
  </style></head><body><div class="paper" id="r">
    <div class="store">${r.store}</div>
    ${r.lines.map((l) => `<div class="line">${l}</div>`).join('')}
    <div class="line">TAX INVOICE</div>
    <div class="rule"></div>
    ${r.items.map(([d, c]) => row(d, money(c))).join('')}
    <div class="rule"></div>
    ${row('TOTAL', `$${money(total)}`, true)}
    ${r.gst ? row('GST included', money(r.gst)) : ''}
    ${row(r.paid, 'APPROVED')}
    <div class="foot">Thank you for shopping with us</div>
  </div></body></html>`;
}

/** A one-page PDF of text lines (Helvetica), uncompressed so it stays readable as text */
function pdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let y = 780;
  const text = [
    `BT /F2 18 Tf 56 ${y} Td (${esc(title)}) Tj ET`,
    ...lines.map((l) => {
      y -= l === '' ? 10 : 18;
      return l === '' ? '' : `BT /F1 11 Tf 56 ${y} Td (${esc(l)}) Tj ET`;
    }),
  ]
    .filter(Boolean)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const DOCUMENTS = {
  laptopInvoice: pdf('Parcel - Tax invoice', [
    'Parcel online store',
    '',
    'Item                                   Qty      Price',
    '14-inch laptop, 16GB / 512GB            1    1,299.00',
    '',
    'Total (GST included)                         $1,299.00',
    'GST                                            118.09',
    '',
    'Paid by Mastercard ****4417',
    'Warranty: 12 months from delivery.',
  ]),
  carInsurance: pdf('Shieldwell Insurance - Certificate of insurance', [
    'Comprehensive car insurance',
    '',
    'Insured: Riley and Sam',
    'Vehicle: 2021 Hatchback',
    'Agreed value: $24,500',
    'Excess: $800 (basic)',
    'Premium: paid monthly by direct debit',
    '',
    'Policy number: SW-4471-2209',
    'Claims: call 13 22 09, any time.',
  ]),
};

const NOTES = {
  threadlineReturn:
    'Returned the rain jacket to Threadline (wrong size).\n' +
    'Refund of $59.95 to come in 5-10 business days, to the Spending card.\n' +
    'Return number TL-88213.\n',
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 356, height: 400 },
  deviceScaleFactor: 1.5,
});
const images = {};
for (const [key, r] of Object.entries(RECEIPTS)) {
  await page.setContent(receiptHtml(r));
  const shot = await page
    .locator('body')
    .screenshot({ type: 'jpeg', quality: 62, animations: 'disabled' });
  images[key] = shot.toString('base64');
  console.log(
    `${key}: ${shot.length} bytes, total ${money(r.items.reduce((n, [, c]) => n + c, 0))}`,
  );
}
await browser.close();

const entries = (record, encode) =>
  Object.entries(record)
    .map(([k, v]) => `  ${k}:\n    '${encode(v)}',`)
    .join('\n');
writeFileSync(
  new URL('../../server/src/demo/demoFiles.ts', import.meta.url),
  `// Generated by client/scripts/generate-demo-files.mjs: the demo budget's sample receipts and
// documents. Don't edit by hand; change them there and run it again.

/** Receipt photos (JPEG), base64 */
export const DEMO_RECEIPT_PHOTOS = {
${entries(images, (v) => v)}
};

/** PDFs, base64 */
export const DEMO_PDFS = {
${entries(DOCUMENTS, (v) => v.toString('base64'))}
};

/** Plain-text notes, base64 */
export const DEMO_NOTES = {
${entries(NOTES, (v) => Buffer.from(v).toString('base64'))}
};
`,
);
