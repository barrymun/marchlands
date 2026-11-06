import { FLOW_STATS } from '@/components/flows-panel/flow-editor/action-fields/stat-select/constants';
import type { Stat } from '@/components/flows-panel/flow-editor/action-fields/stat-select/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { attributeOfStat } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

/** Which attribute an action goes by, in that attribute's colour. A component of its own so it can sit in a Trans (see AGENTS.md, Translations). */
export function StatSelect({ value, onChange }: { value: Stat; onChange: (stat: Stat) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Stat)}>
      <SelectTrigger size="sm" className={cn('w-36 font-medium', attributeOfStat(value).tone)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FLOW_STATS.map((s) => (
          <SelectItem key={s} value={s}>
            {attributeOfStat(s).label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
