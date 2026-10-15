// (marchlands) The "Attack targets" flow action: a saved army plus each city's own targets, picked by
// typing x,y here or with "Add to farming list" on the Map tab.

import { Swords } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { totalTroops, TROOP_KEYS } from '@marchlands/core';

import { CityTargets } from '@/components/flow-attack/attack-targets-fields/city-targets/city-targets';
import { usePresets } from '@/components/flow-attack/attack-targets-fields/hooks';
import { NewArmy } from '@/components/flow-attack/attack-targets-fields/new-army/new-army';
import type { AttackAction } from '@/components/flow-attack/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlayer } from '@/hooks/use-game';
import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/** Editor fields of an "Attack targets" action: the saved army, then each city's targets. */
export function AttackTargetsFields({
  action,
  onChange,
  cities: targets,
}: {
  action: AttackAction;
  onChange: (a: AttackAction) => void;
  cities: 'all' | number[];
}) {
  const { t } = useTranslation(['flow-attack', 'common']);
  const player = usePlayer();
  const presets = usePresets();
  const [creating, setCreating] = useState(false);
  const castles = (player.data?.castles ?? []).filter((c) => targets === 'all' || targets.includes(c.id));
  const preset = presets.data?.find((p) => p.id === action.presetId);
  const setList = (cityId: number, list: number[]) => onChange({ ...action, targets: { ...action.targets, [String(cityId)]: list } });

  return (
    <div className="grid w-full gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Swords className="size-4 text-muted-foreground" />
        <span>{t('attackTargets.attackWith')}</span>
        <Select value={action.presetId || undefined} onValueChange={(presetId) => onChange({ ...action, presetId })}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder={presets.data?.length ? t('attackTargets.choose') : t('attackTargets.noArmies')} />
          </SelectTrigger>
          <SelectContent>
            {(presets.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {t('common:troops', { count: totalTroops(p.troops), n: fmtExact(totalTroops(p.troops)) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="xs" variant="ghost" onClick={() => setCreating(!creating)}>
          {creating ? t('common:actions.close') : t('attackTargets.newArmy')}
        </Button>
      </div>
      {preset && (
        <p className="text-xs text-muted-foreground">
          {Object.entries(preset.troops)
            .map(([k, n]) => `${fmtExact(n ?? 0)} ${troopName(Number(Object.entries(TROOP_KEYS).find(([, key]) => key === k)?.[0]))}`)
            .join(', ')}
        </p>
      )}
      {creating && (
        <NewArmy
          onSaved={(id) => {
            onChange({ ...action, presetId: id });
            setCreating(false);
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">{t('attackTargets.hint')}</p>
      {castles.map((c) => (
        <CityTargets key={c.id} city={c} list={action.targets[String(c.id)] ?? []} onChange={(list) => setList(c.id, list)} />
      ))}
    </div>
  );
}
