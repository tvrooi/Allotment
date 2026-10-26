import type { Page } from '@playwright/test';

/**
 * What doesn't fit sideways: the document, and every scrolling area of the page (a page
 * that scrolls up and down must not also scroll sideways), plus content that sticks out
 * past the right edge. Strips that scroll only sideways on purpose (tabs, wide tables in
 * an `overflow-x-auto` box) are fine.
 */
export async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    // The page's own scrolling areas (main, and anything else that scrolls up and down)
    const scrollsDown = (el: Element) =>
      /auto|scroll/.test(getComputedStyle(el).overflowY) &&
      (el.tagName === 'MAIN' || el.scrollHeight > el.clientHeight + 2);
    const sidewaysOnly = (el: Element) =>
      /auto|scroll/.test(getComputedStyle(el).overflowX) && !scrollsDown(el);
    const name = (el: Element) =>
      `<${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
    const problems: string[] = [];
    const extra = document.documentElement.scrollWidth - window.innerWidth;
    if (extra > 0) problems.push(`document +${extra}px`);
    // Only the content area scrolls up and down, never the window itself
    const below = document.documentElement.scrollHeight - window.innerHeight;
    if (below > 0) problems.push(`document scrolls down +${below}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (scrollsDown(el) && el.scrollWidth > el.clientWidth + 1) {
        problems.push(`${name(el)} scrolls sideways +${el.scrollWidth - el.clientWidth}px`);
      }
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= window.innerWidth + 1) continue;
      let parent = el.parentElement;
      while (parent && !sidewaysOnly(parent)) parent = parent.parentElement;
      if (!parent) problems.push(`${name(el)} ends at ${Math.round(box.right)}px`);
    }
    return problems.slice(0, 4);
  });
}
