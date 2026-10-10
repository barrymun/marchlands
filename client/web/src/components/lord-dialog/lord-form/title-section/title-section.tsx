import { itemConfig, TITLES, titleOf } from '@marchlands/core';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';

/**
 * Nobility titles: each raises how many cities the lord may own (Civilian 1 … Prince 10) and needs
 * prestige plus medals, which the promotion uses up.
 */
export function TitleSection() {
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const promote = useCommand(
    () => unwrap(api.POST('/api/v1/player/title/promote')),
    () => [qk.player],
    'Promoted',
  );
  if (!info) return null;
  const current = titleOf(info.titleId);
  const next = TITLES[info.titleId + 1];
  const cities = player.data?.castles.length ?? 1;
  const req = next
    ? [
        {
          label: `${next.prestige.toLocaleString('en')} prestige`,
          have: `${Math.floor(info.prestige).toLocaleString('en')}`,
          ok: info.prestige >= next.prestige,
        },
        ...Object.entries(next.medals).map(([id, n]) => ({
          label: `${n} × ${itemConfig(id)?.name ?? id}`,
          have: `${inv.count(id)}`,
          ok: inv.count(id) >= n,
        })),
      ]
    : [];
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Title: {current.name}
        <Badge variant="secondary">
          {cities} / {current.maxCities} cit{current.maxCities === 1 ? 'y' : 'ies'}
        </Badge>
      </div>
      {next ? (
        <>
          <p className="text-xs text-muted-foreground">
            {next.name} raises your city limit to {next.maxCities}. The medals are used up.
          </p>
          <ul className="grid gap-1 text-sm">
            {req.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5">
                {r.ok ? <Check className="size-3.5 text-emerald-600" /> : <X className="size-3.5 text-destructive" />}
                {r.label} <span className="text-xs text-muted-foreground">(have {r.have})</span>
              </li>
            ))}
          </ul>
          <Button size="sm" className="justify-self-start" disabled={!req.every((r) => r.ok) || promote.isPending} onClick={() => promote.mutate(undefined)}>
            Promote to {next.name}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">The highest title: up to {current.maxCities} cities.</p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">All titles</summary>
        <table className="mt-1 w-full tabular-nums">
          <tbody>
            {TITLES.slice(1).map((t) => (
              <tr key={t.id} className={t.id === info.titleId ? 'font-medium text-foreground' : ''}>
                <td className="pr-2">{t.name}</td>
                <td className="pr-2">{t.maxCities} cities</td>
                <td className="pr-2">{t.prestige.toLocaleString('en')} prestige</td>
                <td>
                  {Object.entries(t.medals)
                    .map(([id, n]) => `${n} × ${itemConfig(id)?.name ?? id}`)
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
