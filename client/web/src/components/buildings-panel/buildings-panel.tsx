import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import type { BuildingBean, CityBean } from '@marchlands/api-client';
import { isOuterPosition } from '@marchlands/core';

import { BuildingDialog } from '@/components/buildings-panel/building-dialog/building-dialog';
import { CITY_VIEWS, FLOATING, OUTSIDE, TOWN_VIEW_QUERY } from '@/components/buildings-panel/constants';
import { IsoCity } from '@/components/buildings-panel/iso-city/iso-city';
import { IsoFields } from '@/components/buildings-panel/iso-fields/iso-fields';
import { Slot } from '@/components/buildings-panel/slot/slot';
import type { CityView } from '@/components/buildings-panel/types';
import { fieldSlots, readView, saveView } from '@/components/buildings-panel/utils';
import { WalledCity } from '@/components/buildings-panel/walled-city/walled-city';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMediaQuery } from '@/hooks/use-media-query';
import { buildingName } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/**
 * The city's buildings in one area: inside the walls (the Town view) or the fields outside them (the Fields view). From
 * md up the isometric scene fills the view (drag, zoom), with the title, the tags that pick out buildings by type and
 * the Scene · Grid switch floating over it; the tags light up the buildings they pick and dim the rest. On a phone, or
 * with Grid chosen, the buildings show as cards that scroll, and the tags list only the buildings they pick. A building
 * opens in its dialog, also from `?building=<position>` (the activity dock).
 */
export function BuildingsPanel({ city, area }: { city: CityBean; area: 'inside' | 'fields' }) {
  const { t } = useTranslation(['buildings-panel', 'common']);
  const [selected, setSelected] = useState<number | null>(null);
  const [chosen, setChosen] = useState<CityView>(readView);
  // the town needs room: narrower screens always get the cards, and no choice
  const wide = useMediaQuery(TOWN_VIEW_QUERY);
  const view: CityView = wide ? chosen : 'grid';
  const choose = (v: CityView) => {
    setChosen(v);
    saveView(v);
  };
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
  const { townHall, unlocked: outerSlots } = fieldSlots(city.buildings);
  const here = city.buildings.filter((b) => (area === 'fields') === isOuterPosition(b.positionId));
  // tag filter: one tag per building type present; with tags selected only those buildings show (or, in the scene, stand out)
  const [tags, setTags] = useState<number[]>([]);
  const typeCounts = new Map<number, number>();
  for (const b of here) if (b.typeId) typeCounts.set(b.typeId, (typeCounts.get(b.typeId) ?? 0) + 1);
  const typeList = [...typeCounts.entries()].sort((a, b) => buildingName(a[0]).localeCompare(buildingName(b[0])));
  const active = tags.filter((t) => typeCounts.has(t));
  const toggle = (t: number) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const filtered = here
    .filter((b) => active.includes(b.typeId))
    .sort((a, b) => buildingName(a.typeId).localeCompare(buildingName(b.typeId)) || b.level - a.level || a.positionId - b.positionId);
  const highlight = active.length > 0 ? (b: BuildingBean) => active.includes(b.typeId) : undefined;

  const title = area === 'inside' ? t('inside.title') : t('fields.title');
  const note = area === 'fields' && (
    <span className="font-normal text-muted-foreground">{t('fields.unlocked', { unlocked: outerSlots, total: OUTSIDE.length, level: townHall })}</span>
  );
  const summary = active.length > 0 && (
    <>
      {active.map(buildingName).join(t('common:list.separator'))}{' '}
      <span className="font-normal text-muted-foreground">
        {t('filter.summary', {
          count: filtered.length,
          min: Math.min(...filtered.map((b) => b.level)),
          max: Math.max(...filtered.map((b) => b.level)),
        })}
      </span>
    </>
  );
  const filter = (
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
  );
  const views = wide && (
    <div className="flex gap-1" role="group" aria-label={t('view.label')}>
      {CITY_VIEWS.map((v) => (
        <Button key={v} size="xs" variant={view === v ? 'default' : 'outline'} aria-pressed={view === v} onClick={() => choose(v)}>
          {t(`view.${v}`)}
        </Button>
      ))}
    </div>
  );
  const dialog = (
    <BuildingDialog city={city} positionId={selected} building={selected != null ? byPos.get(selected) : undefined} onClose={() => setSelected(null)} />
  );

  if (view === 'scene')
    return (
      <div className="relative h-full min-h-80 overflow-hidden">
        {area === 'inside' ? (
          <IsoCity byPos={byPos} onSelect={setSelected} highlight={highlight} />
        ) : (
          <IsoFields byPos={byPos} unlocked={outerSlots} onSelect={setSelected} highlight={highlight} />
        )}
        <div className={cn(FLOATING, 'top-2 left-2 grid max-w-[calc(100%-12rem)] gap-1.5 p-2')}>
          <p className="text-sm font-medium">
            {title} {note}
          </p>
          {filter}
          {summary && <p className="text-sm font-medium">{summary}</p>}
        </div>
        <div className={cn(FLOATING, 'top-2 right-2 p-1')}>{views}</div>
        {dialog}
      </div>
    );

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid gap-4 p-3 pb-24 sm:p-4 sm:pb-24 lg:px-6 lg:pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {filter}
          {views}
        </div>
        {active.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{summary}</CardTitle>
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
              <CardTitle className="text-sm">
                {title} {note}
              </CardTitle>
            </CardHeader>
            {area === 'inside' ? (
              <CardContent>
                <WalledCity byPos={byPos} onSelect={setSelected} />
              </CardContent>
            ) : (
              <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                {OUTSIDE.map((pos, i) => (
                  <Slot key={pos} pos={pos} building={byPos.get(pos)} locked={i >= outerSlots} onClick={() => setSelected(pos)} />
                ))}
              </CardContent>
            )}
          </Card>
        )}
        {dialog}
      </div>
    </div>
  );
}
