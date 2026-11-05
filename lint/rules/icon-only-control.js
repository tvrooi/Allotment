// A button or link that holds only an icon has no name for a screen reader (audit F-15).
// jsx-a11y's control-has-associated-label trusts any component child, so it never sees a
// lucide icon; this rule does. A control is named when it has aria-label, aria-labelledby or
// title, or its children contain text or an expression that may be text. An icon (imported from
// lucide-react, or named like `Icon`), an <svg>, or a choice between two of them, is not a name.
// Any other component is assumed to render text, so this errs towards missing a case, never
// towards a false alarm.

const NAME_ATTRIBUTES = new Set(['aria-label', 'aria-labelledby', 'title']);
const ICON_NAME = /^(Icon|.*Icon)$/;
const CONTROLS = new Set(['button', 'a', 'Link', 'NavLink']);

function attributeNames(opening) {
  return opening.attributes.map((a) => (a.type === 'JSXAttribute' ? a.name.name : null));
}

function elementName(opening) {
  return opening.name.type === 'JSXIdentifier' ? opening.name.name : null;
}

/** Could this expression, used as a child, render a visible name? */
function expressionMayBeText(expression, icons) {
  if (expression.type === 'JSXEmptyExpression') return false;
  return mayBeText(expression, icons);
}

function mayBeText(node, icons) {
  if (!node) return false;
  switch (node.type) {
    case 'JSXText':
      return node.value.trim() !== '';
    case 'JSXExpressionContainer':
      return expressionMayBeText(node.expression, icons);
    case 'JSXFragment':
      return node.children.some((c) => mayBeText(c, icons));
    case 'JSXElement': {
      const name = elementName(node.openingElement);
      if (name === 'svg' || (name && (icons.has(name) || ICON_NAME.test(name)))) {
        return attributeNames(node.openingElement).some((n) => NAME_ATTRIBUTES.has(n));
      }
      if (name && /^[A-Z]/.test(name)) return true;
      return node.children.some((c) => mayBeText(c, icons));
    }
    case 'Literal':
      return node.value === null || typeof node.value === 'boolean'
        ? false
        : String(node.value).trim() !== '';
    case 'ConditionalExpression':
      return mayBeText(node.consequent, icons) || mayBeText(node.alternate, icons);
    case 'LogicalExpression':
      // `cond && <Icon />`: the left side is a condition, not something shown
      return node.operator === '&&'
        ? mayBeText(node.right, icons)
        : mayBeText(node.left, icons) || mayBeText(node.right, icons);
    default:
      return true;
  }
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unnamed:
        'An icon-only button or link needs a name: add aria-label, or visible text (audit F-15).',
    },
  },
  create(context) {
    const icons = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return;
        for (const spec of node.specifiers) icons.add(spec.local.name);
      },
      JSXElement(node) {
        const name = elementName(node.openingElement);
        if (!name || !CONTROLS.has(name)) return;
        const names = attributeNames(node.openingElement);
        if (names.includes(null)) return; // a spread may carry the name
        if (names.some((n) => NAME_ATTRIBUTES.has(n))) return;
        if (name === 'a' && !names.includes('href')) return;
        if (node.children.some((c) => mayBeText(c, icons))) return;
        context.report({ node, messageId: 'unnamed' });
      },
    };
  },
};
