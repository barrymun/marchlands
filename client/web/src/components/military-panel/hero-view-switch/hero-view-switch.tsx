import { useTranslation } from 'react-i18next';
import { HERO_VIEWS, type HeroView } from '@/components/heroes-panel/constants';
import { Button } from '@/components/ui/button';

/** The Heroes tab's Sheet · List switch, in the row of the page's tabs. */
export function HeroViewSwitch({ view, onChoose }: { view: HeroView; onChoose: (v: HeroView) => void }) {
  const { t } = useTranslation('heroes-panel');
  return (
    <div className="flex gap-1" role="group" aria-label={t('view.label')}>
      {HERO_VIEWS.map((v) => (
        <Button key={v} size="xs" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v} onClick={() => onChoose(v)}>
          {t(`view.${v}`)}
        </Button>
      ))}
    </div>
  );
}
