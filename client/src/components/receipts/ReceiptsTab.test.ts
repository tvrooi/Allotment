import { describe, expect, it, vi } from 'vitest';

// The tab's module imports the API client, which reads window; only the pure helpers are tested
vi.mock('../../api/tax', () => ({}));
vi.mock('../../hooks/useTax', () => ({}));
vi.mock('../tax/ReceiptsSection', () => ({}));
vi.mock('./ReceiptEditor', () => ({}));

import { NO_MODEL, localModelItems, localModelPick } from './ReceiptsTab';

describe('the local model field (WR-02)', () => {
  it('offers "Choose a model…" first, as the old select did, then the models with their notes', () => {
    expect(
      localModelItems([
        { name: 'qwen3-vl:4b-instruct', size: null, parameters: null, vision: true },
        { name: 'qwen2.5:3b', size: null, parameters: null, vision: false },
        { name: 'llava', size: null, parameters: null, vision: null },
      ]),
    ).toEqual([
      { value: NO_MODEL, label: 'Choose a model…' },
      { value: 'qwen3-vl:4b-instruct', label: 'qwen3-vl:4b-instruct (reads images)' },
      { value: 'qwen2.5:3b', label: 'qwen2.5:3b (text only)' },
      { value: 'llava', label: 'llava' },
    ]);
  });

  it('"Choose a model…" unsets the model, a model saves its name, emptied text saves nothing', () => {
    expect(localModelPick(NO_MODEL)).toBeNull();
    expect(localModelPick('qwen2.5:3b')).toBe('qwen2.5:3b');
    expect(localModelPick('')).toBeUndefined();
  });
});
