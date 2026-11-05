import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './icon-only-control.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const header = "import { X, ChevronDown, ChevronRight } from 'lucide-react';\n";
const code = (jsx) => header + jsx;

tester.run('icon-only-control', rule, {
  valid: [
    {
      name: 'aria-label',
      code: code('const a = <button aria-label="Close"><X size={14} /></button>;'),
    },
    { name: 'title', code: code('const a = <button title="Close"><X /></button>;') },
    { name: 'labelledby', code: code('const a = <button aria-labelledby="t"><X /></button>;') },
    { name: 'text beside the icon', code: code('const a = <button><X /> Close</button>;') },
    { name: 'text in a span', code: code('const a = <button><X /><span>Close</span></button>;') },
    { name: 'expression that may be text', code: code('const a = <button><X />{label}</button>;') },
    {
      name: 'text chosen by a condition',
      code: code("const a = <button>{open ? 'Hide' : 'Show'}</button>;"),
    },
    {
      name: 'a component renders the text',
      code: code('const a = <a href="/x"><LinkLabel link={l} /></a>;'),
    },
    { name: 'a fallback value after ??', code: code('const a = <a href="/x">{name ?? \'\'}</a>;') },
    {
      name: 'a spread may carry the name',
      code: code('const a = <button {...props}><X /></button>;'),
    },
    { name: 'an anchor with no href is not a control', code: code('const a = <a><X /></a>;') },
    {
      name: 'an icon that names itself',
      code: code('const a = <button><X aria-label="Close" /></button>;'),
    },
    { name: 'a link with text', code: code('const a = <Link to="/x">Budget</Link>;') },
  ],
  invalid: [
    {
      name: 'a lone icon',
      code: code('const a = <button><X size={14} /></button>;'),
      errors: [{ messageId: 'unnamed' }],
    },
    {
      name: 'a choice between two icons',
      code: code('const a = <button>{open ? <ChevronDown /> : <ChevronRight />}</button>;'),
      errors: [{ messageId: 'unnamed' }],
    },
    {
      name: 'a link around an icon',
      code: code('const a = <Link to="/x"><X /></Link>;'),
      errors: [{ messageId: 'unnamed' }],
    },
    {
      name: 'an icon shown on a condition',
      code: code('const a = <button>{busy && <X />}</button>;'),
      errors: [{ messageId: 'unnamed' }],
    },
    {
      name: 'an svg',
      code: code('const a = <button><svg /></button>;'),
      errors: [{ messageId: 'unnamed' }],
    },
    {
      name: 'an empty button',
      code: code('const a = <button />;'),
      errors: [{ messageId: 'unnamed' }],
    },
  ],
});
