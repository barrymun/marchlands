// Blank lines between imports (eslint.config.js; import-x/order only sorts, with newlines-between: ignore).
// A file with more than 3 imports has exactly one blank line between import groups and none inside a group; a smaller
// file keeps its imports together, since a gap per group is only noise there. The groups follow import-x/order's:
// stylesheets, node: builtins, packages, workspace packages (@marchlands/…), local (#/…, #test/…, @/…), relative.
// Only imports that follow each other directly with nothing but blank lines between them are checked: a comment or
// a statement between two imports is left alone.

const SPARSE_MAX = 3;

/** The import group of a module specifier. */
function groupOf(source) {
  if (/\.(?:css|scss|sass)$/.test(source)) return 'stylesheet';
  if (source.startsWith('node:')) return 'builtin';
  if (source.startsWith('@marchlands/')) return 'workspace';
  if (/^(?:#|@\/)/.test(source)) return 'local';
  if (source.startsWith('.')) return 'relative';
  return 'package';
}

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: {
      expectedBlank: 'Expected one blank line between the {{prev}} and {{next}} import groups.',
      unexpectedBlank: 'Expected no blank line between imports.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const { text } = context.sourceCode;
        const sparse = node.body.filter((s) => s.type === 'ImportDeclaration').length <= SPARSE_MAX;
        for (let i = 0; i < node.body.length - 1; i++) {
          const cur = node.body[i];
          const next = node.body[i + 1];
          if (cur.type !== 'ImportDeclaration' || next.type !== 'ImportDeclaration') continue;
          const gap = text.slice(cur.range[1], next.range[0]);
          if (gap.trim() !== '') continue;
          // newlines minus the one that ends the first import's line
          const blankLines = (gap.match(/\n/g) ?? []).length - 1;
          const prev = groupOf(cur.source.value);
          const group = groupOf(next.source.value);
          const wantBlank = !sparse && prev !== group;
          if (wantBlank ? blankLines === 1 : blankLines === 0) continue;
          context.report({
            node: next,
            ...(wantBlank ? { messageId: 'expectedBlank', data: { prev, next: group } } : { messageId: 'unexpectedBlank' }),
            fix: (fixer) => fixer.replaceTextRange([cur.range[1], next.range[0]], wantBlank ? '\n\n' : '\n'),
          });
        }
      },
    };
  },
};
