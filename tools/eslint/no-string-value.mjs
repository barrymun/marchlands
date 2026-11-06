// Fixed values are named, never written as strings (AGENTS.md, Shared code): where the code expects one of a fixed set of values
// and a const object names them, this refuses the string, assigned or passed (`pan('left')`, `{ kind: 'apply' }`, `side="own"`).
// It asks the type checker, so it needs type information. no-string-compare (beside it) does the same for comparisons, without types.
//
// A named set is what AGENTS.md describes: a top-level `const X` with a `type X` beside it, whose members are all strings. So what
// isn't one passes by itself: translation keys and namespaces, message codes (msg() types those), and the DOM's and libraries' own
// sets (`type="button"`), unless a const object happens to name every value they allow.

import ts from 'typescript';

const OUTSIDE = /\/node_modules\/|\/generated\/|\/test\/|\.test\.tsx?$|\.d\.ts$/;

/** Every named set a program can see, as value -> where it's named: `left` -> [`PanDirection.LEFT`, `DollSide.LEFT`]. */
function namedValues(program) {
  const checker = program.getTypeChecker();
  const names = new Map();
  for (const file of program.getSourceFiles()) {
    if (OUTSIDE.test(file.fileName)) continue;
    const types = new Set(file.statements.filter(ts.isTypeAliasDeclaration).map((s) => s.name.text));
    for (const statement of file.statements.filter(ts.isVariableStatement)) {
      for (const { name } of statement.declarationList.declarations) {
        if (!ts.isIdentifier(name) || !types.has(name.text)) continue;
        const members = checker.getTypeAtLocation(name).getProperties();
        const values = members.map((m) => [m.name, checker.getTypeOfSymbol(m)]);
        if (!values.length || !values.every(([, type]) => type.isStringLiteral())) continue;
        for (const [key, type] of values) {
          const known = names.get(type.value) ?? [];
          names.set(type.value, [...known, `${name.text}.${key}`]);
        }
      }
    }
  }
  return names;
}

const cache = new WeakMap();
function namedIn(program) {
  if (!cache.has(program)) cache.set(program, namedValues(program));
  return cache.get(program);
}

/** The strings a type allows: `'a' | 'b' | null` -> ['a', 'b']. */
function stringsOf(type) {
  return (type.isUnion() ? type.types : [type]).filter((t) => t.isStringLiteral()).map((t) => t.value);
}

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      named: "Write '{{value}}' by name: {{names}} (AGENTS.md, Fixed values). If something else fixes it, eslint-disable with the reason.",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const named = namedIn(services.program);

    function check(node, value) {
      const names = named.get(value);
      if (!names) return;
      const { parent } = node;
      // not a value: an object's key, what's compared (no-string-compare's), a string in a type, an import's path
      if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
      if (parent.type === 'BinaryExpression' || parent.type === 'SwitchCase' || parent.type === 'TSLiteralType') return;
      if (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration') return;
      const expected = checker.getContextualType(services.esTreeNodeToTSNodeMap.get(node));
      if (!expected) return;
      const allowed = stringsOf(expected);
      if (!allowed.includes(value) || !allowed.every((s) => named.has(s))) return;
      // one string alone is what a generic took from the argument (t('gold')) or an overload's (getContext('2d')), unless it's
      // an object's field, where it's a discriminant (`kind: typeof X.A`)
      if (allowed.length === 1 && parent.type !== 'Property') return;
      context.report({ node, messageId: 'named', data: { value, names: names.join(' or ') } });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) check(node, node.quasis[0].value.cooked);
      },
    };
  },
};
