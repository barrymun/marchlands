// ar's text as one file of the build, loaded only when ar is chosen (lib/i18n.ts): './ar/<ns>.json' -> keys.
export default import.meta.glob<Record<string, unknown>>('./ar/*.json', { eager: true, import: 'default' });
