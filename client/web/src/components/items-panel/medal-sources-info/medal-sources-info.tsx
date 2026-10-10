import { medalSources } from '@marchlands/core';
import { Medal } from 'lucide-react';
import { pct, range } from '@/components/items-panel/medal-sources-info/utils';
import { fmt } from '@/lib/format';

/** Where a medal comes from, with the odds (core medalSources: the server's own drop rules). */
export function MedalSourcesInfo({ level }: { level: number }) {
  const s = medalSources(level);
  return (
    <div className="mt-1 grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <Medal className="size-3.5 text-amber-500" /> Where to get it
      </div>
      <ul className="grid gap-1 text-muted-foreground">
        {s.attacks.length > 0 && (
          <li>
            <span className="text-foreground">Winning attacks</span> on NPC cities of these levels (a player&apos;s city counts its Town Hall level), chance per
            win:
            <span className="mt-0.5 flex flex-wrap gap-1">
              {s.attacks.map((a) => (
                <span key={a.cityLevel} className="rounded bg-background px-1.5 py-px tabular-nums">
                  Lv {a.cityLevel} · {pct(a.chance)}
                </span>
              ))}
            </span>
          </li>
        )}
        {s.containers.map((c) => (
          <li key={c.id}>
            <span className="text-foreground">{c.name}</span> ({c.always ? range(c.min, c.max) : `sometimes ${range(c.min, c.max)}`}): {fmt(c.price)} gold in
            the shop
            {c.key && ` (opens with a ${c.key})`}
          </li>
        ))}
        {s.quests.map((q) => (
          <li key={q.name}>
            <span className="text-foreground">Quest &ldquo;{q.name}&rdquo;</span>: {q.count} (once)
          </li>
        ))}
      </ul>
    </div>
  );
}
