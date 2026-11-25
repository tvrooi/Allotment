import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Plant, plantStage, type PlantStage } from './Plant';

const STAGES: PlantStage[] = ['seed', 'seedling', 'bud', 'flower'];
const render = (props: Parameters<typeof Plant>[0]) =>
  renderToStaticMarkup(createElement(Plant, props));

describe('plantStage (#241)', () => {
  it.each([
    [0, 'seed'],
    [32.99, 'seed'],
    [33, 'seedling'],
    [65.99, 'seedling'],
    [66, 'bud'],
    [100, 'bud'],
  ] as const)('%s%% short of the target is a %s', (pct, stage) => {
    expect(plantStage(pct, false)).toBe(stage);
  });

  it('flowers only when the goal is reached, whatever its percent', () => {
    expect(plantStage(40, true)).toBe('flower');
    expect(plantStage(100, true)).toBe('flower');
  });
});

describe('Plant (#241)', () => {
  it.each(STAGES)('the %s is decorative, uses tokens only and is still by default', (stage) => {
    const html = render({ stage });
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('<title');
    expect(html).not.toContain('role=');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(html).not.toContain('animate-');
  });

  it('is 20 px by default and takes a size', () => {
    expect(render({ stage: 'seed' })).toContain('width="20" height="20"');
    expect(render({ stage: 'seedling', size: 16 })).toContain('width="16" height="16"');
  });

  it('leaves out the ground line when asked', () => {
    expect(render({ stage: 'seedling' })).toContain('stroke-border');
    expect(render({ stage: 'seedling', ground: false })).not.toContain('stroke-border');
  });

  it('draws the flower as five Marigold petals around a darker centre', () => {
    const html = render({ stage: 'flower' });
    expect(html.match(/<circle[^>]*fill-brand-500/g)).toHaveLength(5);
    expect(html.match(/fill-brand-700/g)).toHaveLength(1);
  });

  it('opens its petals and one ring only when it blooms', () => {
    const html = render({ stage: 'flower', bloom: true });
    expect(html.match(/animate-bloom(?!-)/g)).toHaveLength(5);
    expect(html.match(/animate-bloom-ring/g)).toHaveLength(1);
    expect(html.match(/data-motion/g)).toHaveLength(6);
  });

  it('grows in from its base when its stage has just changed', () => {
    const html = render({ stage: 'bud', grew: true });
    expect(html).toMatch(/<svg[^>]*animate-grow-in/);
    expect(html).toMatch(/<svg[^>]*data-motion/);
  });

  it('passes test and data attributes through to the svg', () => {
    const html = renderToStaticMarkup(
      createElement(Plant, {
        stage: 'bud',
        'data-testid': 'goal-plant',
        'data-stage': 'bud',
      } as Parameters<typeof Plant>[0]),
    );
    expect(html).toMatch(/<svg[^>]*data-testid="goal-plant"/);
    expect(html).toMatch(/<svg[^>]*data-stage="bud"/);
  });
});
