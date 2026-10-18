import { Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { usePlayer } from '@/hooks/use-game';
import { fmt } from '@/lib/format';
import { titleName } from '@/lib/game-data';

/** The player at a glance: title and name, prestige, rank and honour, and beginner protection while it lasts. */
export function PlayerSummary() {
  const { t } = useTranslation('game');
  const info = usePlayer().data?.playerInfo;
  if (!info) return null;
  return (
    <div className="grid min-w-0 gap-0.5 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Crown className="size-4 shrink-0 text-amber-500" />
        <span className="truncate">{t('titledName', { title: titleName(info.titleId), name: info.userName })}</span>
        {info.beginner && (
          <Badge variant="secondary" className="shrink-0">
            {t('beginnerProtection')}
          </Badge>
        )}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t('playerStats', { prestige: fmt(info.prestige), rank: info.ranking || '—', honor: fmt(info.honor) })}
      </span>
    </div>
  );
}
