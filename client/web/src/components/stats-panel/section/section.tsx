import { ChartBar, Table2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SectionId } from '@/components/stats-panel/section/constants';
import { readShowTable, storeShowTable } from '@/components/stats-panel/section/utils';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A part of the statistics page: a card with its chart, and for the sections with every number in a table (`table`,
 * named by `id`), a switch between the two, remembered.
 */
export function Section({
  title,
  description,
  table,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  table?: { id: SectionId; view: ReactNode };
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('stats-panel');
  const [showTable, setShowTable] = useState(() => (table ? readShowTable(table.id) : false));
  const toggle = () => {
    if (!table) return;
    storeShowTable(table.id, !showTable);
    setShowTable(!showTable);
  };
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {table && (
          <CardAction>
            <Button size="sm" variant="ghost" aria-pressed={showTable} onClick={toggle}>
              {showTable ? <ChartBar aria-hidden /> : <Table2 aria-hidden />}
              {showTable ? t('section.showChart') : t('section.showTable')}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="min-w-0">{showTable && table ? <div className="overflow-x-auto">{table.view}</div> : children}</CardContent>
    </Card>
  );
}
