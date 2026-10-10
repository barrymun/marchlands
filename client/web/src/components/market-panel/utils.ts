import { RESOURCES } from '@/components/market-panel/constants';

export const resLabel = (t: number) => (t === 4 ? 'Gold' : (RESOURCES[t]?.label ?? `#${t}`));

export const fmtPrice = (p: number) => p.toLocaleString('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
