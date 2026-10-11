import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RequirementCheck } from '@marchlands/api-client';
import { Badge } from '@/components/ui/badge';
import { buildingName, itemName, techName } from '@/lib/game-data';

export function Requirements({ list }: { list: RequirementCheck[] }) {
  const { t } = useTranslation(['requirements', 'common']);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((r) => {
        const name = r.kind === 'building' ? buildingName(Number(r.id)) : r.kind === 'tech' ? techName(Number(r.id)) : itemName(String(r.id));
        return (
          <Badge key={`${r.kind}-${r.id}`} variant={r.ok ? 'secondary' : 'destructive'} className="gap-1 font-normal">
            {r.ok ? <Check className="size-3" /> : <X className="size-3" />}
            {name} {r.kind === 'item' ? t('quantity', { amount: r.required }) : t('common:level.short', { level: r.required })}
          </Badge>
        );
      })}
    </div>
  );
}
