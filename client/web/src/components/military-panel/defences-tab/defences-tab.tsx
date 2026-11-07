import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { FORT_KEYS, usedWallSpace, wallCapacity } from '@marchlands/core';

import { DismissDialog } from '@/components/military-panel/dismiss-dialog/dismiss-dialog';
import { Production } from '@/components/military-panel/production/production';
import { UnitIcon } from '@/components/military-panel/unit-icon/unit-icon';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/** The Military page's Defences tab: the fortifications on the city's walls beside the building order. */
export function DefencesTab({ city }: { city: CityBean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const forts = Object.entries(FORT_KEYS).map(([id, key]) => ({ id: Number(id), count: city.fortification[key] ?? 0 }));
  const wallCap = wallCapacity(city.buildings);
  const wallUsed = usedWallSpace(city.fortification, []);
  // the fortification being destroyed
  const [dismissing, setDismissing] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[26rem_minmax(0,1fr)]">
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
                <TableHead className="text-end">{t('defenses.built')}</TableHead>
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
                  <TableCell className="text-end tabular-nums">{fmtExact(f.count)}</TableCell>
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
      <DismissDialog city={city} unitId={dismissing} onClose={() => setDismissing(null)} />
      <Production city={city} fort />
    </div>
  );
}
