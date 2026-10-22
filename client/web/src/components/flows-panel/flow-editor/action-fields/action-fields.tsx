import { HeartPulse, Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FLOW_MAX_WAIT_MINUTES, FLOW_TROOP_IDS } from '@marchlands/core';

import { AttackTargetsFields } from '@/components/flow-attack/attack-targets-fields/attack-targets-fields';
import { FLOW_STATS } from '@/components/flows-panel/flow-editor/action-fields/constants';
import type { Stat } from '@/components/flows-panel/flow-editor/action-fields/types';
import type { Draft, Targets } from '@/components/flows-panel/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { shortDuration } from '@/lib/format';
import { troopName } from '@/lib/game-data';
import { attributeOfStat } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

/** The inputs of one action: which attribute for "set mayor"; troop type and amount (or max) for "train". */
export function ActionFields({ action, cities, onChange }: { action: Draft; cities: Targets; onChange: (a: Draft) => void }) {
  const { t } = useTranslation(['flows-panel', 'common']);
  if (action.type === 'attackTargets') {
    return <AttackTargetsFields action={action} cities={cities} onChange={(a) => onChange({ ...a, key: action.key })} />;
  }
  if (action.type === 'healTroops') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <HeartPulse className="size-4 text-muted-foreground" />
        <span>{t('actionFields.heal.label')}</span>
        <Select value={action.payWith} onValueChange={(v) => onChange({ ...action, payWith: v as 'resources' | 'honor' })}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resources">{t('actionFields.heal.resources')}</SelectItem>
            <SelectItem value="honor">{t('actionFields.heal.honor')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action.when} onValueChange={(v) => onChange({ ...action, when: v as 'now' | 'armiesHome' })}>
          <SelectTrigger size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">{t('actionFields.heal.now')}</SelectItem>
            <SelectItem value="armiesHome">{t('actionFields.heal.armiesHome')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (action.type === 'wait') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Hourglass className="size-4 text-muted-foreground" />
        <span>{t('actionFields.wait.label')}</span>
        <Select value={action.until} onValueChange={(v) => onChange({ ...action, until: v as 'time' | 'armiesHome' })}>
          <SelectTrigger size="sm" className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="armiesHome">{t('actionFields.wait.armiesHome')}</SelectItem>
            <SelectItem value="time">{t('actionFields.wait.time')}</SelectItem>
          </SelectContent>
        </Select>
        {action.until === 'time' && (
          <>
            <Input
              className="h-8 w-20"
              inputMode="numeric"
              aria-label={t('actionFields.wait.minutesLabel')}
              value={String(action.minutes)}
              onChange={(e) => onChange({ ...action, minutes: Math.min(FLOW_MAX_WAIT_MINUTES, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) })}
            />
            <span>{t('actionFields.wait.minutes')}</span>
            {action.minutes >= 60 && <span className="text-xs text-muted-foreground">({shortDuration(action.minutes * 60_000)})</span>}
          </>
        )}
      </div>
    );
  }
  if (action.type === 'setMayor') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t('actionFields.setMayor')}</span>
        <Select value={action.stat} onValueChange={(v) => onChange({ ...action, stat: v as Stat })}>
          <SelectTrigger size="sm" className={cn('w-36 font-medium', attributeOfStat(action.stat).tone)}>
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
      </div>
    );
  }
  const max = action.amount === 'max';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{t('actionFields.train.label')}</span>
      {!max && (
        <Input
          className="h-8 w-28"
          inputMode="numeric"
          aria-label={t('actionFields.train.amount')}
          value={String(action.amount)}
          onChange={(e) => onChange({ ...action, amount: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })}
        />
      )}
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={max} onCheckedChange={(on) => onChange({ ...action, amount: on ? 'max' : 1000 })} />
        {t('common:actions.max')}
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
