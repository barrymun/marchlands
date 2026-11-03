import { useTranslation } from 'react-i18next';

import { ResourceIcon } from '@/components/resource-icon/resource-icon';
import { FLOW_FILL, GAIN_KINDS, LOSS_KINDS } from '@/components/stats-panel/resource-flows/constants';
import { ResourcesTable } from '@/components/stats-panel/resource-flows/resources-table/resources-table';
import { flowScale, resourceFlow } from '@/components/stats-panel/resource-flows/utils';
import { SectionId } from '@/components/stats-panel/section/constants';
import { Section } from '@/components/stats-panel/section/section';
import type { Counters } from '@/components/stats-panel/types';
import { shareOf } from '@/components/stats-panel/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fmt, fmtExact, resourceLabel, RESOURCES } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Each resource as a line with its losses on one side and its gains on the other, every resource on one scale: where
 * it came from (produced, plundered …) and where it went (upkeep, spending …), the exact amounts on hover.
 */
export function ResourceFlows({ c }: { c: Counters }) {
  const { t } = useTranslation(['stats-panel', 'common']);
  const flows = RESOURCES.map((r) => resourceFlow(c, r));
  const scale = flowScale(flows);
  const shown = new Set(flows.flatMap((f) => [...f.gains, ...f.losses].map((x) => x.kind)));
  const bar = (side: { kind: (typeof GAIN_KINDS | typeof LOSS_KINDS)[number]; amount: number }[], loss: boolean) => (
    <span className={cn('flex h-4 gap-0.5', loss && 'flex-row-reverse')} aria-hidden>
      {side.map(({ kind, amount }, i, all) => (
        <span
          key={kind}
          className={cn('h-full min-w-0.5', i === all.length - 1 && (loss ? 'rounded-s-sm' : 'rounded-e-sm'), FLOW_FILL[kind])}
          style={{ width: `${shareOf(amount, scale) * 100}%` }}
        />
      ))}
    </span>
  );
  return (
    <Section title={t('resourceFlows.title')} description={t('resourceFlows.description')} table={{ id: SectionId.RESOURCES, view: <ResourcesTable c={c} /> }}>
      {scale === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common:nothingYet')}</p>
      ) : (
        <div className="grid gap-3">
          <div className="grid">
            {flows.map((f) => (
              <Tooltip key={f.resource}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="grid w-full grid-cols-[1rem_3.5rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem] items-center gap-2 rounded-sm py-1.5 text-start text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[5.5rem_4rem_minmax(0,1fr)_minmax(0,1fr)_4rem]"
                  >
                    <span className="flex items-center gap-1.5">
                      <ResourceIcon resource={f.resource} />
                      {/* the name only where there is room; on a phone the icon, so the bars get the width */}
                      <span className="truncate max-sm:sr-only">{resourceLabel(f.resource)}</span>
                    </span>
                    <span className="text-end text-muted-foreground tabular-nums">{fmt(f.lost)}</span>
                    {bar(f.losses, true)}
                    <span className="border-s ps-0.5">{bar(f.gains, false)}</span>
                    <span className="tabular-nums">{fmt(f.gained)}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <dl className="grid grid-cols-[auto_auto] gap-x-3">
                    <dt className="font-medium">{t('resourceFlows.gained')}</dt>
                    <dd className="text-end font-medium tabular-nums">{fmtExact(f.gained)}</dd>
                    {f.gains.map(({ kind, amount }) => (
                      <div key={kind} className="contents">
                        <dt className="ps-2">{t(`resourceFlows.kinds.${kind}`)}</dt>
                        <dd className="text-end tabular-nums">{fmtExact(amount)}</dd>
                      </div>
                    ))}
                    <dt className="pt-1 font-medium">{t('resourceFlows.lost')}</dt>
                    <dd className="pt-1 text-end font-medium tabular-nums">{fmtExact(f.lost)}</dd>
                    {f.losses.map(({ kind, amount }) => (
                      <div key={kind} className="contents">
                        <dt className="ps-2">{t(`resourceFlows.kinds.${kind}`)}</dt>
                        <dd className="text-end tabular-nums">{fmtExact(amount)}</dd>
                      </div>
                    ))}
                  </dl>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {[...GAIN_KINDS, ...LOSS_KINDS]
              .filter((kind) => shown.has(kind))
              .map((kind) => (
                <span key={kind} className="flex items-center gap-1">
                  <span className={cn('size-2.5 rounded-xs', FLOW_FILL[kind])} aria-hidden />
                  {t(`resourceFlows.kinds.${kind}`)}
                </span>
              ))}
          </div>
        </div>
      )}
    </Section>
  );
}
