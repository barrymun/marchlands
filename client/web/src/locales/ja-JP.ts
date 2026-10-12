// ja-JP's text as one file of the build, loaded only when ja-JP is chosen (lib/i18n.ts): './ja-JP/<ns>.json' -> keys.
export default import.meta.glob<Record<string, unknown>>('./ja-JP/*.json', { eager: true, import: 'default' });
