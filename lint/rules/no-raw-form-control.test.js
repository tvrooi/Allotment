import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './no-raw-form-control.js';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const pageFile = '/repo/client/src/pages/X.tsx';
const uiFile = '/repo/client/src/components/ui/Z.tsx';
const uiExtraFile = '/repo/client/src/components/uiExtra/Y.tsx';
const uiSiblingFile = '/repo/client/src/components/ui.tsx';

tester.run('no-raw-form-control', rule, {
  valid: [
    {
      name: 'shared Input',
      filename: pageFile,
      code: 'const a = <Input aria-label="Payee" />;',
    },
    {
      name: 'shared Select',
      filename: pageFile,
      code: 'const a = <Select label="Frequency" />;',
    },
    {
      name: 'shared Textarea',
      filename: pageFile,
      code: 'const a = <Textarea aria-label="Notes" />;',
    },
    {
      name: 'shared DatePicker',
      filename: pageFile,
      code: 'const a = <DatePicker label="Date" />;',
    },
    {
      name: 'shared CurrencyInput',
      filename: pageFile,
      code: 'const a = <CurrencyInput aria-label="Amount" />;',
    },
    {
      name: 'file input',
      filename: pageFile,
      code: 'const a = <input type="file" />;',
    },
    {
      name: 'file input with accept',
      filename: pageFile,
      code: 'const a = <input type="file" accept=".pem" />;',
    },
    {
      name: 'braced file input',
      filename: pageFile,
      code: "const a = <input type={'file'} />;",
    },
    {
      name: 'raw input inside components/ui/',
      filename: uiFile,
      code: 'const a = <input type="text" />;',
    },
    {
      name: 'raw select with matching allowlist entry',
      filename: pageFile,
      code: 'const a = <select aria-label="Colour"><option value="a">A</option></select>;',
      options: [
        {
          allow: [
            {
              file: 'client/src/pages/X.tsx',
              element: 'select',
              reason: 'D-17 native colour swatch',
            },
          ],
        },
      ],
    },
  ],
  invalid: [
    {
      name: 'raw input with no type',
      filename: pageFile,
      code: 'const a = <input />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
    {
      name: 'raw text input',
      filename: pageFile,
      code: 'const a = <input type="text" />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
    {
      name: 'raw date input',
      filename: pageFile,
      code: 'const a = <input type="date" />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
    {
      name: 'raw password input',
      filename: pageFile,
      code: 'const a = <input type="password" />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
    {
      name: 'raw select',
      filename: pageFile,
      code: 'const a = <select><option /></select>;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'select' },
        },
      ],
    },
    {
      name: 'raw textarea',
      filename: pageFile,
      code: 'const a = <textarea />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'textarea' },
        },
      ],
    },
    {
      name: 'raw input type="number"',
      filename: pageFile,
      code: 'const a = <input type="number" />;',
      errors: [{ messageId: 'numberType' }],
    },
    {
      name: 'shared Input type="number"',
      filename: pageFile,
      code: 'const a = <Input type="number" />;',
      errors: [{ messageId: 'numberType' }],
    },
    {
      name: 'braced Input type={"number"}',
      filename: pageFile,
      code: "const a = <Input type={'number'} />;",
      errors: [{ messageId: 'numberType' }],
    },
    {
      name: 'raw input type="number" inside components/ui/',
      filename: uiFile,
      code: 'const a = <input type="number" />;',
      errors: [{ messageId: 'numberType' }],
    },
    {
      name: 'stale allowlist entry',
      filename: pageFile,
      code: 'const a = <Input aria-label="Payee" />;',
      options: [
        {
          allow: [
            {
              file: 'client/src/pages/X.tsx',
              element: 'select',
              reason: 'Removed select still listed',
            },
          ],
        },
      ],
      errors: [
        {
          messageId: 'staleAllow',
          data: { name: 'select', file: 'client/src/pages/X.tsx' },
        },
      ],
    },
    {
      name: 'raw input in uiExtra folder outside ui/',
      filename: uiExtraFile,
      code: 'const a = <input />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
    {
      name: 'raw input in ui.tsx sibling file outside ui/',
      filename: uiSiblingFile,
      code: 'const a = <input />;',
      errors: [
        {
          messageId: 'rawControl',
          data: { name: 'input' },
        },
      ],
    },
  ],
});
