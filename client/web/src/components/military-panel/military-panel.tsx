import { Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { FORT_KEYS, TROOP_KEYS, usedWallSpace, wallCapacity } from '@marchlands/core';

import { DismissDialog } from '@/components/military-panel/dismiss-dialog/dismiss-dialog';
import { InjuredCard } from '@/components/military-panel/injured-card/injured-card';
import { Production } from '@/components/military-panel/production/production';
import { UnitIcon } from '@/components/military-panel/unit-icon/unit-icon';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';

export function MilitaryPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const garrison = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key], injured: city.injuredTroop[key] }));
  const forts = Object.entries(FORT_KEYS).map(([id, key]) => ({ id: Number(id), count: city.fortification[key] }));
  const wallCap = wallCapacity(city.buildings);
  const wallUsed = usedWallSpace(city.fortification, []);
  // the troop or fortification being dismissed
  const [dismissing, setDismissing] = useState<number | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('garrison.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common:table.unit')}</TableHead>
                  <TableHead className="text-right">{t('garrison.ready')}</TableHead>
                  <TableHead className="text-right">{t('garrison.injured')}</TableHead>
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
                        <UnitIcon id={u.id} />
                        <UnitName id={u.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(u.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.injured ? fmtExact(u.injured) : '—'}</TableCell>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm">{t('defenses.title')}</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">{t('defenses.wallSpace', { used: fmtExact(wallUsed), cap: fmtExact(wallCap) })}</span>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('defenses.defense')}</TableHead>
                  <TableHead className="text-right">{t('defenses.built')}</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">{t('dismiss.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forts.map((f) => (
                  <TableRow key={f.id} className={f.count ? '' : 'text-muted-foreground'}>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-2">
                        <UnitIcon id={f.id} />
                        <UnitName id={f.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(f.count)}</TableCell>
                    <TableCell className="py-0">
                      {f.count > 0 && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t('dismiss.titleForts', { unit: troopName(f.id) })}
                          title={t('dismiss.destroyTip')}
                          onClick={() => setDismissing(f.id)}
                        >
                          <Trash2 />
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
      <div className="grid content-start gap-4">
        <Production city={city} fort={false} />
        <Production city={city} fort />
      </div>
    </div>
  );
}
