// processArmy against historic cities (docs/features/historical-cities.md): scouting one, and attacks on its garrison
// and loyalty. Capturing one comes with the next phase.

import { describe, expect, it } from 'vitest';

import { BALANCE, DAY, historicDay, historicGarrison, type HistoricState, Mission, msg, TileType, tileXY } from '@marchlands/core';

import { processArmy } from '#/engine/combat.ts';
import { world } from '#/index.ts';
import { getTile, saveTile } from '#/repo.ts';
import { arrive, battleOf, reportsOf, scoutOf, send, warrior } from '#test/support/armies.ts';
import { reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** The nearest level 12 historic city to a player's city (they stand every 18 tiles, so one is always near). */
async function seatNear(g: TestGame, p: TestPlayer) {
  const { x, y } = tileXY((await reloadCity(g, p.cityId)).tileId);
  const found = (await world.searchTiles(g, x, y, 12, TileType.HISTORIC)).find((t) => t.level === 12);
  if (!found) throw new Error('no level 12 historic city near');
  return getTile(g, found.id);
}

describe(`${processArmy.name}: historic cities`, () => {
  it('a scout sees the day’s whole garrison, its fortifications and its loyalty', () =>
    game(async (g) => {
      const { p } = await warrior(g);
      const seat = await seatNear(g, p);
      const scout = await send(g, p, { targetTileId: seat.id, mission: Mission.SCOUT, troops: { scouter: 1 } });
      await arrive(g, scout.armyId);
      const s = scoutOf((await reportsOf(g, p.id)).at(-1)!, 'npc');
      const full = historicGarrison(12, historicDay(seat.id, Math.floor(scout.reachTime / DAY)));
      expect(s).toMatchObject({ level: 12, loyalty: BALANCE.historic.loyalty, troops: full.troops, fortifications: full.forts, wallLevel: 12 });
    }));

  it('a small attack fails and leaves the garrison a little weaker', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g);
      const seat = await seatNear(g, p);
      const bean = await send(g, p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { lightCavalry: 2000 }, heroId });
      await arrive(g, bean.armyId);
      const r = (await reportsOf(g, p.id)).at(-1)!;
      expect(r.title).toEqual(msg('report.title.attackFailed'));
      const b = battleOf(r, 'npc');
      expect(b).toMatchObject({ level: 12, loyaltyDamage: 0, loyaltyLeft: BALANCE.historic.loyalty, captured: false });
      const tile = await getTile(g, seat.id);
      expect(tile.troops).toEqual(b.defender.troops.after);
      expect((tile.state as unknown as HistoricState).loyalty).toBe(BALANCE.historic.loyalty);
    }));

  it('a won attack on a broken garrison takes its share of loyalty and some loot', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { archer: 60_000 });
      const seat = await seatNear(g, p);
      // as the waves before it left it: no troops or fortifications, loyalty full
      const bean = await send(g, p, { targetTileId: seat.id, mission: Mission.ATTACK, troops: { archer: 60_000 }, heroId });
      const day = Math.floor(bean.reachTime / DAY);
      const state = {
        gold: 0,
        food: 1_000_000,
        wood: 0,
        stone: 0,
        iron: 0,
        loyalty: BALANCE.historic.loyalty,
        population: 0,
        regenAt: bean.reachTime,
        loyaltyAt: bean.reachTime,
        refillAt: bean.reachTime,
        day,
      };
      await saveTile(g, { ...seat, troops: {}, forts: {}, state });
      await arrive(g, bean.armyId);
      const b = battleOf((await reportsOf(g, p.id)).at(-1)!, 'npc');
      expect(b).toMatchObject({
        result: 'attackerWon',
        loyaltyDamage: BALANCE.historic.loyaltyPerWin,
        loyaltyLeft: BALANCE.historic.loyalty - BALANCE.historic.loyaltyPerWin,
        captured: false,
      });
      expect(b.plunder.food).toBeGreaterThan(0);
      expect((await getTile(g, seat.id)).type).toBe(TileType.HISTORIC);
    }));
});
