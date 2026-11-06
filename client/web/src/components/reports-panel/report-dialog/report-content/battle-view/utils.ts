import { BattleResult } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

export const resultLabel = (r: string) =>
  r === BattleResult.ATTACKER_WON
    ? i18n.t('reports-panel:battle.result.attackerWon')
    : r === BattleResult.DEFENDER_WON
      ? i18n.t('reports-panel:battle.result.defenderWon')
      : i18n.t('reports-panel:battle.result.draw');
