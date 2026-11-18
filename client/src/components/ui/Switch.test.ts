import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Switch } from './Switch';

type Props = Parameters<typeof Switch>[0];
const noop = () => {};
const render = (props: Partial<Props> = {}) =>
  renderToStaticMarkup(
    createElement(Switch, {
      checked: false,
      onCheckedChange: noop,
      'aria-label': 'Sample setting',
      ...props,
    } as Props),
  );

// The track is the visible span after the hidden input; the thumb is the span inside it
const track = (html: string) => html.match(/<span aria-hidden="true" class="([^"]*)"/)?.[1] ?? '';
const thumb = (html: string) =>
  html.match(/<span aria-hidden="true" class="[^"]*"><span class="([^"]*)"/)?.[1] ?? '';

// A type check, run by the client build (tsc -b), not by Vitest: E-03, a Switch without a
// visible label or an aria-label has no accessible name, so its props refuse it
// @ts-expect-error a Switch needs children or an aria-label
export const unnamed = () => createElement(Switch, { checked: false, onCheckedChange: noop });
export const requiredNode = () =>
  // @ts-expect-error a required Switch named only by a React node needs an errorLabel
  createElement(Switch, {
    checked: false,
    onCheckedChange: noop,
    isRequired: true,
    children: createElement('b', null, 'Up sync'),
  });

const input = (html: string) => html.match(/<input([^>]*)>/)?.[1] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

describe('Switch', () => {
  it('an enabled switch is an input with role switch and a brand track when on', () => {
    const html = render({ checked: true });
    expect(html).toMatch(/<input[^>]*role="switch"/);
    expect(html).toMatch(/<input[^>]*checked=""/);
    expect(track(html)).toContain('bg-brand-600');
    expect(thumb(html)).toContain('translate-x-4');
    expect(thumb(html)).toContain('bg-brand-contrast');
  });

  it('an enabled switch that is off has the tertiary track and no brand colour', () => {
    const html = render({ checked: false });
    expect(track(html)).toContain('bg-text-tertiary');
    expect(html).not.toMatch(/bg-brand-/);
    expect(thumb(html)).not.toContain('translate-x-4');
  });

  it.each([false, true])(
    'a disabled switch reads as disabled, with no brand colour or dimming (checked: %s, #264)',
    (checked) => {
      const html = render({ checked, disabled: true });
      expect(html).toMatch(/<input[^>]*disabled=""/);
      expect(html).not.toMatch(/bg-brand-/);
      expect(html).not.toMatch(/opacity-/);
      expect(track(html)).toContain('bg-surface-alt');
      expect(track(html)).toContain('ring-inset');
      expect(track(html)).toContain('ring-border');
      expect(thumb(html)).toContain('bg-text-disabled');
      // The thumb still shows whether the setting is on
      if (checked) expect(thumb(html)).toContain('translate-x-4');
      else expect(thumb(html)).not.toContain('translate-x-4');
    },
  );

  it('a read-only switch has the read-only look and aria-readonly, not the disabled one', () => {
    const off = render({ checked: false, readOnly: true });
    expect(off).toMatch(/<input[^>]*aria-readonly="true"/);
    expect(off).not.toMatch(/<input[^>]*disabled=""/);
    expect(track(off)).toContain('bg-surface-alt');
    expect(track(off)).toContain('cursor-default');
    expect(track(off)).not.toContain('cursor-not-allowed');
    expect(thumb(off)).not.toContain('bg-text-disabled');

    const on = render({ checked: true, readOnly: true });
    expect(track(on)).toContain('bg-text-secondary');
    expect(thumb(on)).toContain('translate-x-4');
    expect(on).not.toMatch(/bg-brand-/);
  });

  it('an invalid switch has a negative ring around its track', () => {
    const html = render({ isInvalid: true });
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(track(html)).toContain('ring-negative');
  });

  it('a visible label names the switch and sits on the side asked for', () => {
    const end = render({ 'aria-label': undefined, children: 'Weekly summary' });
    expect(end).toContain('Weekly summary');
    expect(end).not.toContain('aria-label=');
    expect(end.indexOf('aria-hidden="true"')).toBeLessThan(end.indexOf('Weekly summary'));

    const start = render({
      'aria-label': undefined,
      children: 'Weekly summary',
      labelSide: 'start',
    });
    expect(start.indexOf('Weekly summary')).toBeLessThan(start.indexOf('aria-hidden="true"'));
  });

  // React Aria's hidden input is absolutely placed; an unpositioned label let it sit against the
  // page and made the phone welcome screen scroll as a whole (plan 02-12)
  it('the label is positioned, so the hidden input stays inside it', () => {
    for (const props of [{}, { children: 'Weekly summary', 'aria-label': undefined }])
      expect(render(props)).toMatch(/<label[^>]* class="group relative /);
  });

  it('the hit area is 44 px with or without a visible label', () => {
    for (const html of [render(), render({ 'aria-label': undefined, children: 'Weekly summary' })])
      expect(html).toMatch(/<label[^>]*class="[^"]*min-h-11 min-w-11/);
  });

  it('uses design tokens only, never a hex colour', () => {
    for (const props of [
      {},
      { checked: true },
      { disabled: true },
      { readOnly: true, checked: true },
      { isInvalid: true },
    ])
      expect(render(props)).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  // Plan 02-15's markup, recorded before help text and the error line were added: a Switch given
  // none of the new props must render exactly this, so Welcome.tsx's switches are unchanged
  // (plan 02-12 added `relative` to the label, so the hidden input no longer stretches the page)
  it('a Switch with none of the new props renders the markup it had before them', () => {
    const shapes: Partial<Props>[] = [
      {},
      { checked: true, 'aria-label': undefined, children: 'Weekly summary' },
      { disabled: true, checked: true },
      { readOnly: true },
      { isInvalid: true },
      { labelSide: 'start', className: 'w-full justify-between', children: 'Up sync' },
    ];
    expect(shapes.map((props) => render(props))).toMatchInlineSnapshot(`
      [
        "<div class="contents" data-rac=""><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none justify-center cursor-pointer " data-rac=""><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-label="Sample setting" aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" type="checkbox" data-react-aria-pressable="true" tabindex="0" role="switch"/></span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-text-tertiary  group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-surface "></span></span></label></div>",
        "<div class="contents" data-rac="" data-selected="true"><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none  cursor-pointer " data-rac="" data-selected="true"><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" type="checkbox" data-react-aria-pressable="true" tabindex="0" role="switch" checked=""/></span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-brand-600  group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-brand-contrast translate-x-4"></span></span><span class="min-w-0">Weekly summary</span></label></div>",
        "<div class="contents" data-rac="" data-selected="true" data-disabled="true"><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none justify-center cursor-not-allowed " data-rac="" data-selected="true" data-disabled="true"><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-label="Sample setting" aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" disabled="" type="checkbox" data-react-aria-pressable="true" role="switch" checked=""/></span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-surface-alt ring-1 ring-inset ring-border cursor-not-allowed group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-text-disabled translate-x-4"></span></span></label></div>",
        "<div class="contents" data-rac="" data-readonly="true"><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none justify-center cursor-default " data-rac="" data-readonly="true"><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-label="Sample setting" aria-readonly="true" aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" type="checkbox" data-react-aria-pressable="true" tabindex="0" role="switch"/></span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-surface-alt ring-1 ring-inset ring-border cursor-default group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-text-secondary "></span></span></label></div>",
        "<div class="contents" data-rac="" data-invalid="true"><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none justify-center cursor-pointer " data-rac="" data-invalid="true"><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-label="Sample setting" aria-invalid="true" aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" type="checkbox" data-react-aria-pressable="true" tabindex="0" role="switch"/></span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-text-tertiary ring-1 ring-negative group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-surface "></span></span></label></div>",
        "<div class="contents" data-rac=""><label data-react-aria-pressable="true" class="group relative inline-flex min-h-11 min-w-11 items-center gap-2 [&amp;_input]:outline-none  cursor-pointer w-full justify-between" data-rac=""><span style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"><input aria-label="Sample setting" aria-describedby="react-aria-_R_0_ react-aria-_R_0H1_" type="checkbox" data-react-aria-pressable="true" tabindex="0" role="switch"/></span><span class="min-w-0">Up sync</span><span aria-hidden="true" class="relative block h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none bg-text-tertiary  group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600"><span class="absolute left-1 top-1 size-4 rounded-full transition-transform motion-reduce:transition-none bg-surface "></span></span></label></div>",
      ]
    `);
  });

  it('a required, invalid switch names its plain-text label in the default line', () => {
    const html = render({
      'aria-label': undefined,
      children: 'Weekly summary',
      isRequired: true,
      isInvalid: true,
    });
    expect(attr(input(html), 'required')).toBe('');
    expect(attr(input(html), 'aria-invalid')).toBe('true');
    expect(html).toContain('Turn on Weekly summary to continue');
  });

  it('errorLabel names the subject with its capitals, and an aria-label alone names it too', () => {
    expect(render({ isRequired: true, isInvalid: true, errorLabel: 'Up sync' })).toContain(
      'Turn on Up sync to continue',
    );
    const named = render({ isRequired: true, isInvalid: true });
    expect(named).toContain('Turn on Sample setting to continue');
    expect(named).not.toContain('undefined');
  });

  it("a caller's errorMessage replaces the whole default line", () => {
    const html = render({ isRequired: true, isInvalid: true, errorMessage: 'Needed for sync' });
    expect(html).toContain('Needed for sync');
    expect(html).not.toContain('Turn on');
  });

  it('an invalid switch that is not required shows no error line without a message', () => {
    const html = render({ isInvalid: true });
    expect(html).not.toContain('slot="errorMessage"');
    expect(html).not.toMatch(/text-negative/);
  });

  it("the description and the error are in the input's aria-describedby", () => {
    const html = render({
      isRequired: true,
      isInvalid: true,
      description: 'Checks Up every hour',
    });
    const describedBy = attr(input(html), 'aria-describedby')?.split(' ') ?? [];
    const description = html.match(/id="([^"]*)"[^>]*>Checks Up every hour/)?.[1];
    const error = html.match(/id="([^"]*)"[^>]*>Turn on Sample setting to continue/)?.[1];
    expect(description).toBeTruthy();
    expect(error).toBeTruthy();
    expect(describedBy).toContain(description);
    expect(describedBy).toContain(error);
  });
});
