import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptDetail } from '../../api/tax';

const { state, mutation } = vi.hoisted(() => ({
  state: { receipt: null, canSave: true } as { receipt: ReceiptDetail | null; canSave: boolean },
  mutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }),
}));

vi.mock('../ui/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? createElement('div', { role: 'dialog' }, children) : null,
}));
vi.mock('../../api/tax', () => ({ receiptFileUrl: (id: string) => `/receipts/${id}/file` }));
vi.mock('../../hooks/useTax', () => ({
  useReceipt: () => ({ data: state.receipt }),
  useReaderSettings: () => ({ data: { enabled: true, model: 'qwen3-vl' } }),
  useRefreshAll: () => () => {},
  useReceiptSearch: () => ({ data: [], isFetching: false }),
  useCreateTransactionFromReceipt: mutation,
  useDeleteReceipt: mutation,
  useReadReceipt: mutation,
  useSplitByItems: mutation,
  useUpdateReceipt: mutation,
}));
vi.mock('../../hooks/useAccounts', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
  useCreateCategory: () => ({}),
}));
vi.mock('../../hooks/useConnection', () => ({ useCanSave: () => state.canSave }));
vi.mock('../../hooks/useOffline', () => ({
  useCanAddTransaction: () => ({ allowed: state.canSave, onDevice: false }),
}));
vi.mock('../../hooks/useIsPhone', () => ({ useIsPhone: () => false }));

import { ReceiptEditor, blankItemRow, itemRows, savedItems } from './ReceiptEditor';

function receipt(change: Partial<ReceiptDetail> = {}): ReceiptDetail {
  return {
    id: 'rc-1',
    transactionId: null,
    fileId: 'f-1',
    fileName: 'coles.png',
    mimeType: 'image/png',
    size: 10,
    merchant: 'Coles',
    receiptDate: '2026-11-02',
    total: 5_800,
    subtotal: null,
    tax: null,
    tip: null,
    matchedBy: null,
    notes: null,
    readStatus: null,
    readError: null,
    readAt: null,
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    hasFile: true,
    transaction: null,
    lineItems: [],
    ...change,
  };
}

function render(r: ReceiptDetail) {
  state.receipt = r;
  return renderToStaticMarkup(createElement(ReceiptEditor, { id: r.id, onClose: () => {} }));
}

afterEach(() => {
  state.receipt = null;
  state.canSave = true;
});

describe('ReceiptEditor', () => {
  it('disables the date with the rest of the form while the model reads the receipt (CR-01)', () => {
    // A disabled fieldset reaches native controls only, not React Aria's editable segments
    const dateGroup = (html: string) => html.match(/<[^>]*role="group"[^>]*>/g) ?? [];
    const reading = dateGroup(render(receipt({ readStatus: 'pending' })));
    expect(reading).toHaveLength(1);
    expect(reading[0]).toMatch(/ data-disabled="true"/);

    const idle = dateGroup(render(receipt()));
    expect(idle).toHaveLength(1);
    expect(idle[0]).not.toMatch(/ data-disabled=/);
  });

  it('names an item category by its label and the category shown, Uncategorised for none (WR-01)', () => {
    const html = render(
      receipt({
        lineItems: [
          { id: 'li-1', position: 0, description: 'Milk', amount: 300, categoryId: null },
        ],
      }),
    );
    const trigger = html.match(
      /<button[^>]*aria-label="Item 1 category[^"]*"[^>]*>.*?<\/button>/,
    )?.[0];
    expect(trigger).toBeDefined();
    // The name carries the value, as the old select's value did, so a screen reader hears it
    expect(trigger).toContain('aria-label="Item 1 category: Uncategorised"');
    expect(trigger).toContain('>Uncategorised<');
  });

  it('pauses every button that writes while saving is paused, and says so once (WR-03)', () => {
    const matched = receipt({
      transactionId: 'tx-1',
      matchedBy: 'auto',
      lineItems: [
        { id: 'li-1', position: 0, description: 'Milk', amount: 300, categoryId: 'groceries' },
        { id: 'li-2', position: 1, description: 'Soap', amount: 500, categoryId: 'home' },
      ],
    });
    const writers = ['Read receipt', 'Save', 'Delete receipt', 'Split by items', 'Unmatch'];
    const button = (html: string, name: string) =>
      [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].find(
        (m) => m[1].replace(/<[^>]*>/g, '').trim() === name,
      )?.[0];

    state.canSave = false;
    const paused = render(matched);
    for (const name of writers) expect(button(paused, name), name).toMatch(/ disabled=""/);
    expect(paused.split('Saving is paused until Allotment reconnects.')).toHaveLength(2);

    state.canSave = true;
    const live = render(matched);
    for (const name of writers) expect(button(live, name), name).not.toMatch(/ disabled=""/);
    expect(live).not.toContain('Saving is paused');
  });

  it('keys item rows by item, not by place, and saves them without the keys (WR-04)', () => {
    const rows = itemRows([
      { id: 'li-1', position: 0, description: 'Milk', amount: 300, categoryId: 'groceries' },
      { id: 'li-2', position: 1, description: 'Soap', amount: 500, categoryId: 'home' },
      { id: 'li-3', position: 2, description: 'Bread', amount: 400, categoryId: null },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['li-1', 'li-2', 'li-3']);
    // Removing the first row: the rows after it keep their own keys, so React keeps their state
    expect(rows.filter((_, j) => j !== 0).map((r) => r.key)).toEqual(['li-2', 'li-3']);

    const added = [blankItemRow(), blankItemRow()];
    expect(new Set([...rows, ...added].map((r) => r.key)).size).toBe(5);
    expect(added[0]).toMatchObject({ description: '', amount: 0, categoryId: null });

    expect(savedItems([...rows, ...added])).toEqual([
      { description: 'Milk', amount: 300, categoryId: 'groceries' },
      { description: 'Soap', amount: 500, categoryId: 'home' },
      { description: 'Bread', amount: 400, categoryId: null },
    ]);
  });
});
