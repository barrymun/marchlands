import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  deletePlansByPlanId,
  deletePlansWavesByWaveId,
  getArmiesQueryKey,
  getPlansQueryKey,
  getPlayerQueryKey,
  type PlanBean,
  postPlansWavesMove,
  postPlansWavesSend,
} from '@marchlands/api-client';

import { MISSION_NAMES } from '@/components/armies-panel/constants';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Countdown } from '@/components/countdown/countdown';
import { AddWave } from '@/components/plans-panel/plan-card/add-wave/add-wave';
import { readCollapsed, storeCollapsed } from '@/components/plans-panel/plan-card/utils';
import { PlanForm } from '@/components/plans-panel/plan-form/plan-form';
import { sendable, takesWaves, troopsText, waveLeaves } from '@/components/plans-panel/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand } from '@/hooks/use-game';
import { useServerNow } from '@/hooks/use-server-now';
import { utcClock } from '@/lib/format';
import { clockOffset } from '@/lib/server-clock';
import { GAIN_TEXT, LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * One wave plan: its target and landing second, its waves in landing order with when each of the player's own must
 * leave, and what the player may do: add a wave of their own, send their own waves (one, or all still in time), change,
 * reorder and delete (its maker), take a wave out (its player or the maker). Collapsed, it shows only its heading, how
 * many of its waves are sent (remembered per plan), and Edit and Delete, in the heading so a long list of waves never
 * hides them; Edit opens a collapsed plan for as long as the form is up.
 */
export function PlanCard({ plan, playerId }: { plan: PlanBean; playerId: number }) {
  const { t } = useTranslation(['plans-panel', 'common']);
  const now = useServerNow();
  const maker = plan.playerId === playerId;
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readCollapsed(plan.id));
  const open = !collapsed || editing;
  // hiding a plan being edited leaves the form
  const toggle = () => {
    storeCollapsed(plan.id, open);
    setCollapsed(open);
    if (open) setEditing(false);
  };
  const refresh = () => [getPlansQueryKey(), getArmiesQueryKey(), getPlayerQueryKey()];
  const send = useCommand(
    async (waveIds: number[]) => {
      // one at a time, in the plan's order: each is its own army
      for (const waveId of waveIds) await postPlansWavesSend({ path: { planId: plan.id, waveId }, throwOnError: true });
    },
    refresh,
    t('sent'),
  );
  const move = useCommand(async (v: { waveId: number; by: -1 | 1 }) => {
    await postPlansWavesMove({ path: { planId: plan.id, waveId: v.waveId }, body: { by: v.by }, throwOnError: true });
  }, refresh);
  const drop = useCommand(async (waveId: number) => {
    await deletePlansWavesByWaveId({ path: { planId: plan.id, waveId }, throwOnError: true });
  }, refresh);
  const remove = useCommand(
    async () => {
      await deletePlansByPlanId({ path: { planId: plan.id }, throwOnError: true });
    },
    refresh,
    t('deleted'),
  );
  const ready = sendable(plan, playerId, now);
  const canAdd = takesWaves(plan, now);
  const busy = send.isPending || move.isPending || drop.isPending;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {plan.name}
          {plan.shared && <Badge variant="outline">{t('shared')}</Badge>}
        </CardTitle>
        <CardDescription className="tabular-nums">
          {t('lands', { x: plan.x, y: plan.y, time: utcClock(plan.landAt) })}{' '}
          {plan.landAt > now && (
            <span>
              (<Countdown endTime={plan.landAt - clockOffset()} />)
            </span>
          )}
        </CardDescription>
        {!maker && <CardDescription>{t('by', { player: plan.player })}</CardDescription>}
        {!open && (
          <CardDescription className="tabular-nums">
            {plan.waves.length === 0 ? t('noWaves') : t('summary', { count: plan.waves.length, sent: plan.waves.filter((w) => w.armyId != null).length })}
          </CardDescription>
        )}
        <CardAction className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
          {maker && !editing && (
            <div className="flex gap-1">
              <Button size="xs" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                {t('edit')}
              </Button>
              <ConfirmButton
                size="xs"
                variant="outline"
                title={t('deleteTitle')}
                description={t('deleteDescription')}
                confirmLabel={t('delete')}
                destructive
                disabled={remove.isPending}
                onConfirm={() => remove.mutate(undefined)}
              >
                {t('delete')}
              </ConfirmButton>
            </div>
          )}
          <Button variant="ghost" size="xs" className="text-muted-foreground" aria-expanded={open} onClick={toggle}>
            {open ? t('hide') : t('show')}
            {open ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </CardAction>
      </CardHeader>
      {open && (
        <CardContent className="grid gap-3 text-sm">
          {editing ? (
            <PlanForm plan={plan} onDone={() => setEditing(false)} />
          ) : plan.waves.length === 0 ? (
            <p className="text-muted-foreground">{t('noWaves')}</p>
          ) : (
            <ol className="grid gap-2">
              {plan.waves.map((w, i) => {
                const mine = w.playerId === playerId;
                const leaves = waveLeaves(plan, w);
                const late = leaves != null && leaves < now;
                const unsent = w.armyId == null;
                return (
                  <li key={w.id} className="flex flex-wrap items-start gap-2 rounded-md border p-2">
                    <span className="w-6 text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span>
                        {t('wave', { mission: MISSION_NAMES[w.mission] ?? '', city: w.city, player: w.player })}
                        {w.hero && <span className="text-muted-foreground"> · {w.hero}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{troopsText(w.troops)}</span>
                      <span className={cn('text-xs tabular-nums', !unsent ? GAIN_TEXT : late ? LOSS_TEXT : 'text-muted-foreground')}>
                        {!unsent ? (
                          t('status.sent')
                        ) : leaves == null ? (
                          t('status.waiting', { player: w.player })
                        ) : late ? (
                          t('status.late')
                        ) : (
                          <>
                            {t('status.leaves', { time: utcClock(leaves) })} (<Countdown endTime={leaves - clockOffset()} />)
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {maker && unsent && (
                        <>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={busy || i === 0}
                            aria-label={t('earlier')}
                            title={t('earlier')}
                            onClick={() => move.mutate({ waveId: w.id, by: -1 })}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={busy || i === plan.waves.length - 1}
                            aria-label={t('later')}
                            title={t('later')}
                            onClick={() => move.mutate({ waveId: w.id, by: 1 })}
                          >
                            <ArrowDown />
                          </Button>
                        </>
                      )}
                      {mine && unsent && !late && (
                        <Button size="xs" variant="outline" disabled={busy} onClick={() => send.mutate([w.id])}>
                          {t('common:actions.send')}
                        </Button>
                      )}
                      {(mine || maker) && unsent && (
                        <Button size="icon-xs" variant="ghost" disabled={busy} aria-label={t('remove')} title={t('remove')} onClick={() => drop.mutate(w.id)}>
                          <X />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {!editing && (canAdd || ready.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {canAdd && <AddWave plan={plan} playerId={playerId} disabled={busy} />}
              {ready.length > 0 && (
                <Button size="sm" disabled={busy} onClick={() => send.mutate(ready.map((w) => w.id))}>
                  {t('sendMine', { count: ready.length })}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
