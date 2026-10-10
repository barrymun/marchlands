import { Check, X } from 'lucide-react';
import type { RequirementCheck } from '@marchlands/api-client';
import { BUILDING_NAMES, itemConfig, TECH_NAMES } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';

export function Requirements({ list }: { list: RequirementCheck[] }) {
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((r) => {
        const name =
          r.kind === 'building'
            ? BUILDING_NAMES[Number(r.id)]
            : r.kind === 'tech'
              ? TECH_NAMES[Number(r.id)]
              : (itemConfig(String(r.id))?.name ?? String(r.id));
        return (
          <Badge key={`${r.kind}-${r.id}`} variant={r.ok ? 'secondary' : 'destructive'} className="gap-1 font-normal">
            {r.ok ? <Check className="size-3" /> : <X className="size-3" />}
            {name ?? r.id} {r.kind === 'item' ? `×${r.required}` : `Lv ${r.required}`}
          </Badge>
        );
      })}
    </div>
  );
}
