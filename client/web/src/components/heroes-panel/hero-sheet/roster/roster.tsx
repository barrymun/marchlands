import { GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { HeroSummary } from '@/components/hero-summary/hero-summary';
import { useHeroOrder } from '@/components/heroes-panel/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

/** The city's heroes in the player's order (drag a row by its handle), a few lines each (HeroSummary); picking one shows its sheet. */
export function Roster({ city, selected, onSelect }: { city: CityBean; selected: number | null; onSelect: (id: number) => void }) {
  const { t } = useTranslation('heroes-panel');
  const now = useNow();
  const order = useHeroOrder(city);
  const many = city.heros.length > 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('heroes.title')}</CardTitle>
        <CardDescription>{t('heroes.description')}</CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        {city.heros.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">{t('heroes.empty')}</p>
        ) : (
          <ul className="grid gap-1">
            {city.heros.map((h, i) => (
              <li
                key={h.id}
                {...order.row(h.id, i)}
                className={cn(
                  'flex items-center rounded-md transition-opacity',
                  h.id === selected && 'bg-muted',
                  order.dragged(i) && 'opacity-50',
                  order.target(i) && 'ring-2 ring-primary',
                )}
              >
                {many && (
                  <span className="cursor-grab self-stretch py-2 text-muted-foreground" title={t('roster.drag')} {...order.handle(h.id)}>
                    <GripVertical className="size-4" aria-hidden />
                  </span>
                )}
                <HeroSummary
                  hero={h}
                  city={city}
                  now={now}
                  current={h.id === selected}
                  onSelect={() => onSelect(h.id)}
                  onMove={many ? (by) => order.move(i, i + by) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
