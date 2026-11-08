// es's text as one file of the build, loaded only when es is chosen (lib/i18n.ts): './es/<ns>.json' -> keys.
export default import.meta.glob<Record<string, unknown>>('./es/*.json', { eager: true, import: 'default' });
