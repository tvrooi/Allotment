import { describe, expect, it } from 'vitest';
import { nextFilesOffset } from './filePages';

const page = (n: number) => ({ documents: Array.from({ length: n }, (_, i) => i) });

describe('nextFilesOffset', () => {
  it('asks for the next page at the next offset, never a growing limit', () => {
    // 600 files in pages of 60: the ninth page starts at 480 and still asks for 60
    const pages = Array.from({ length: 8 }, () => page(60));
    expect(nextFilesOffset(pages, 600)).toBe(480);
  });

  it('stops once every file is loaded', () => {
    expect(nextFilesOffset([page(60), page(40)], 100)).toBeUndefined();
    expect(nextFilesOffset([page(0)], 0)).toBeUndefined();
  });
});
