import { useTranslation } from 'react-i18next';
import type { SendTarget } from '@/components/send-army-dialog/types';

/** What a scouting mission does at this kind of target (combat.ts arriveScout). */
export function ScoutNote({ kind }: { kind?: SendTarget['kind'] }) {
  const { t } = useTranslation('send-army-dialog');
  const text = kind === 'city' ? t('scoutNote.city') : kind === 'npc' ? t('scoutNote.npc') : kind === 'valley' ? t('scoutNote.valley') : t('scoutNote.other');
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
