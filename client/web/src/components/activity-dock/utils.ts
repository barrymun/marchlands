import { STORE_KEY } from '@/components/activity-dock/constants';

export function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v != null) return v === '1';
  } catch {
    /* storage unavailable: fall through to the default */
  }
  // phones start collapsed so the dock does not cover the page
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}
