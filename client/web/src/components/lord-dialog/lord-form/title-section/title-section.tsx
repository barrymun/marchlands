import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getPlayerQueryKey, postPlayerTitlePromoteMutation } from '@marchlands/api-client';
import { titleOf, TITLES } from '@marchlands/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { fmtExact } from '@/lib/format';
import { itemName, titleName } from '@/lib/game-data';

/**
 * Nobility titles: each raises how many cities the lord may own (Civilian 1 … Prince 10) and needs
 * prestige plus medals, which the promotion uses up.
 */
export function TitleSection() {
  const { t } = useTranslation('lord-dialog');
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const promote = useCommand(postPlayerTitlePromoteMutation(), () => [getPlayerQueryKey()], t('toast.promoted'));
  if (!info) return null;
  const current = titleOf(info.titleId);
  const next = TITLES[info.titleId + 1];
  const cities = player.data?.castles.length ?? 1;
  const req = next
    ? [
        {
          label: t('title.prestige', { amount: fmtExact(next.prestige) }),
          have: fmtExact(info.prestige),
          ok: info.prestige >= next.prestige,
        },
        ...Object.entries(next.medals).map(([id, n]) => ({
          label: t('title.medals', { n, name: itemName(id) }),
          have: `${inv.count(id)}`,
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
                {r.label} <span className="text-xs text-muted-foreground">{t('title.have', { have: r.have })}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" className="justify-self-start" disabled={!req.every((r) => r.ok) || promote.isPending} onClick={() => promote.mutate({})}>
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
                <td className="pr-2">{titleName(title.id)}</td>
                <td className="pr-2">{t('title.maxCities', { count: title.maxCities })}</td>
                <td className="pr-2">{t('title.prestige', { amount: fmtExact(title.prestige) })}</td>
                <td>
                  {Object.entries(title.medals)
                    .map(([id, n]) => t('title.medals', { n, name: itemName(id) }))
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
