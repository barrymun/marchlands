import { HeartPulse, Hourglass } from 'lucide-react';
import { FLOW_MAX_WAIT_MINUTES, FLOW_STAT_LABEL, FLOW_TROOP_IDS, formatFlowMinutes } from '@marchlands/core';
import { AttackTargetsFields } from '@/components/flow-attack/attack-targets-fields/attack-targets-fields';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { attributeOfStat } from '@/lib/hero-attributes';
import { troopName } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Draft, Targets } from '@/components/flows-panel/types';
import type { Stat } from '@/components/flows-panel/flow-editor/action-fields/types';

/** The inputs of one action: which attribute for "set mayor"; troop type and amount (or max) for "train". */
export function ActionFields({ action, cities, onChange }: { action: Draft; cities: Targets; onChange: (a: Draft) => void }) {
  if (action.type === 'attackTargets') {
    return <AttackTargetsFields action={action} cities={cities} onChange={(a) => onChange({ ...a, key: action.key })} />;
  }
  if (action.type === 'healTroops') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <HeartPulse className="size-4 text-muted-foreground" />
        <span>Heal all injured troops with</span>
        <Select value={action.payWith} onValueChange={(v) => onChange({ ...action, payWith: v as 'resources' | 'honor' })}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resources">Resources</SelectItem>
            <SelectItem value="honor">Honor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action.when ?? 'now'} onValueChange={(v) => onChange({ ...action, when: v as 'now' | 'armiesHome' })}>
          <SelectTrigger size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">right away</SelectItem>
            <SelectItem value="armiesHome">when the city's armies are home</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (action.type === 'wait') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Hourglass className="size-4 text-muted-foreground" />
        <span>Wait</span>
        <Select value={action.until} onValueChange={(v) => onChange({ ...action, until: v as 'time' | 'armiesHome' })}>
          <SelectTrigger size="sm" className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="armiesHome">until the armies sent are home</SelectItem>
            <SelectItem value="time">for a set time</SelectItem>
          </SelectContent>
        </Select>
        {action.until === 'time' && (
          <>
            <Input
              className="h-8 w-20"
              inputMode="numeric"
              aria-label="Minutes"
              value={String(action.minutes)}
              onChange={(e) => onChange({ ...action, minutes: Math.min(FLOW_MAX_WAIT_MINUTES, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) })}
            />
            <span>minutes</span>
            {action.minutes >= 60 && <span className="text-xs text-muted-foreground">({formatFlowMinutes(action.minutes)})</span>}
          </>
        )}
      </div>
    );
  }
  if (action.type === 'setMayor') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Set mayor: highest</span>
        <Select value={action.stat} onValueChange={(v) => onChange({ ...action, stat: v as Stat })}>
          <SelectTrigger size="sm" className={cn('w-36 font-medium', attributeOfStat(action.stat).tone)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FLOW_STAT_LABEL) as Stat[]).map((s) => (
              <SelectItem key={s} value={s}>
                {FLOW_STAT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  const max = action.amount === 'max';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Train</span>
      {!max && (
        <Input
          className="h-8 w-28"
          inputMode="numeric"
          aria-label="Amount"
          value={String(action.amount)}
          onChange={(e) => onChange({ ...action, amount: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })}
        />
      )}
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={max} onCheckedChange={(on) => onChange({ ...action, amount: on ? 'max' : 1000 })} />
        Max
      </label>
      <Select value={String(action.troopId)} onValueChange={(v) => onChange({ ...action, troopId: Number(v) })}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FLOW_TROOP_IDS.map((id) => (
            <SelectItem key={id} value={String(id)}>
              {troopName(id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
