import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** Under a list cut short (useShortList), a button showing the rows left out; nothing once they're all shown. */
export function ShowMore({ hidden, onMore }: { hidden: number; onMore: () => void }) {
  const { t } = useTranslation('market-panel');
  if (hidden <= 0) return null;
  return (
    <Button variant="ghost" size="sm" className="w-full rounded-none border-t text-xs" onClick={onMore}>
      {t('showMore', { count: hidden })}
    </Button>
  );
}
