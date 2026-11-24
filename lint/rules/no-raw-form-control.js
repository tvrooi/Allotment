// Guard against raw HTML form controls outside client/src/components/ui/ (Wave G, WAVG-09)
// and native type="number" fields anywhere in client/src (D-14).

const RAW_CONTROLS = new Set(['input', 'select', 'textarea']);
const UI_SEGMENT = /(?:^|\/)client\/src\/components\/ui\//;

function staticTypeValue(opening) {
  const attr = opening.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === 'type');
  if (!attr || !attr.value) return null;
  if (attr.value.type === 'Literal' && typeof attr.value.value === 'string') {
    return attr.value.value;
  }
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value;
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      return expr.quasis[0]?.value.cooked ?? null;
    }
  }
  return null;
}

function matchesFile(filename, allowFile) {
  const normalized = allowFile.replaceAll('\\', '/').replace(/^\.?\//, '');
  return filename === normalized || filename.endsWith(`/${normalized}`);
}

export default {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                element: { enum: ['input', 'select', 'textarea'] },
                reason: { type: 'string' },
              },
              required: ['file', 'element', 'reason'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawControl:
        'Use a shared control from client/src/components/ui/ instead of raw <{{name}}> (Wave G, WAVG-09).',
      numberType: 'Do not use type="number": use NumberField or CurrencyInput (D-14).',
      staleAllow: 'Allowlist entry for <{{name}}> in {{file}} matches nothing; remove it.',
    },
  },
  create(context) {
    const allow = context.options[0]?.allow ?? [];
    const filename = context.filename.replaceAll('\\', '/');
    const inUiFolder = UI_SEGMENT.test(filename);
    const fileEntries = allow.filter((entry) => matchesFile(filename, entry.file));
    const used = new Set();

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;
        const typeVal = name === 'input' || name === 'Input' ? staticTypeValue(node) : null;

        if (typeVal === 'number') {
          context.report({ node, messageId: 'numberType' });
          return;
        }
        if (!RAW_CONTROLS.has(name) || inUiFolder) return;
        if (name === 'input' && typeVal === 'file') return;

        const matchIndex = fileEntries.findIndex((entry) => entry.element === name);
        if (matchIndex !== -1) {
          used.add(matchIndex);
          return;
        }
        context.report({ node, messageId: 'rawControl', data: { name } });
      },
      'Program:exit'(node) {
        for (const [idx, entry] of fileEntries.entries()) {
          if (!used.has(idx)) {
            context.report({
              node,
              messageId: 'staleAllow',
              data: { name: entry.element, file: entry.file },
            });
          }
        }
      },
    };
  },
};
