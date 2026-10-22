import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** On a phone, Buy and Sell kept at the bottom of the screen, each opening the trade form for that side. */
export function TradeBar({ onTrade, className }: { onTrade: (side: 0 | 1) => void; className?: string }) {
  const { t } = useTranslation('market-panel');
  return (
    <div className={cn('sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t bg-background/95 p-2 backdrop-blur', className)}>
      <Button className="bg-emerald-600 text-white hover:bg-emerald-600/90" onClick={() => onTrade(0)}>
        {t('side.buy')}
      </Button>
      <Button variant="destructive" onClick={() => onTrade(1)}>
        {t('side.sell')}
      </Button>
    </div>
  );
}
