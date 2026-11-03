import { SectionId, TABLES_KEY } from '@/components/stats-panel/section/constants';

/** The sections the player left showing their table, as stored (none when storage can't be read). */
function storedTables(): SectionId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(TABLES_KEY) ?? '[]');
    const ids: readonly string[] = Object.values(SectionId);
    return Array.isArray(raw) ? raw.filter((x): x is SectionId => typeof x === 'string' && ids.includes(x)) : [];
  } catch {
    return [];
  }
}

/** Whether a section was last left showing its table. */
export const readShowTable = (id: SectionId) => storedTables().includes(id);

/** Remembers whether a section shows its table (quietly does nothing when storage can't be written). */
export function storeShowTable(id: SectionId, table: boolean) {
  try {
    const rest = storedTables().filter((x) => x !== id);
    localStorage.setItem(TABLES_KEY, JSON.stringify(table ? [...rest, id] : rest));
  } catch {
    // the choice lasts until the page is left
  }
}
