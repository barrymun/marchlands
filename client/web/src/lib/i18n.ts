// Translations (react-i18next). Every piece of text the client shows lives in src/locales/<locale>/<namespace>.json:
// one namespace per top-level component folder or route (e.g. flows-panel, login), plus `common` for text shared
// across features. en-GB is the source: keys are typed against it (src/i18next.d.ts), and any key missing from
// another locale falls back to it. Text the server sends (errors, flow logs, reports) and game data names
// (troops, buildings, items) are not translated yet.

import i18n, { type BackendModule } from 'i18next';
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
  const [language = ''] = lng.toLowerCase().split('-');
  return LOCALES.find((l) => l.split('-')[0] === language) ?? DEFAULT_LOCALE;
}

// en-GB (the default and the fallback) and the en-US spellings are bundled with the app, but for the screens that load
// on first use (routes/game/constants.ts): their text loads with them, so the first page doesn't carry it. Their
// components read it with useTranslation inside a Suspense boundary, which waits for it. The pattern lists are
// written out because Vite reads them when it builds; LAZY_NAMESPACES names the same files.
// ../locales/en-GB/common.json -> resources['en-GB'].common
const files = import.meta.glob<Record<string, unknown>>(
  [
    '../locales/en-GB/*.json',
    '../locales/en-US/*.json',
    '!../locales/*/{military-panel,flows-panel,map-panel,reports-panel,market-panel,send-army-dialog,stats-panel,heroes-panel,hero-gear,flow-attack,items-panel,plans-panel,factions-panel,research-panel,hero-items-dialog}.json',
  ],
  { eager: true, import: 'default' },
);
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, json] of Object.entries(files)) {
  const [, locale, ns] = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path) ?? [];
  if (locale && ns) (resources[locale] ??= {})[ns] = json;
}

/** The English namespaces of the screens that load on first use, loaded with them (the files left out above). */
const LAZY_NAMESPACES = [
  'military-panel',
  'flows-panel',
  'map-panel',
  'reports-panel',
  'market-panel',
  'send-army-dialog',
  'stats-panel',
  'heroes-panel',
  'hero-gear',
  'flow-attack',
  'items-panel',
  'plans-panel',
  'factions-panel',
  'research-panel',
  'hero-items-dialog',
] as const;
const lazyEnglish = import.meta.glob<Record<string, unknown>>(
  [
    '../locales/{en-GB,en-US}/{military-panel,flows-panel,map-panel,reports-panel,market-panel,send-army-dialog,stats-panel,heroes-panel,hero-gear,flow-attack,items-panel,plans-panel,factions-panel,research-panel,hero-items-dialog}.json',
  ],
  { import: 'default' },
);

// every other locale is one file of the build (src/locales/<locale>.ts), loaded when chosen
const lazyLocales = import.meta.glob<Record<string, Record<string, unknown>>>(['../locales/*.ts', '!../locales/*.test.ts'], { import: 'default' });
const loading = new Map<string, Promise<Record<string, Record<string, unknown>>>>();
const lazyLocalesBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(lng, ns, callback) {
    // a lazy screen's English text (none: an en-US file it doesn't spell differently)
    if (lng === 'en-GB' || lng === 'en-US') {
      const file = lazyEnglish[`../locales/${lng}/${ns}.json`];
      if (!file) return callback(null, {});
      file().then(
        (json) => callback(null, json),
        (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), null),
      );
      return;
    }
    const load = lazyLocales[`../locales/${lng}.ts`];
    if (!load) return callback(null, {});
    let files = loading.get(lng);
    if (!files) {
      files = load();
      loading.set(lng, files);
      files.catch(() => loading.delete(lng)); // a failed download is tried again next time
    }
    files.then(
      (byFile) => callback(null, byFile[`./${lng}/${ns}.json`] ?? {}),
      (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), null),
    );
  },
};

const browser = typeof window !== 'undefined';
if (browser) i18n.use(LanguageDetector);
/** Settles once the detected locale's text has loaded: main.tsx renders after it, so no text flashes in English. */
export const i18nReady = i18n
  .use(lazyLocalesBackend)
  .use(initReactI18next)
  .init({
    resources,
    // the bundled locales above, plus the lazy ones from the backend
    partialBundledLanguages: true,
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

// tests (Node, no browser) read every locale's text synchronously, the lazy screens' too
if (!browser) {
  await i18n.loadLanguages([...LOCALES]);
  await i18n.loadNamespaces([...LAZY_NAMESPACES]);
}

if (browser) {
  const setLang = (lng: string) => document.documentElement.setAttribute('lang', lng);
  setLang(i18n.resolvedLanguage ?? DEFAULT_LOCALE);
  i18n.on('languageChanged', setLang);
}

export { i18n };
