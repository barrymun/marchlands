import type { ChartConfig } from '@/components/ui/chart';
import { i18n } from '@/lib/i18n';

export const chartConfig = {
  close: {
    get label() {
      return i18n.t('market-panel:priceHistory.chartLabel');
    },
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;
