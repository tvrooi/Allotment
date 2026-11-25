import { expect, it } from 'vitest';

it('keeps native number fields out of the client (D-14)', () => {
  const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
    eager: true,
    import: 'default',
    query: '?raw',
  });
  const numberType = /\btype\s*=\s*(?:"number"|'number'|\{\s*["']number["']\s*\})/;
  const hits = Object.entries(sources)
    .filter(([path, source]) => {
      if (path.includes('.test.')) return false;
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      return numberType.test(code);
    })
    .map(([path]) => path)
    .sort();

  expect(hits, 'D-14 requires NumberField for counts and CurrencyInput for money').toEqual([]);
});
