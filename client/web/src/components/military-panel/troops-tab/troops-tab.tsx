import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { TROOP_KEYS } from '@marchlands/core';

import { DismissDialog } from '@/components/military-panel/dismiss-dialog/dismiss-dialog';
import { Production } from '@/components/military-panel/production/production';
import { InjuredCard } from '@/components/military-panel/troops-tab/injured-card/injured-card';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';
import { TroopBadge } from '@/components/troop-badge/troop-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/** The Military page's Troops tab: the city's garrison and its injured beside the training order, each scrolling by itself from xl up. */
export function TroopsTab({ city }: { city: CityBean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const garrison = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key] ?? 0, injured: city.injuredTroop[key] ?? 0 }));
  // the troop being dismissed
  const [dismissing, setDismissing] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:h-full xl:grid-cols-[26rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
      {/* rows as tall as their cards: in a pane of fixed height a grid would otherwise squeeze a card to fit, rather than scroll */}
      <div className="grid auto-rows-max grid-cols-1 content-start gap-4 xl:overflow-y-auto xl:[scrollbar-width:thin]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('garrison.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common:table.unit')}</TableHead>
                  <TableHead className="text-end">{t('garrison.ready')}</TableHead>
                  <TableHead className="text-end">{t('garrison.injured')}</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">{t('dismiss.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garrison.map((u) => (
                  <TableRow key={u.id} className={u.count || u.injured ? '' : 'text-muted-foreground'}>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-2">
                        <TroopBadge id={u.id} />
                        <UnitName id={u.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{fmtExact(u.count)}</TableCell>
                    <TableCell className="text-end tabular-nums">{u.injured ? fmtExact(u.injured) : '—'}</TableCell>
                    <TableCell className="py-0">
                      {u.count > 0 && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t('dismiss.titleTroops', { unit: troopName(u.id) })}
                          title={t('dismiss.dismissTip')}
                          onClick={() => setDismissing(u.id)}
                        >
                          <UserMinus />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <InjuredCard city={city} />
        <DismissDialog city={city} unitId={dismissing} onClose={() => setDismissing(null)} />
      </div>
      <div className="xl:overflow-y-auto xl:[scrollbar-width:thin]">
        <Production city={city} fort={false} />
      </div>
    </div>
  );
}
