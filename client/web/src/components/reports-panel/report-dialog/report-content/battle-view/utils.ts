import { i18n } from '@/lib/i18n';

export const resultLabel = (r: string) =>
  r === 'attackerWon'
    ? i18n.t('reports-panel:battle.result.attackerWon')
    : r === 'defenderWon'
      ? i18n.t('reports-panel:battle.result.defenderWon')
      : i18n.t('reports-panel:battle.result.draw');
