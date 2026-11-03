import { MAX_STORED, STORE_KEY } from '@/components/plans-panel/plan-card/constants';

/** The ids of the collapsed plans as stored; none when storage is unavailable or holds something else. */
function storedIds(): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

/** Whether the player collapsed this plan's card (open unless they did). */
export const readCollapsed = (planId: number) => storedIds().includes(planId);

/** Remembers a plan's card as collapsed or open. */
export function storeCollapsed(planId: number, collapsed: boolean) {
  const ids = storedIds().filter((id) => id !== planId);
  if (collapsed) ids.push(planId);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ids.slice(-MAX_STORED)));
  } catch {
    /* storage unavailable: the choice lasts until reload */
  }
}
