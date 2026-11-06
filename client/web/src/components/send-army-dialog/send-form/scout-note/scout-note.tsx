import { useTranslation } from 'react-i18next';
import { BattleTarget } from '@marchlands/core';
import type { SendTarget } from '@/components/send-army-dialog/types';

/** What a scouting mission does at this kind of target (combat.ts arriveScout). */
export function ScoutNote({ kind }: { kind?: SendTarget['kind'] }) {
  const { t } = useTranslation('send-army-dialog');
  const text =
    kind === BattleTarget.CITY
      ? t('scoutNote.city')
      : kind === BattleTarget.NPC
        ? t('scoutNote.npc')
        : kind === BattleTarget.VALLEY
          ? t('scoutNote.valley')
          : t('scoutNote.other');
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
