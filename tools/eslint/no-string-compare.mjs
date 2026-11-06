// Fixed values are named, never written as strings (AGENTS.md, Shared code): a value a piece of code compares against is a
// const object's, so this refuses `x === 'y'` and `case 'y':`. no-string-value (beside it) refuses a string assigned or passed.
// What something else fixes is left alone: `typeof`, DOM events and keys, HTTP methods, environment variables and message
// codes (which msg() types). A value private to one function may stay, with an eslint-disable saying so.

/** `x.key`, `x.method`, `x.code` and the like, whatever the object: their values are fixed by the platform or typed elsewhere. */
const FIXED_ELSEWHERE = new Set(['key', 'code', 'method', 'visibilityState', 'readyState', 'pointerType', 'NODE_ENV', 'platform']);
/** What events are usually called: their `type` is the DOM's. */
const EVENT_NAMES = new Set(['e', 'ev', 'evt', 'event']);

/** Names the string it holds as fixed by something else, so it's fine to compare with a string. */
function fixedElsewhere(node) {
  if (node.type === 'UnaryExpression' && node.operator === 'typeof') return true;
  if (node.type === 'TSNonNullExpression' || node.type === 'ChainExpression') return fixedElsewhere(node.expression);
  if (node.type !== 'MemberExpression' || node.computed) return false;
  const name = node.property.name;
  if (FIXED_ELSEWHERE.has(name)) return true;
  if (name === 'type' && node.object.type === 'Identifier' && EVENT_NAMES.has(node.object.name)) return true;
  // process.env.X, import.meta.env.X
  return node.object.type === 'MemberExpression' && node.object.property.name === 'env';
}

/** A string with a letter in it: comparing with '' or '-' names nothing. */
const isWord = (node) => node.type === 'Literal' && typeof node.value === 'string' && /\p{L}/u.test(node.value);

export default {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: { named: "Name '{{value}}': use a const object (AGENTS.md, Fixed values). If it's private to one function, eslint-disable with the reason." },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'named', data: { value: node.value } });
    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return;
        if (isWord(node.right) && !fixedElsewhere(node.left)) report(node.right);
        else if (isWord(node.left) && !fixedElsewhere(node.right)) report(node.left);
      },
      SwitchCase(node) {
        if (node.test && isWord(node.test) && !fixedElsewhere(node.parent.discriminant)) report(node.test);
      },
    };
  },
};
