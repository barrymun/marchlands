import { useQuery } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CityBean,
  deletePlayerArmyPresetsByPresetIdMutation,
  getPlayerArmyPresetsOptions,
  getPlayerArmyPresetsQueryKey,
  postPlayerArmyPresetsMutation,
} from '@marchlands/api-client';
import { totalTroops, TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommand } from '@/hooks/use-game';
import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/**
 * Saved army compositions (e.g. a layered wave): load one into the form, or save the troops chosen
 * now under a name. Kept on the server per lord, so every city and device sees them.
 */
export function ArmyPresets({
  city,
  troops,
  onLoad,
}: {
  city: CityBean;
  troops: Record<string, number>;
  onLoad: (t: Partial<Record<TroopKey, string>>) => void;
}) {
  const { t } = useTranslation(['send-army-dialog', 'common']);
  const presets = useQuery(getPlayerArmyPresetsOptions());
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [managing, setManaging] = useState(false);
  const save = useCommand(postPlayerArmyPresetsMutation(), () => [getPlayerArmyPresetsQueryKey()], t('common:savedName', { name: name.trim() }));
  const remove = useCommand(deletePlayerArmyPresetsByPresetIdMutation(), () => [getPlayerArmyPresetsQueryKey()], t('presets.deleted'));
  const list = presets.data ?? [];
  const load = (id: string) => {
    setSelected(id);
    const p = list.find((x) => x.id === id);
    if (!p) return;
    // fill in what the city has; note anything it is short of
    const next: Partial<Record<TroopKey, string>> = {};
    const missing: string[] = [];
    for (const [k, n] of Object.entries(p.troops) as [TroopKey, number][]) {
      const have = city.troop[k] ?? 0;
      next[k] = String(Math.min(n, have));
      if (have < n) missing.push(t('presets.shortItem', { n: fmtExact(n - have), unit: troopName(TROOP_ID_BY_KEY[k]) }));
    }
    onLoad(next);
    setShort(missing.length ? t('presets.short', { list: missing.join(t('common:list.separator')) }) : '');
  };
  const hasTroops = Object.keys(troops).length > 0;
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{t('presets.label')}</Label>
        {list.length > 0 && (
          <Button size="xs" variant="ghost" className="h-6 text-xs" onClick={() => setManaging(!managing)}>
            {managing ? t('presets.done') : t('presets.manage')}
          </Button>
        )}
      </div>
      {managing && (
        <ul className="grid gap-1">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
              <span className="min-w-0 truncate">
                {p.name}{' '}
                <span className="text-muted-foreground tabular-nums">
                  · {t('common:troops', { count: totalTroops(p.troops), n: fmtExact(totalTroops(p.troops)) })}
                </span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={t('presets.deleteNamed', { name: p.name })}
                title={t('common:actions.delete')}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { path: { presetId: p.id } },
                    {
                      onSuccess: () => {
                        if (selected === p.id) setSelected('');
                        if (list.length <= 1) setManaging(false);
                      },
                    },
                  )
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Select value={selected} onValueChange={load} disabled={!list.length}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={list.length ? t('presets.loadPlaceholder') : t('presets.emptyPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {list.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {t('presets.option', { name: p.name, count: totalTroops(p.troops), n: fmtExact(totalTroops(p.troops)) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('presets.deleteSelected')}
            disabled={remove.isPending}
            onClick={() => remove.mutate({ path: { presetId: selected } }, { onSuccess: () => (setSelected(''), setShort('')) })}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {short && <p className="text-xs text-amber-600">{short}</p>}
      <div className="flex gap-2">
        <Input className="h-8" placeholder={t('presets.namePlaceholder')} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          disabled={!name.trim() || !hasTroops || save.isPending}
          onClick={() => save.mutate({ body: { name: name.trim(), troops } }, { onSuccess: () => setName('') })}
        >
          <Star /> {t('common:actions.save')}
        </Button>
      </div>
    </div>
  );
}
