// A floating, frosted "in progress" dock (bottom left; a bottom bar on phones) for the current
// city's construction, research and training, so in-page status cards no longer pop in and out.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Hammer, FlaskConical, Swords } from 'lucide-react';
import type { CityBean } from '@evony/api-client';
import { buildingLevel, BuildingType } from '@evony/core';
import { Progress } from '@/components/ui/progress';
import { qk } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import { useSticky } from '@/hooks/use-sticky';
import { api, unwrap } from '@/lib/api';
import { duration, fmtExact, troopName } from '@/lib/format';
import { cn } from '@/lib/utils';

type Group = 'Building' | 'Research' | 'Training';

interface Job {
  key: string;
  group: Group;
  label: string;
  /** extra note, e.g. batches waiting behind this one */
  note?: string;
  startTime: number;
  endTime: number;
  open: () => void;
}

const GROUPS: { id: Group; icon: typeof Hammer }[] = [
  { id: 'Building', icon: Hammer },
  { id: 'Research', icon: FlaskConical },
  { id: 'Training', icon: Swords },
];
/** rows shown per group before "+N more" */
const PER_GROUP = 3;
const STORE_KEY = 'evony-activity-collapsed';

function readCollapsed(): boolean {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v != null) return v === '1';
  } catch {
    /* storage unavailable: fall through to the default */
  }
  // phones start collapsed so the dock does not cover the page
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

/** Everything running in the city: construction, research here, and the batch each barracks / the walls is producing. */
function useJobs(city: CityBean): Job[] {
  const navigate = useNavigate();
  const go = (tab: string, search = '') => navigate(`/cities/${city.id}/${tab}${search}`);
  const path = { params: { path: { cityId: city.id } } };
  const hasAcademy = buildingLevel(city.buildings, BuildingType.ACADEMY) > 0;
  const hasBarracks = city.buildings.some((b) => b.typeId === BuildingType.BARRACKS && b.level > 0);
  const hasWalls = buildingLevel(city.buildings, BuildingType.WALLS) > 0;
  const research = useQuery({
    queryKey: qk.research(city.id),
    enabled: hasAcademy,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', path)),
  });
  const troops = useQuery({
    queryKey: qk.queues(city.id, false),
    enabled: hasBarracks,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/troops/queues', path)),
  });
  const forts = useQuery({
    queryKey: qk.queues(city.id, true),
    enabled: hasWalls,
    queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/fortifications/queues', path)),
  });

  const jobs: Job[] = [];
  for (const b of city.buildings) {
    if (b.status === 0) continue;
    const demolishing = b.status === 2;
    jobs.push({
      key: `b${b.positionId}`,
      group: 'Building',
      label: `${b.name} → Lv ${demolishing ? b.level - 1 : b.level + 1}`,
      note: demolishing ? 'demolishing' : undefined,
      startTime: b.startTime,
      endTime: b.endTime,
      open: () => go('buildings', `?building=${b.positionId}`),
    });
  }
  for (const t of research.data?.techs ?? []) {
    if (!t.upgrading || t.castleId !== city.id) continue;
    jobs.push({
      key: `r${t.typeId}`,
      group: 'Research',
      label: `${t.name} → Lv ${t.level + 1}`,
      startTime: t.startTime,
      endTime: t.endTime,
      open: () => go('research'),
    });
  }
  for (const q of [...(troops.data?.queues ?? []), ...(forts.data?.queues ?? [])]) {
    const running = q.allProduceQueue.find((x) => x.startTime > 0 && x.endTime > 0);
    if (!running) continue;
    const waiting = q.allProduceQueue.length - 1;
    jobs.push({
      key: `t${q.positionId}:${running.queueId}`,
      group: 'Training',
      label: `${troopName(running.type)} ×${fmtExact(running.num)}`,
      note: waiting > 0 ? `+${waiting} queued` : undefined,
      startTime: running.startTime,
      endTime: running.endTime,
      open: () => go('military'),
    });
  }
  return jobs.sort((a, b) => a.endTime - b.endTime);
}

export function ActivityDock({ city }: { city: CityBean }) {
  const jobs = useJobs(city);
  const now = useNow();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, collapsed ? '1' : '0');
    } catch {
      /* not persisted: fine */
    }
  }, [collapsed]);
  // keep the last jobs on screen while the dock fades out
  const shown = useSticky(jobs.length ? jobs : null) ?? [];
  const visible = jobs.length > 0;
  const next = jobs[0];

  return (
    <aside
      aria-label="In progress"
      aria-hidden={!visible}
      className={cn(
        'fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-80',
        'rounded-xl border bg-background/65 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-background/55',
        'transition-all duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-medium">In progress</span>
          <span className="truncate text-muted-foreground tabular-nums">
            {shown.length} · next {next ? (next.endTime > now ? duration(next.endTime - now) : 'finishing…') : '—'}
          </span>
        </span>
        {collapsed ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {!collapsed && (
        <div className="grid max-h-[45svh] gap-2 overflow-y-auto px-3 pb-3 sm:max-h-[60svh]">
          {GROUPS.map(({ id, icon: Icon }) => {
            const list = shown.filter((j) => j.group === id);
            if (!list.length) return null;
            return (
              <section key={id} className="grid gap-1.5">
                <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <Icon className="size-3" /> {id}
                </h3>
                {list.slice(0, PER_GROUP).map((j) => (
                  <JobRow key={j.key} job={j} now={now} />
                ))}
                {list.length > PER_GROUP && (
                  <button type="button" className="text-left text-[11px] text-muted-foreground hover:underline" onClick={list[PER_GROUP].open}>
                    +{list.length - PER_GROUP} more
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function JobRow({ job, now }: { job: Job; now: number }) {
  const total = job.endTime - job.startTime;
  const pct = total > 0 ? Math.min(100, Math.max(0, ((now - job.startTime) / total) * 100)) : 100;
  const left = job.endTime - now;
  return (
    <button
      type="button"
      onClick={job.open}
      className="grid animate-in gap-1 rounded-md px-1.5 py-1 text-left duration-300 fade-in slide-in-from-left-2 hover:bg-foreground/5"
    >
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">
          {job.label}
          {job.note && <span className="text-muted-foreground"> · {job.note}</span>}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{left > 0 ? duration(left) : 'finishing…'}</span>
      </span>
      <Progress value={pct} className="h-1" />
    </button>
  );
}
