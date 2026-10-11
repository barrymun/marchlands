import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { Counters } from '@/components/stats-panel/types';
import { Num } from '@/components/stats-panel/num/num';
import { itemName } from '@/lib/game-data';

export function ItemsUsed({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const used = Object.entries(c)
    .filter(([k, v]) => k.startsWith('items.used.') && v > 0)
    .map(([k, v]) => [k.slice('items.used.'.length), v] as const)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('itemsUsed.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {used.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common:noneYet')}</p>
        ) : (
          <Table>
            <TableBody>
              {used.map(([id, n]) => (
                <TableRow key={id}>
                  <TableCell>{itemName(id)}</TableCell>
                  <Num v={n} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
