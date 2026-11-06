import { useTranslation } from 'react-i18next';

import { type BattleReport, BattleResult, TileType } from '@marchlands/core';

import { LootBox } from '@/components/reports-panel/report-dialog/report-content/battle-view/loot-box/loot-box';
import { SideView } from '@/components/reports-panel/report-dialog/report-content/battle-view/side-view/side-view';
import { resultLabel } from '@/components/reports-panel/report-dialog/report-content/battle-view/utils';
import { Badge } from '@/components/ui/badge';
import { usePlayer } from '@/hooks/use-game';
import { tileName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';

export function BattleView({ battle: b }: { battle: BattleReport }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  const player = usePlayer();
  const me = player.data?.playerInfo.userName;
  const myWin = (b.result === BattleResult.ATTACKER_WON && b.attacker.player === me) || (b.result === BattleResult.DEFENDER_WON && b.defender.player === me);
  const myLoss = (b.result === BattleResult.ATTACKER_WON && b.defender.player === me) || (b.result === BattleResult.DEFENDER_WON && b.attacker.player === me);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={myWin ? 'default' : myLoss ? 'destructive' : 'secondary'}>
          {myWin ? t('battle.victory') : myLoss ? t('battle.defeat') : b.result === BattleResult.DRAW ? t('battle.result.draw') : resultLabel(b.result)}
        </Badge>
        <span className="text-muted-foreground">{t('battle.rounds', { count: b.rounds })}</span>
        {'valley' in b && (
          <span>
            {t('battle.valley', {
              name: tileName(b.valley.type),
              level: b.valley.level,
              status: b.occupied
                ? t('battle.occupied')
                : b.reason
                  ? t('battle.notOccupiedReason', { reason: translateMessage(b.reason) })
                  : t('battle.notOccupied'),
            })}
          </span>
        )}
        {'level' in b && <span>{t('common:level.named', { name: tileName(b.historic ? TileType.HISTORIC : TileType.NPC), level: b.level })}</span>}
        {'city' in b && <span>{b.city}</span>}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SideView title={t('battle.attacker')} side={b.attacker} />
        <SideView
          title={t('battle.defender')}
          side={b.defender}
          player={
            b.defender.player ||
            ('valley' in b ? t('battle.valleyDefenders') : 'level' in b ? tileName(b.historic ? TileType.HISTORIC : TileType.NPC) : undefined)
          }
          forts={b.defender.forts}
          wallLevel={b.defender.wallLevel}
        />
      </div>
      <LootBox battle={b} me={me} />
    </div>
  );
}
