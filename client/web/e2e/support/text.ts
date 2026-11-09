// What the client says, from its locale files: `text('login:form.logIn')` is "Log in" (en-GB, the tests' locale), and
// `text('game:viewSwitch', {}, 'ar')` the Arabic. Tests find controls by the words a player sees, and rewording a
// string in the locale file doesn't break them. A full locale has every key (locales.test.ts).
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LOCALES = path.resolve(import.meta.dirname, '../../src/locales');

type Tree = { [key: string]: string | Tree };
const namespaces = new Map<string, Tree>();

export function text(key: string, params: Record<string, string | number> = {}, locale = 'en-GB'): string {
  const [ns, rest] = key.split(':');
  if (!ns || !rest) throw new Error(`text('${key}'): expected <namespace>:<key>`);
  const file = path.join(LOCALES, locale, `${ns}.json`);
  let tree = namespaces.get(file);
  if (!tree) {
    tree = JSON.parse(readFileSync(file, 'utf8')) as Tree;
    namespaces.set(file, tree);
  }
  // a flat namespace keyed by ids with dots in them (data-items: 'player.box.present.2'), else a nested path
  let node: string | Tree | undefined = tree[rest];
  if (typeof node !== 'string') {
    node = tree;
    for (const part of rest.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`text('${key}'): no such text in ${locale}`);
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, name: string) => String(params[name] ?? all));
}
