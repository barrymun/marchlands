import { Check, SkipForward, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { FlowRunReport } from '@marchlands/api-client';

import { StepItems } from '@/components/flows-panel/flow-detail/run-report/city-steps/step-items/step-items';
import { translateMessage } from '@/lib/messages';
import { GAIN_TEXT, WARN_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** What each step of a flow did in one city, with the targets of an attack. */
export function CitySteps({ city: c }: { city: FlowRunReport['cities'][number] }) {
  const { t } = useTranslation(['flows-panel', 'common']);
  return (
    <div className="grid gap-1">
      <ol className="grid gap-0.5 text-xs">
        {c.steps.map((s, i) => (
          <li key={i} className={cn('flex gap-1.5', !s.ok ? 'text-destructive' : s.skipped ? WARN_TEXT : 'text-muted-foreground')}>
            {!s.ok ? (
              <X className="mt-0.5 size-3 shrink-0" />
            ) : s.skipped ? (
              <SkipForward className="mt-0.5 size-3 shrink-0" />
            ) : (
              <Check className={cn('mt-0.5 size-3 shrink-0', GAIN_TEXT)} />
            )}
            <div className="grid min-w-0 gap-1">
              <span>
                <span className="text-foreground">{translateMessage(s.action)}:</span> {translateMessage(s.detail)}
              </span>
              {s.items && s.items.length > 0 && <StepItems items={s.items} />}
            </div>
          </li>
        ))}
        {c.steps.length === 0 && <li className="text-muted-foreground">{t('common:nothingYet')}</li>}
      </ol>
      {!c.ok && <p className="text-xs text-destructive">{t('runFlow.report.undone')}</p>}
    </div>
  );
}
