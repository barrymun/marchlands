import { CirclePlay, Eye, Info, Pencil, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Flow } from '@marchlands/api-client';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { useFlowControls } from '@/components/flows-panel/flow-detail/hooks';
import { LastPreview } from '@/components/flows-panel/flow-detail/last-preview/last-preview';
import { LastRun } from '@/components/flows-panel/flow-detail/last-run/last-run';
import { RunsOn } from '@/components/flows-panel/flow-detail/runs-on/runs-on';
import { StatusLine } from '@/components/flows-panel/flow-detail/status-line/status-line';
import { StepTimeline } from '@/components/flows-panel/flow-detail/step-timeline/step-timeline';
import type { Targets } from '@/components/flows-panel/types';
import { hasHero, hiresHeroes } from '@/components/flows-panel/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePlayer } from '@/hooks/use-game';
import { WARN_TEXT } from '@/lib/tones';

/**
 * The flow chosen: its name and where it stands, with run or stop, preview, edit and delete beside them; its steps down a
 * line; the cities it runs on and repeat; and its latest preview or run, a city a row.
 */
export function FlowDetail({
  flow,
  currentCityId,
  onEdit,
  onDelete,
  deleting,
}: {
  flow: Flow;
  currentCityId: number;
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
  deleting: boolean;
}) {
  const { t } = useTranslation(['flows-panel', 'common']);
  const cities = usePlayer().data?.castles ?? [];
  // starts from the flow's saved cities; changing them here applies to this run only
  const [targets, setTargets] = useState<Targets>(flow.cities);
  const own = new Set(cities.map((c) => c.id));
  // all cities: those with a hero (the server skips the others), or every city when the flow hires heroes
  const hires = hiresHeroes(flow.actions);
  const picked = targets === 'all' ? cities.filter((c) => hires || hasHero(c)).map((c) => c.id) : targets.filter((id) => own.has(id));
  const { run, repeat, stop, busy } = useFlowControls(flow, targets, picked);
  const idle = flow.status === 'idle';
  return (
    <div className="grid content-start gap-4">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <CardTitle className="truncate text-base">{flow.name}</CardTitle>
            <StatusLine flow={flow} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={!picked.length || busy} onClick={() => run.mutate(true)}>
              <Eye /> {t('runFlow.preview')}
            </Button>
            {idle ? (
              <Button size="sm" disabled={!picked.length || busy} onClick={() => run.mutate(false)}>
                <CirclePlay /> {t('runFlow.run', { count: picked.length })}
              </Button>
            ) : (
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => stop.mutate()}>
                <Square /> {t('runFlow.stop')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil /> {t('common:actions.edit')}
            </Button>
            <ConfirmButton
              size="icon-sm"
              variant="ghost"
              aria-label={t('detail.deleteLabel', { name: flow.name })}
              buttonTitle={t('detail.deleteLabel', { name: flow.name })}
              disabled={deleting}
              title={t('detail.deleteTitle', { name: flow.name })}
              description={t('detail.deleteDescription')}
              confirmLabel={t('detail.deleteConfirm')}
              onConfirm={onDelete}
            >
              <Trash2 />
            </ConfirmButton>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={t('detail.howRuns')} title={t('detail.howRuns')}>
                  <Info />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 text-sm">
                {t('runFlow.description')}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <StepTimeline flow={flow} />
          {flow.actions.some((a) => a.type === 'attackTargets' && !a.presetId) && <p className={`text-xs ${WARN_TEXT}`}>{t('detail.noArmy')}</p>}
          <RunsOn
            targets={targets}
            onTargets={setTargets}
            currentCityId={currentCityId}
            hires={hires}
            repeat={flow.repeat}
            onRepeat={(on) => repeat.mutate(on)}
            busy={busy}
          />
        </CardContent>
      </Card>
      {(flow.lastPreview ?? flow.lastRun) && (
        <Card>
          <CardContent>{flow.lastPreview ? <LastPreview preview={flow.lastPreview} /> : flow.lastRun && <LastRun run={flow.lastRun} />}</CardContent>
        </Card>
      )}
    </div>
  );
}
