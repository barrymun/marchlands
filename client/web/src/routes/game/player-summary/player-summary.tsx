import { Crown } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { Feature } from '@marchlands/core';

import { Badge } from '@/components/ui/badge';
import { useFeature, usePlayer } from '@/hooks/use-game';
import { fmt, fmtExact } from '@/lib/format';
import { seatTitleName, titleName } from '@/lib/game-data';

/** The player at a glance: title and name, prestige, rank and honour, and beginner protection while it lasts (it protects from other players, so only with PvP on). */
export function PlayerSummary() {
  const { t } = useTranslation('game');
  const info = usePlayer().data?.playerInfo;
  const pvp = useFeature(Feature.PVP);
  if (!info) return null;
  return (
    <div className="grid min-w-0 gap-0.5 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Crown className="size-4 shrink-0 text-amber-500" />
        <span className="truncate">{t('titledName', { title: titleName(info.titleId), name: info.userName })}</span>
        {info.seatTitle && (
          <Badge variant="outline" className="shrink-0">
            {seatTitleName(info.seatTitle)}
          </Badge>
        )}
        {pvp && info.beginner && (
          <Badge variant="secondary" className="shrink-0">
            {t('beginnerProtection')}
          </Badge>
        )}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        <Trans
          t={t}
          i18nKey="playerStats"
          values={{ prestige: fmt(info.prestige), rank: info.ranking || '—', honor: fmt(info.honor) }}
          components={{ prestige: <span title={fmtExact(info.prestige)} />, honor: <span title={fmtExact(info.honor)} /> }}
        />
      </span>
    </div>
  );
}
