import { Fragment, useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { ReportDetail, ReportSummary } from '@evony/api-client';
import { FORT_ID_BY_KEY, TILE_NAMES, TROOP_ID_BY_KEY, TROOP_NAMES, type BattleReport, type FortKey, type ReportBody, type TroopKey } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useSticky } from '@/hooks/use-sticky';
import { api, unwrap } from '@/lib/api';
import { fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';

export const rk = {
  list: (type: number | null, page: number) => ['reports', 'list', type, page] as const,
  unread: ['reports', 'unread'] as const,
  detail: (id: number) => ['reports', 'detail', id] as const,
};

const TABS = [
  { id: 'all', label: 'All', type: null, count: 'count' },
  { id: 'army', label: 'Military', type: 1, count: 'army_count' },
  { id: 'trade', label: 'Trade', type: 0, count: 'trade_count' },
  { id: 'other', label: 'Other', type: 2, count: 'other_count' },
] as const;
const PAGE_SIZE = 20;

export function useUnreadReports() {
  return useQuery({ queryKey: rk.unread, queryFn: () => unwrap(api.GET('/api/v1/reports/unread')) });
}

export function ReportsPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const type = TABS.find((t) => t.id === tab)!.type;
  const unread = useUnreadReports();
  const list = useQuery({
    queryKey: rk.list(type, page),
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/api/v1/reports', { params: { query: { type: type ?? undefined, pageNo: page, pageSize: PAGE_SIZE } } })),
  });
  const markAll = useCommand(() => unwrap(api.POST('/api/v1/reports/read', { body: {} })), () => [['reports']], 'All reports marked as read');
  const reports = list.data?.reports ?? [];
  const totalPage = Math.max(1, list.data?.totalPage ?? 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as typeof tab);
            setPage(1);
          }}
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                {t.label}
                {(unread.data?.[t.count] ?? 0) > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[10px] tabular-nums">{unread.data?.[t.count]}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" disabled={!unread.data?.count || markAll.isPending} onClick={() => markAll.mutate(undefined)}>
          Mark all read
        </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {list.isPending && <Skeleton className="h-40" />}
        {list.data && reports.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No reports.</p>}
        {reports.length > 0 && (
          <Table>
            <TableBody>
              {reports.map((r) => (
                <ReportRow key={r.id} report={r} onOpen={() => setOpen(r.id)} />
              ))}
            </TableBody>
          </Table>
        )}
        {totalPage > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button size="icon-sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {totalPage}
            </span>
            <Button size="icon-sm" variant="outline" disabled={page >= totalPage} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Reports are kept for 30 days.</p>
      </CardContent>
      <ReportDialog reportId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function ReportRow({ report: r, onOpen }: { report: ReportSummary; onOpen: () => void }) {
  return (
    <TableRow className={cn('cursor-pointer', !r.isRead && 'font-medium')} onClick={onOpen}>
      <TableCell className="w-4 pr-0">{!r.isRead && <span className="block size-2 rounded-full bg-primary" aria-label="unread" />}</TableCell>
      <TableCell>
        <div>{r.title}</div>
        {(r.startPos || r.targetPos) && (
          <div className="text-xs font-normal text-muted-foreground">
            {r.startPos}
            {r.startPos && r.targetPos && ' → '}
            {r.targetPos}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right text-xs font-normal whitespace-nowrap text-muted-foreground">{new Date(r.eventTime).toLocaleString()}</TableCell>
    </TableRow>
  );
}

function ReportDialog({ reportId, onClose }: { reportId: number | null; onClose: () => void }) {
  const id = useSticky(reportId);
  const detail = useQuery({
    queryKey: rk.detail(id ?? 0),
    enabled: id != null,
    queryFn: () => unwrap(api.GET('/api/v1/reports/{reportId}', { params: { path: { reportId: id! } } })),
  });
  const remove = useCommand(
    (reportId: number) => unwrap(api.POST('/api/v1/reports/delete', { body: { ids: [reportId] } })),
    () => [['reports']],
    'Report deleted',
  );
  // opening a report marks it read on the server: refresh the list and the unread counters
  const qc = useQueryClient();
  const loadedId = detail.data?.id;
  useEffect(() => {
    if (loadedId == null) return;
    void qc.invalidateQueries({ queryKey: ['reports', 'list'] });
    void qc.invalidateQueries({ queryKey: rk.unread });
  }, [loadedId, qc]);
  const r = detail.data;
  return (
    <Dialog open={reportId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{r?.title ?? 'Report'}</DialogTitle>
          <DialogDescription>
            {r && (
              <>
                {r.startPos}
                {r.startPos && r.targetPos && ' → '}
                {r.targetPos}
                {(r.startPos || r.targetPos) && ' · '}
                {new Date(r.eventTime).toLocaleString()}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? <Skeleton className="h-48" /> : r ? <ReportContent report={r} /> : null}
        {r && (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(r.id, { onSuccess: onClose })}>
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------

const troopLabel = (k: string) => TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey] ?? FORT_ID_BY_KEY[k as FortKey]] ?? k;
const RES_LABEL: Record<string, string> = { gold: 'Gold', food: 'Food', wood: 'Lumber', stone: 'Stone', iron: 'Iron' };

function ReportContent({ report }: { report: ReportDetail }) {
  const body = report.content as ReportBody;
  switch (body.kind) {
    case 'battle':
      return <BattleView battle={body.battle} />;
    case 'scout':
      return <ScoutView scout={body.scout} />;
    case 'movement':
      return <MovementView movement={body.movement} />;
    case 'trade':
      return <TradeView trade={body.trade} />;
    case 'text':
      return <p className="text-sm">{body.text}</p>;
  }
}

function BattleView({ battle: b }: { battle: BattleReport }) {
  const player = usePlayer();
  const me = player.data?.playerInfo.userName;
  const myWin = (b.result === 'attackerWon' && b.attacker.player === me) || (b.result === 'defenderWon' && b.defender.player === me);
  const myLoss = (b.result === 'attackerWon' && b.defender.player === me) || (b.result === 'defenderWon' && b.attacker.player === me);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={myWin ? 'default' : myLoss ? 'destructive' : 'secondary'}>{myWin ? 'Victory' : myLoss ? 'Defeat' : b.result === 'draw' ? 'Draw' : resultLabel(b.result)}</Badge>
        <span className="text-muted-foreground">
          {b.rounds} round{b.rounds === 1 ? '' : 's'}
        </span>
        {'valley' in b && (
          <span>
            {TILE_NAMES[b.valley.type] ?? 'Valley'} Lv {b.valley.level}: {b.occupied ? 'occupied' : b.reason ? `not occupied (${b.reason})` : 'not occupied'}
          </span>
        )}
        {'level' in b && <span>Barbarian city Lv {b.level}</span>}
        {'city' in b && <span>{b.city}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SideView title="Attacker" side={b.attacker} />
        <SideView title="Defender" side={b.defender} forts={b.defender.forts} wallLevel={b.defender.wallLevel} />
      </div>
      <LootBox battle={b} me={me} />
    </div>
  );
}

/** What the attacker took: per resource and in total (valleys hold nothing). */
function LootBox({ battle: b, me }: { battle: BattleReport; me?: string }) {
  const mine = b.attacker.player === me;
  if (!('plunder' in b)) {
    return (
      <div className="grid gap-1 rounded-md bg-muted/50 p-3">
        <div className="font-medium">Loot</div>
        <span className="text-muted-foreground">Nothing: valleys hold no resources to take{'occupied' in b && b.occupied ? ' (holding it raises your production instead)' : ''}.</span>
      </div>
    );
  }
  const entries = (['gold', 'food', 'wood', 'stone', 'iron'] as const).map((k) => [k, Math.floor(b.plunder[k] ?? 0)] as const);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="grid gap-1.5 rounded-md bg-muted/50 p-3">
      <div className="font-medium">{mine ? 'Loot taken' : 'Resources lost to the attacker'}</div>
      {total === 0 ? (
        <span className="text-muted-foreground">
          Nothing{b.result === 'attackerWon' ? ' (nothing left unprotected, or no room to carry it)' : ': the attack failed'}.
        </span>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5 tabular-nums sm:grid-cols-[repeat(3,auto_1fr)]">
          {entries
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <Fragment key={k}>
                <span className="text-muted-foreground">{RES_LABEL[k]}</span>
                <span className={mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                  {mine ? '+' : '−'}
                  {fmtExact(n)}
                </span>
              </Fragment>
            ))}
          <span className="font-medium">Total</span>
          <span className="font-medium">{fmtExact(total)}</span>
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Loyalty −{fmtExact(b.loyaltyDamage)} (now {fmtExact(b.loyaltyLeft)}){b.captured && ' · city captured'}
      </div>
    </div>
  );
}

const resultLabel = (r: string) => (r === 'attackerWon' ? 'Attacker won' : r === 'defenderWon' ? 'Defender won' : 'Draw');

function SideView({
  title,
  side,
  forts,
  wallLevel,
}: {
  title: string;
  side: BattleReport['attacker'];
  forts?: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> };
  wallLevel?: number;
}) {
  const rows = (t: { before: Record<string, number | undefined>; lost: Record<string, number | undefined>; after: Record<string, number | undefined> }) =>
    Object.keys(t.before)
      .filter((k) => (t.before[k] ?? 0) > 0 || (t.lost[k] ?? 0) > 0)
      .map((k) => (
        <TableRow key={k}>
          <TableCell>{troopLabel(k)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(t.before[k] ?? 0)}</TableCell>
          <TableCell className="text-right tabular-nums text-destructive">{(t.lost[k] ?? 0) > 0 ? `−${fmtExact(t.lost[k] ?? 0)}` : '—'}</TableCell>
          <TableCell className="text-right tabular-nums">{fmtExact(t.after[k] ?? 0)}</TableCell>
        </TableRow>
      ));
  const troopRows = rows(side.troops);
  const fortRows = forts ? rows(forts) : [];
  return (
    <div className="grid content-start gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {title}: {side.player || '—'}
        </span>
        {side.hero && (
          <span className="text-xs text-muted-foreground">
            {side.hero.name} Lv {side.hero.level}
          </span>
        )}
      </div>
      {troopRows.length + fortRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No troops.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">Lost</TableHead>
              <TableHead className="text-right">After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {troopRows}
            {fortRows}
          </TableBody>
        </Table>
      )}
      <div className="text-xs text-muted-foreground tabular-nums">
        {side.honor > 0 && `+${fmtExact(side.honor)} honor`}
        {side.honor > 0 && side.heroExp > 0 && ' · '}
        {side.heroExp > 0 && `hero +${fmtExact(side.heroExp)} exp`}
        {wallLevel != null && wallLevel > 0 && `${side.honor > 0 || side.heroExp > 0 ? ' · ' : ''}walls Lv ${wallLevel}`}
      </div>
    </div>
  );
}

function TroopList({ troops, empty = 'None' }: { troops: Record<string, number | undefined>; empty?: string }) {
  const entries = Object.entries(troops).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${troopLabel(k)}`).join(' · ')}</span>;
}

function ResourceList({ res, empty = 'None' }: { res: Record<string, number | undefined>; empty?: string }) {
  const entries = Object.entries(res).filter(([, n]) => (n ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground">{empty}</span>;
  return <span className="tabular-nums">{entries.map(([k, n]) => `${fmtExact(n ?? 0)} ${RES_LABEL[k] ?? k}`).join(' · ')}</span>;
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function ScoutView({ scout: s }: { scout: Extract<ReportBody, { kind: 'scout' }>['scout'] }) {
  if (s.target === 'npc') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Target">Barbarian city Lv {s.level}</Line>
        <Line label="Guard hero">
          {s.hero.name} Lv {s.hero.level}
        </Line>
        <Line label="Troops">
          <TroopList troops={s.troops} />
        </Line>
        <Line label="Fortifications">
          <TroopList troops={s.fortifications} /> {s.wallLevel > 0 && `· walls Lv ${s.wallLevel}`}
        </Line>
        <Line label="Resources">
          <ResourceList res={s.resources} />
        </Line>
        <Line label="Loyalty">{fmtExact(s.loyalty)}</Line>
        <Line label="Population">{fmtExact(s.population)}</Line>
      </div>
    );
  }
  if (s.target === 'valley') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Target">
          {TILE_NAMES[s.type] ?? 'Valley'} Lv {s.level}
        </Line>
        <Line label="Held by">{s.owner ?? 'nobody'}</Line>
        <Line label="Defenders">
          <TroopList troops={s.troops} empty="none" />
        </Line>
      </div>
    );
  }
  const fight = (
    <Line label="Scouts">
      {s.success ? 'got through' : 'were repelled'} · ours {fmtExact(s.battle.attackerScouts.before)} → {fmtExact(s.battle.attackerScouts.after)}, theirs{' '}
      {fmtExact(s.battle.defenderScouts.before)} → {fmtExact(s.battle.defenderScouts.after)}
    </Line>
  );
  if ('from' in s) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Scouted by">{s.from}</Line>
        {fight}
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label="Lord">{s.owner}</Line>
      {fight}
      {s.intel && (
        <>
          <Line label="Troops">
            <TroopList troops={s.intel.troops} />
          </Line>
          <Line label="Fortifications">
            <TroopList troops={s.intel.fortifications} /> {s.intel.wallLevel > 0 && `· walls Lv ${s.intel.wallLevel}`}
          </Line>
          <Line label="Resources">
            <ResourceList res={s.intel.resources} />
          </Line>
          <Line label="Loyalty / population">
            {fmtExact(s.intel.loyalty)} / {fmtExact(s.intel.population)}
          </Line>
          {s.intel.heroes && <Line label="Heroes">{s.intel.heroes.map((h) => `${h.name} Lv ${h.level}`).join(' · ') || 'none'}</Line>}
          {s.intel.stationed.length > 0 && (
            <Line label="Reinforcements">
              {s.intel.stationed.map((t, i) => (
                <div key={i}>
                  <TroopList troops={t} />
                </div>
              ))}
            </Line>
          )}
        </>
      )}
    </div>
  );
}

function MovementView({ movement: m }: { movement: Extract<ReportBody, { kind: 'movement' }>['movement'] }) {
  return (
    <div className="grid gap-1.5 text-sm">
      {'from' in m && <Line label="From">{m.from}</Line>}
      <Line label="Hero">{m.hero ? `${m.hero.name} Lv ${m.hero.level}` : 'none'}</Line>
      <Line label="Troops">
        <TroopList troops={m.troops} />
      </Line>
      {'resources' in m && (
        <Line label={'heroReturned' in m ? 'Resources' : 'Brought home'}>
          <ResourceList res={m.resources} empty="nothing" />
        </Line>
      )}
      {'heroReturned' in m && m.heroReturned && <p className="text-xs text-muted-foreground">No free Feasting Hall slot: the hero returned home.</p>}
    </div>
  );
}

function TradeView({ trade: t }: { trade: Extract<ReportBody, { kind: 'trade' }>['trade'] }) {
  if ('side' in t) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={t.side === 'buy' ? 'Bought' : 'Sold'}>
          {fmtExact(t.amount)} {RES_LABEL[t.resource]?.toLowerCase()} at {t.price.toLocaleString('en', { maximumFractionDigits: 3 })}
        </Line>
        <Line label="Gold">{fmtExact(t.gold)}</Line>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label="From">{t.from}</Line>
      <Line label="To">{t.to}</Line>
      <Line label="Goods">
        <ResourceList res={t.resources} />
      </Line>
    </div>
  );
}
