// Keeps every locale in step with en-GB, the source: the same namespaces, the same keys (with the plural
// forms each language needs), the same {{placeholders}} and <tags>. en-GB keys are also typed
// (src/i18next.d.ts), so code can only use keys that exist.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, MSG_CODES, msgParamNames } from '@marchlands/core';
import { DEFAULT_LOCALE, LOCALES, OVERRIDE_LOCALES } from '@/lib/i18n';

type Tree = { [key: string]: string | Tree };

const files = import.meta.glob<Tree>('./*/*.json', { eager: true, import: 'default' });
const byLocale: Record<string, Record<string, Tree>> = {};
for (const [file, json] of Object.entries(files)) {
  const [, locale, ns] = file.match(/^\.\/([^/]+)\/([^/]+)\.json$/)!;
  (byLocale[locale] ??= {})[ns] = json;
}

/** Every leaf as 'a.b.c' -> text. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else for (const [kk, vv] of flatten(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, '');
/** The names in `{{name}}` / `{{count, number}}`, without any format. */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => m[1]))].sort();
const tags = (text: string) => [...new Set(text.match(/<\/?\s*[\w-]+\s*\/?>/g) ?? [])].map((t) => t.replace(/[</>\s]/g, '')).sort();
/** The plural forms a language uses (en: one, other; ja: other). */
const pluralForms = (locale: string) => new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

const source = byLocale[DEFAULT_LOCALE];
const namespaces = Object.keys(source).sort();
const full = LOCALES.filter((l) => l !== DEFAULT_LOCALE && !OVERRIDE_LOCALES.includes(l));

describe('locale files', () => {
  it('exist for every locale, with the same namespaces as en-GB', () => {
    for (const locale of LOCALES) expect(Object.keys(byLocale[locale] ?? {}).sort(), locale).toEqual(namespaces);
  });

  it('are registered in i18next.d.ts (so their keys are typed)', () => {
    const decl = fs.readFileSync(path.resolve(import.meta.dirname, '../i18next.d.ts'), 'utf8');
    for (const ns of namespaces) expect(decl, ns).toContain(`/locales/en-GB/${ns}.json'`);
  });

  it('have no empty text', () => {
    for (const locale of LOCALES)
      for (const ns of namespaces) for (const [key, text] of flatten(byLocale[locale][ns])) expect(text.trim(), `${locale} ${ns}:${key}`).not.toBe('');
  });

  it('en-GB gives every plural key all of its English forms', () => {
    for (const ns of namespaces) {
      const keys = [...flatten(source[ns]).keys()];
      for (const key of keys.filter((k) => PLURAL.test(k)))
        for (const form of pluralForms(DEFAULT_LOCALE)) expect(keys, `${ns}:${base(key)}_${form}`).toContain(`${base(key)}_${form}`);
    }
  });

  for (const locale of full) {
    describe(locale, () => {
      it('has every en-GB key, and no others', () => {
        for (const ns of namespaces) {
          const want = [...new Set([...flatten(source[ns]).keys()].map(base))].sort();
          const have = [...new Set([...flatten(byLocale[locale][ns]).keys()].map(base))].sort();
          expect(have, ns).toEqual(want);
        }
      });

      it(`writes plural keys in exactly the forms ${locale} uses`, () => {
        const forms = pluralForms(locale);
        for (const ns of namespaces) {
          const keys = [...flatten(byLocale[locale][ns]).keys()];
          const plural = new Set([...flatten(source[ns]).keys()].filter((k) => PLURAL.test(k)).map(base));
          for (const b of plural) {
            const got = keys.filter((k) => base(k) === b && PLURAL.test(k)).map((k) => k.match(PLURAL)![1]);
            expect(got.sort(), `${ns}:${b}`).toEqual([...forms].sort());
          }
        }
      });

      it('keeps the same {{placeholders}} and <tags> as en-GB', () => {
        for (const ns of namespaces) {
          const src = flatten(source[ns]);
          for (const [key, text] of flatten(byLocale[locale][ns])) {
            const en = src.get(key) ?? src.get(`${base(key)}_other`)!;
            expect(placeholders(text), `${ns}:${key}`).toEqual(placeholders(en));
            expect(tags(text), `${ns}:${key}`).toEqual(tags(en));
          }
        }
      });
    });
  }

  for (const locale of OVERRIDE_LOCALES) {
    describe(locale, () => {
      it('only overrides keys that exist in en-GB, keeping their {{placeholders}} and <tags>', () => {
        for (const ns of namespaces) {
          const src = flatten(source[ns]);
          for (const [key, text] of flatten(byLocale[locale][ns])) {
            expect(src.has(key), `${ns}:${key}`).toBe(true);
            expect(placeholders(text), `${ns}:${key}`).toEqual(placeholders(src.get(key) ?? ''));
            expect(tags(text), `${ns}:${key}`).toEqual(tags(src.get(key) ?? ''));
          }
        }
      });
    });
  }

  describe('server messages (msg-<area> namespaces)', () => {
    const areas = Object.keys(MESSAGES).sort();
    const textOf = (code: string) => {
      const dot = code.indexOf('.');
      const keys = flatten(source[`msg-${code.slice(0, dot)}`] ?? {});
      const name = code.slice(dot + 1);
      return keys.get(name) ?? keys.get(`${name}_other`);
    };

    it('have one namespace per message area, and no others', () => {
      expect(namespaces.filter((ns) => ns.startsWith('msg-')).sort()).toEqual(areas.map((a) => `msg-${a}`));
    });

    it('word every code the server can send, using exactly its params', () => {
      for (const code of MSG_CODES) {
        const text = textOf(code);
        expect(text, `${code} has no en-GB text`).toBeDefined();
        expect(placeholders(text!), code).toEqual([...msgParamNames(code)].sort());
      }
    });

    it('have no text for codes the server no longer sends', () => {
      const codes = new Set<string>(MSG_CODES);
      for (const area of areas)
        for (const key of flatten(source[`msg-${area}`]).keys()) expect(codes.has(`${area}.${base(key)}`), `msg-${area}:${key}`).toBe(true);
    });
  });
});
