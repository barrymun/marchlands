import { useTranslation } from 'react-i18next';
import { RELATION_STYLE } from '@/components/map-panel/constants';
import { cn } from '@/lib/utils';

/** What the outlines on the map mean: your valleys, your city, and other players' valleys by your relation. */
export function MapLegend({ className }: { className?: string }) {
  const { t } = useTranslation('map-panel');
  return (
    <section aria-label={t('legend.title')} className={cn('grid gap-2 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur', className)}>
      <h2 className="font-medium">{t('legend.title')}</h2>
      <div className="flex flex-wrap gap-1">
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-[3px] ring-fuchsia-500 ring-inset">{t('legend.thisCityValleys')}</span>
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-2 ring-violet-300 ring-inset">{t('legend.otherCitiesValleys')}</span>
        <span className="rounded px-1.5 py-0.5 text-[11px] ring-2 ring-amber-400 ring-inset">{t('legend.thisCity')}</span>
        {Object.values(RELATION_STYLE).map((r) => (
          <span key={r.label} className={cn('rounded px-1.5 py-0.5 text-[11px]', r.ring)}>
            {t('legend.relationValleys', { relation: r.label })}
          </span>
        ))}
      </div>
    </section>
  );
}
