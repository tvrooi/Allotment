import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuleSplitPart } from '../../types';

vi.mock('../../api/base', () => ({ API_BASE: '/api' }));
vi.mock('../../api/rules', () => ({ testConditions: vi.fn() }));
vi.mock('../../hooks/useConnection', () => ({ useCanSave: () => true }));
vi.mock('./useRuleLookups', () => ({
  useRuleLookups: () => ({
    lookups: { payee: () => undefined, account: () => undefined, category: () => undefined },
    payeeOptions: [],
    accountOptions: [],
    categoryOptions: [],
    tagOptions: [],
    householdOptions: [],
  }),
}));

import { SplitEditor, TagInput } from './RuleEditorModal';

afterEach(() => {
  vi.unstubAllGlobals();
});

const PARTS: RuleSplitPart[] = [
  { kind: 'percent', value: 50, categoryId: null, notes: null },
  { kind: 'percent', value: 50, categoryId: null, notes: null },
];

// Removing a row keeps the next row's key: e2e/tests/rules.spec.ts "removing an invalid split row …" (WR-01).
describe('SplitEditor row keys on plain-HTTP origins (03-07 review-2 CR-01)', () => {
  it('renders without crypto.randomUUID, which only secure contexts have', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect('randomUUID' in globalThis.crypto).toBe(false);
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(SplitEditor, { parts: PARTS, onChange: vi.fn() }),
      ),
    );
    expect(html.match(/aria-label="Remove split"/g)).toHaveLength(2);
  });
});

describe('TagInput field wrapper and chips (WR-05)', () => {
  it('wraps chips (old chip classes) and a borderless Input inside a field-styled focus-within container', () => {
    const html = renderToStaticMarkup(
      createElement(TagInput, { value: ['Aldi'], onChange: vi.fn() }),
    );
    const wrapperClass = html.match(/^<div class="([^"]*)"/)?.[1] ?? '';
    expect(wrapperClass).toContain('border-border');
    expect(wrapperClass).toContain('focus-within:ring-brand-600');
    expect(html).toContain(
      'class="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-surface-alt text-xs text-text"',
    );
    const inputClass = html.match(/<input[^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(inputClass).toContain('border-0');
    expect(inputClass).toContain('bg-transparent');
  });
});
