// ar's text as one file of the build, loaded only when ar is chosen (lib/i18n.ts): './ar/<ns>.json' -> keys.
// Its fonts come with it (index.css, Font styles): Noto Sans Arabic for text, Amiri for Classic and Ledger's titles
// (1.7 kB of CSS; the fonts themselves are fetched once text uses them).
import '@fontsource-variable/noto-sans-arabic';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';

export default import.meta.glob<Record<string, unknown>>('./ar/*.json', { eager: true, import: 'default' });
