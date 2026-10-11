import { useTranslation } from 'react-i18next';
import type { CityBean } from '@marchlands/api-client';
import { usedWallSpace, wallCapacity, FORT_KEYS, TROOP_KEYS } from '@marchlands/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtExact } from '@/lib/format';
import { Production } from '@/components/military-panel/production/production';
import { InjuredCard } from '@/components/military-panel/injured-card/injured-card';
import { UnitName } from '@/components/military-panel/unit-name/unit-name';

export function MilitaryPanel({ city }: { city: CityBean }) {
  const { t } = useTranslation(['military-panel', 'common']);
  const garrison = Object.entries(TROOP_KEYS).map(([id, key]) => ({ id: Number(id), count: city.troop[key], injured: city.injuredTroop[key] }));
  const forts = Object.entries(FORT_KEYS).map(([id, key]) => ({ id: Number(id), count: city.fortification[key] }));
  const wallCap = wallCapacity(city.buildings);
  const wallUsed = usedWallSpace(city.fortification, []);
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {garrison.map((t) => (
                  <TableRow key={t.id} className={t.count || t.injured ? '' : 'text-muted-foreground'}>
                    <TableCell>
                      <UnitName id={t.id} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(t.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.injured ? fmtExact(t.injured) : '—'}</TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {forts.map((f) => (
                  <TableRow key={f.id} className={f.count ? '' : 'text-muted-foreground'}>
                    <TableCell>
                      <UnitName id={f.id} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(f.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <InjuredCard city={city} />
      </div>
      <div className="grid content-start gap-4">
        <Production city={city} fort={false} />
        <Production city={city} fort />
      </div>
    </div>
  );
}
