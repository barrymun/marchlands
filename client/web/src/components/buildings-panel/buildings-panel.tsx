import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CityBean } from '@marchlands/api-client';
import { BuildingType } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { INSIDE, OUTSIDE } from '@/components/buildings-panel/constants';
import { Slot } from '@/components/buildings-panel/slot/slot';
import { BuildingDialog } from '@/components/buildings-panel/building-dialog/building-dialog';

export function BuildingsPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  const [selected, setSelected] = useState<number | null>(null);
  // ?building=<position> (from the activity dock) opens that building's dialog
  const [search, setSearch] = useSearchParams();
  const requested = search.get('building');
  const [opened, setOpened] = useState<string | null>(null);
  if (requested != null && requested !== opened) {
    setOpened(requested);
    setSelected(Number(requested));
  }
  useEffect(() => {
    if (requested != null) setSearch((s) => (s.delete('building'), s), { replace: true });
  }, [requested, setSearch]);
  const byPos = new Map(city.buildings.map((b) => [b.positionId, b]));
  const townHall = byPos.get(-1)?.level ?? 0;
  const outerSlots = 10 + 3 * townHall;
  // tag filter: one tag per building type present; with tags selected only those buildings show
  const [tags, setTags] = useState<number[]>([]);
  const typeCounts = new Map<number, number>();
  for (const b of city.buildings) if (b.typeId) typeCounts.set(b.typeId, (typeCounts.get(b.typeId) ?? 0) + 1);
  const typeList = [...typeCounts.entries()].sort((a, b) => buildingName(a[0]).localeCompare(buildingName(b[0])));
  const active = tags.filter((t) => typeCounts.has(t));
  const toggle = (t: number) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const filtered = city.buildings
    .filter((b) => active.includes(b.typeId))
    .sort((a, b) => buildingName(a.typeId).localeCompare(buildingName(b.typeId)) || b.level - a.level || a.positionId - b.positionId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('filter.label')}>
        <Button size="xs" variant={active.length === 0 ? 'default' : 'outline'} onClick={() => setTags([])}>
          {t('filter.showAll')}
        </Button>
        {typeList.map(([typeId, n]) => {
          const on = active.includes(typeId);
          return (
            <Button key={typeId} size="xs" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => toggle(typeId)} className="gap-1">
              {buildingName(typeId)}
              <span className={cn('tabular-nums', on ? 'opacity-80' : 'text-muted-foreground')}>{n}</span>
            </Button>
          );
        })}
      </div>
      {active.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {active.map(buildingName).join(t('common:list.separator'))}{' '}
              <span className="font-normal text-muted-foreground">
                {t('filter.summary', {
                  count: filtered.length,
                  min: Math.min(...filtered.map((b) => b.level)),
                  max: Math.max(...filtered.map((b) => b.level)),
                })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {filtered.map((b) => (
              <Slot key={b.positionId} pos={b.positionId} building={b} onClick={() => setSelected(b.positionId)} />
            ))}
          </CardContent>
        </Card>
      )}
      {active.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('inside.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {[-1, -2].map((pos) => (
              <Slot
                key={pos}
                pos={pos}
                building={byPos.get(pos)}
                onClick={() => setSelected(pos)}
                fixedName={buildingName(pos === -1 ? BuildingType.TOWN_HALL : BuildingType.WALLS)}
              />
            ))}
            {INSIDE.map((pos) => (
              <Slot key={pos} pos={pos} building={byPos.get(pos)} onClick={() => setSelected(pos)} />
            ))}
          </CardContent>
        </Card>
      )}
      {active.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t('fields.title')}{' '}
              <span className="font-normal text-muted-foreground">
                {t('fields.unlocked', { unlocked: outerSlots, total: OUTSIDE.length, level: townHall })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {OUTSIDE.map((pos, i) => (
              <Slot key={pos} pos={pos} building={byPos.get(pos)} locked={i >= outerSlots} onClick={() => setSelected(pos)} />
            ))}
          </CardContent>
        </Card>
      )}
      <BuildingDialog city={city} positionId={selected} building={selected != null ? byPos.get(selected) : undefined} onClose={() => setSelected(null)} />
    </div>
  );
}
