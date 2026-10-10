import { TILE_NAMES, type BattleReport } from '@marchlands/core';
import { Badge } from '@/components/ui/badge';
import { usePlayer } from '@/hooks/use-game';
import { resultLabel } from '@/components/reports-panel/report-dialog/report-content/battle-view/utils';
import { LootBox } from '@/components/reports-panel/report-dialog/report-content/battle-view/loot-box/loot-box';
import { SideView } from '@/components/reports-panel/report-dialog/report-content/battle-view/side-view/side-view';

export function BattleView({ battle: b }: { battle: BattleReport }) {
  const player = usePlayer();
  const me = player.data?.playerInfo.userName;
  const myWin = (b.result === 'attackerWon' && b.attacker.player === me) || (b.result === 'defenderWon' && b.defender.player === me);
  const myLoss = (b.result === 'attackerWon' && b.defender.player === me) || (b.result === 'defenderWon' && b.attacker.player === me);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={myWin ? 'default' : myLoss ? 'destructive' : 'secondary'}>
          {myWin ? 'Victory' : myLoss ? 'Defeat' : b.result === 'draw' ? 'Draw' : resultLabel(b.result)}
        </Badge>
        <span className="text-muted-foreground">
          {b.rounds} round{b.rounds === 1 ? '' : 's'}
        </span>
        {'valley' in b && (
          <span>
            {TILE_NAMES[b.valley.type] ?? 'Valley'} Lv {b.valley.level}: {b.occupied ? 'occupied' : b.reason ? `not occupied (${b.reason})` : 'not occupied'}
          </span>
        )}
        {'level' in b && <span>Barbarian city Lv {b.level}</span>}
        {'city' in b && <span>{b.city}</span>}
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <SideView title="Attacker" side={b.attacker} />
        <SideView title="Defender" side={b.defender} forts={b.defender.forts} wallLevel={b.defender.wallLevel} />
      </div>
      <LootBox battle={b} me={me} />
    </div>
  );
}
