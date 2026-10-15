import { Medal } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { medalSources } from '@marchlands/core';

import { pct, range } from '@/components/items-panel/medal-sources-info/utils';
import { fmt } from '@/lib/format';
import { itemName, questName } from '@/lib/game-data';

/** Where a medal comes from, with the odds (core medalSources: the server's own drop rules). */
export function MedalSourcesInfo({ level }: { level: number }) {
  const { t } = useTranslation('items-panel');
  const s = medalSources(level);
  const hl = <span className="text-foreground" />;
  return (
    <div className="mt-1 grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <Medal className="size-3.5 text-amber-500" /> {t('medals.title')}
      </div>
      <ul className="grid gap-1 text-muted-foreground">
        {s.attacks.length > 0 && (
          <li>
            <Trans t={t} i18nKey="medals.attacks" components={{ hl }} />
            <span className="mt-0.5 flex flex-wrap gap-1">
              {s.attacks.map((a) => (
                <span key={a.cityLevel} className="rounded bg-background px-1.5 py-px tabular-nums">
                  {t('medals.attackChance', { level: a.cityLevel, chance: pct(a.chance) })}
                </span>
              ))}
            </span>
          </li>
        )}
        {s.containers.map((c) => (
          <li key={c.id}>
            <Trans
              t={t}
              i18nKey={c.key ? 'medals.containerKey' : 'medals.container'}
              values={{
                name: itemName(c.id),
                amount: c.always ? range(c.min, c.max) : t('medals.sometimes', { range: range(c.min, c.max) }),
                price: fmt(c.price),
                opener: c.key ? itemName(c.key) : null,
              }}
              components={{ hl }}
            />
          </li>
        ))}
        {s.quests.map((q) => (
          <li key={q.questId}>
            <Trans t={t} i18nKey="medals.quest" values={{ name: questName(q.questId), n: q.count }} components={{ hl }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
