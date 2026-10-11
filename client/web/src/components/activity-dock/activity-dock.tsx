// A floating, frosted "in progress" dock (bottom left; a bottom bar on phones) for the current
// city's construction, research and training, so in-page status cards no longer pop in and out.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CityBean } from '@marchlands/api-client';
import { GROUPS, PER_GROUP, STORE_KEY } from '@/components/activity-dock/constants';
import { useJobs } from '@/components/activity-dock/hooks';
import { readCollapsed } from '@/components/activity-dock/utils';
import { useNow } from '@/hooks/use-now';
import { useSticky } from '@/hooks/use-sticky';
import { duration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { JobRow } from '@/components/activity-dock/job-row/job-row';

export function ActivityDock({ city }: { city: CityBean }) {
  const { t } = useTranslation('activity-dock');
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
      aria-label={t('title')}
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
          <span className="font-medium">{t('title')}</span>
          <span className="truncate text-muted-foreground tabular-nums">
            {t('summary', { jobs: shown.length, next: next ? (next.endTime > now ? duration(next.endTime - now) : t('finishing')) : '—' })}
          </span>
        </span>
        {collapsed ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {!collapsed && (
        <div className="grid max-h-[45svh] gap-2 overflow-y-auto px-3 pb-3 sm:max-h-[60svh]">
          {GROUPS.map(({ id, icon: Icon, label }) => {
            const list = shown.filter((j) => j.group === id);
            if (!list.length) return null;
            return (
              <section key={id} className="grid gap-1.5">
                <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <Icon className="size-3" /> {label}
                </h3>
                {list.slice(0, PER_GROUP).map((j) => (
                  <JobRow key={j.key} job={j} now={now} />
                ))}
                {list.length > PER_GROUP && (
                  <button type="button" className="text-left text-[11px] text-muted-foreground hover:underline" onClick={list[PER_GROUP].open}>
                    {t('more', { n: list.length - PER_GROUP })}
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
