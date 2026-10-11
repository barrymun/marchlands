// Translations (react-i18next). Every piece of text the client shows lives in src/locales/<locale>/<namespace>.json:
// one namespace per top-level component folder or route (e.g. flows-panel, login), plus `common` for text shared
// across features. en-GB is the source: keys are typed against it (src/i18next.d.ts), and any key missing from
// another locale falls back to it. Text the server sends (errors, flow logs, reports) and game data names
// (troops, buildings, items) are not translated yet.

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const LOCALES = ['en-GB', 'en-US', 'ja-JP'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-GB';
/** Locales that hold only the keys whose text differs from en-GB (spelling); every other locale is a full translation. */
export const OVERRIDE_LOCALES: readonly Locale[] = ['en-US'];
/** localStorage key of the chosen locale */
const STORAGE_KEY = 'marchlands-locale';

/** The supported locale for a browser language: exact ('en-US'), else by language ('en-AU' -> en-GB, 'ja' -> ja-JP), else en-GB. */
export function matchLocale(lng: string | undefined): Locale {
  if (!lng) return DEFAULT_LOCALE;
  const exact = LOCALES.find((l) => l.toLowerCase() === lng.toLowerCase());
  if (exact) return exact;
  const language = lng.split('-')[0].toLowerCase();
  return LOCALES.find((l) => l.split('-')[0] === language) ?? DEFAULT_LOCALE;
}

// every locale file, bundled: ../locales/en-GB/common.json -> resources['en-GB'].common
const files = import.meta.glob<Record<string, unknown>>('../locales/*/*.json', { eager: true, import: 'default' });
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, json] of Object.entries(files)) {
  const [, locale, ns] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)!;
  (resources[locale] ??= {})[ns] = json;
}

const browser = typeof window !== 'undefined';
if (browser) i18n.use(LanguageDetector);
void i18n.use(initReactI18next).init({
  resources,
  // tests run in Node, without a browser to detect from
  lng: browser ? undefined : DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: LOCALES,
  defaultNS: 'common',
  ns: Object.keys(resources[DEFAULT_LOCALE] ?? {}),
  interpolation: { escapeValue: false }, // React escapes
  detection: {
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: STORAGE_KEY,
    caches: ['localStorage'],
    convertDetectedLanguage: matchLocale,
  },
});

if (browser) {
  const setLang = (lng: string) => document.documentElement.setAttribute('lang', lng);
  setLang(i18n.resolvedLanguage ?? DEFAULT_LOCALE);
  i18n.on('languageChanged', setLang);
}

export { i18n };
