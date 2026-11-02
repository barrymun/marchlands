import { Check, X } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, getPlayerQueryKey, postPlayerTitlePromoteMutation } from '@marchlands/api-client';
import { titleOf, TITLES } from '@marchlands/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { fmtExact } from '@/lib/format';
import { itemName, titleName } from '@/lib/game-data';

/**
 * Nobility titles: each raises how many cities the lord may own (Civilian 1 … Prince 10) and needs prestige, medals
 * and gold (docs/reference/titles.md); the promotion uses up the medals and the gold, paid from the city in view.
 */
export function TitleSection({ city }: { city?: CityBean }) {
  const { t } = useTranslation(['lord-dialog', 'common']);
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const promote = useCommand(
    postPlayerTitlePromoteMutation(),
    () => [getPlayerQueryKey(), ...(city ? [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })] : [])],
    t('toast.promoted'),
  );
  if (!info) return null;
  const current = titleOf(info.titleId);
  const next = TITLES[info.titleId + 1];
  const cities = player.data?.castles.length ?? 1;
  const req = next
    ? [
        {
          label: t('title.prestige', { amount: fmtExact(next.prestige) }),
          have: t('title.have', { have: fmtExact(info.prestige) }),
          ok: info.prestige >= next.prestige,
        },
        {
          label: t('common:gold', { gold: fmtExact(next.gold) }),
          have: city ? t('title.haveIn', { have: fmtExact(city.resource.gold), city: city.name }) : '',
          ok: !!city && city.resource.gold >= next.gold,
        },
        ...Object.entries(next.medals).map(([id, n]) => ({
          label: t('title.medals', { n, name: itemName(id) }),
          have: t('title.have', { have: inv.count(id) }),
          ok: inv.count(id) >= n,
        })),
      ]
    : [];
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {t('title.current', { name: titleName(current.id) })}
        <Badge variant="secondary">{t('title.cities', { cities, count: current.maxCities })}</Badge>
      </div>
      {next ? (
        <>
          <p className="text-xs text-muted-foreground">{t('title.next', { name: titleName(next.id), max: next.maxCities })}</p>
          <ul className="grid gap-1 text-sm">
            {req.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5">
                {r.ok ? <Check className="size-3.5 text-emerald-600" /> : <X className="size-3.5 text-destructive" />}
                {r.label} <span className="text-xs text-muted-foreground">{r.have}</span>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="justify-self-start"
            disabled={!city || !req.every((r) => r.ok) || promote.isPending}
            onClick={() => city && promote.mutate({ body: { cityId: city.id } })}
          >
            {t('title.promote', { name: titleName(next.id) })}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t('title.highest', { count: current.maxCities })}</p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t('title.all')}</summary>
        <table className="mt-1 w-full tabular-nums">
          <tbody>
            {TITLES.slice(1).map((title) => (
              <tr key={title.id} className={title.id === info.titleId ? 'font-medium text-foreground' : ''}>
                <td className="pe-2 whitespace-nowrap">{titleName(title.id)}</td>
                <td className="pe-2 whitespace-nowrap">{t('title.maxCities', { count: title.maxCities })}</td>
                <td className="pe-2 whitespace-nowrap">{t('title.prestige', { amount: fmtExact(title.prestige) })}</td>
                <td className="pe-2 whitespace-nowrap">{t('common:gold', { gold: fmtExact(title.gold) })}</td>
                <td>
                  {/* each medal kept whole, the line breaking between them */}
                  {Object.entries(title.medals).map(([id, n], i) => (
                    <Fragment key={id}>
                      {i > 0 && ', '}
                      <span className="whitespace-nowrap">{t('title.medals', { n, name: itemName(id) })}</span>
                    </Fragment>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
