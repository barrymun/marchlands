// processArmy for attacks on valleys (free or another lord's), occupation and its limit; giving a valley up
// and raising a free valley's level.

import { describe, expect, it } from 'vitest';
import { ArmyDirection, BuildingType, createGuardHero, HeroStatus, maxValleysFor, Mission, msg, ref, seededRng } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { getHero, getTile, valleysOfCity } from '#/repo.ts';
import {
  allies,
  armyRow,
  arrive,
  battleOf,
  expectWipedHero,
  lastReport,
  NO_RESOURCES,
  occupyValley,
  reportsOf,
  reportTitles,
  roundTrip,
  send,
  valleyNear,
  warrior,
} from '#test/support/armies.ts';
import { addHero, cityBundle, reloadPlayer, setCityStats, setTownHall, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { processArmy } from '#/engine/combat.ts';

/** p attacks a valley; runs the march to the battle and returns the army id and p's latest report. */
async function attack(g: TestGame, p: TestPlayer, heroId: number, tileId: number, troops: Record<string, number> = { lightCavalry: 40_000 }) {
  const bean = await send(g, p, { targetTileId: tileId, mission: Mission.ATTACK, troops, heroId });
  await arrive(g, bean.armyId);
  return { armyId: bean.armyId, report: (await reportsOf(g, p.id)).at(-1)! };
}

/** q holds a valley near p with `garrison` stationed in it (and q's hero leading it). */
async function heldValley(g: TestGame, garrison: Record<string, number>) {
  const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
  const { p: q, heroId: qHero } = await warrior(g);
  const valley = await occupyValley(g, q, qHero);
  await setCityStats(g, q, { troops: garrison });
  const camp = await send(g, q, { targetTileId: valley.id, mission: Mission.REINFORCE, troops: garrison, heroId: qHero });
  await arrive(g, camp.armyId);
  return { p, heroId, q, qHero, valley, campId: camp.armyId };
}

describe(`${processArmy.name}: attacking a valley`, () => {
  it('a free valley won is occupied by the army’s city', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const { armyId, report } = await attack(g, p, heroId, valley.id);

      expect(report).toMatchObject({ title: msg('report.title.valleyOccupied'), isAttack: true });
      const b = battleOf(report, 'valley');
      expect(b).toMatchObject({ result: 'attackerWon', occupied: true, reason: null, valley: { type: valley.type, level: 1 }, defender: { player: '' } });
      const tile = await getTile(g, valley.id);
      expect(tile).toMatchObject({ ownerCityId: p.cityId, ownerPlayerId: p.id, troops: null, state: null, updatedAt: g.now });
      expect((await cityBundle(g, p)).valleys.map((v) => v.id)).toEqual([valley.id]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).some((x) => x.playerIds.includes(p.id))).toBe(true);

      expect((await reloadPlayer(g, p)).honor).toBe(b.attacker.honor);
      expect((await getHero(g, heroId)).experience).toBe(b.attacker.heroExp);
      // nothing to plunder in a valley
      expect(await armyRow(g, armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: b.attacker.troops.after, resources: NO_RESOURCES });
    }));

  it('a free valley’s garrison and defending hero (the one scouts report) hold against a small army', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { militia: 10 });
      const loyalty = (await getHero(g, heroId)).loyalty;
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const { armyId, report } = await attack(g, p, heroId, valley.id, { militia: 10 });
      expect(report.title).toEqual(msg('report.title.attackFailed'));
      const b = battleOf(report, 'valley');
      expect(b).toMatchObject({ result: 'defenderWon', occupied: false, reason: null });
      const tile = await getTile(g, valley.id);
      expect(tile.ownerPlayerId).toBeNull();
      expect(tile.troops).toEqual(b.defender.troops.after);
      const guard = createGuardHero(20, seededRng(`guard:${tile.state!.heroSeed}`));
      expect(b.defender.hero).toMatchObject({ name: guard.name, level: guard.level });
      expect(await armyRow(g, armyId)).toBeUndefined();
      await expectWipedHero(g, heroId, loyalty, p, null);
    }));

  it('a city holds one valley per Town Hall level', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      expect(maxValleysFor(1)).toBe(1);
      const first = await occupyValley(g, p, heroId);
      await setCityStats(g, p, { troops: { lightCavalry: 40_000 } });
      const second = await valleyNear(g, p.cityId, { level: 1 });
      expect(second.id).not.toBe(first.id);
      const { armyId, report } = await attack(g, p, heroId, second.id);
      expect(report.title).toEqual(msg('report.title.attackSucceeded'));
      expect(battleOf(report, 'valley')).toMatchObject({
        result: 'attackerWon',
        occupied: false,
        reason: msg('army.valleyLimit', { building: ref.building(BuildingType.TOWN_HALL) }),
      });
      expect((await getTile(g, second.id)).ownerPlayerId).toBeNull();

      await roundTrip(g, armyId);
      await setCityStats(g, p, { troops: { lightCavalry: 40_000 } });
      await setTownHall(g, p, 2);
      await attack(g, p, heroId, second.id);
      expect((await getTile(g, second.id)).ownerPlayerId).toBe(p.id);
      expect((await valleysOfCity(g, p.cityId)).map((v) => v.id).sort()).toEqual([first.id, second.id].sort());
    }));

  it('turns back from a valley it already holds', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const hero2 = await addHero(g, p);
      const valley = await valleyNear(g, p.cityId, { level: 1 });
      const first = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 30_000 }, heroId });
      const second = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 10_000 }, heroId: hero2 });
      expect(second.reachTime).toBe(first.reachTime);
      await arrive(g, first.armyId); // both arrive, the first one takes the valley
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(p.id);
      expect(await armyRow(g, second.armyId)).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: { lightCavalry: 10_000 } });
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.valleyAlreadyHeld') });
    }));

  it('another lord’s garrison defends the valley; the owner keeps the honor and gets the report', () =>
    game(async (g) => {
      const { p, heroId, q, qHero, valley, campId } = await heldValley(g, { archer: 50_000 });
      const honor = (await reloadPlayer(g, q)).honor;
      const exp = (await getHero(g, qHero)).experience;
      const { report } = await attack(g, p, heroId, valley.id, { lightCavalry: 500 });
      expect(report.title).toEqual(msg('report.title.attackFailed'));
      const b = battleOf(report, 'valley');
      const guard = await getHero(g, qHero);
      expect(b).toMatchObject({ result: 'defenderWon', occupied: false, defender: { player: q.name, hero: { name: guard.name, level: guard.level } } });
      expect(await lastReport(g, q.id, 'report.title.valleyDefended')).toMatchObject({ body: report.body });
      expect((await armyRow(g, campId))!.troops).toEqual(b.defender.troops.after);
      expect((await reloadPlayer(g, q)).honor - honor).toBe(b.defender.honor);
      expect(guard.experience - exp).toBe(b.defender.heroExp);
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(q.id);
    }));

  it('taking another lord’s valley sends what is left of the garrison home', () =>
    game(async (g) => {
      const { p, heroId, q, valley, campId } = await heldValley(g, { lightCavalry: 30_000 });
      const { report } = await attack(g, p, heroId, valley.id, { lightCavalry: 40_000 });
      const b = battleOf(report, 'valley');
      expect(b).toMatchObject({ result: 'attackerWon', occupied: true, defender: { player: q.name } });
      expect(await getTile(g, valley.id)).toMatchObject({ ownerPlayerId: p.id, ownerCityId: p.cityId });
      expect(await reportTitles(g, q.id)).toContain('report.title.valleyLost');
      const camp = await armyRow(g, campId);
      if (camp) expect(camp).toMatchObject({ direction: ArmyDirection.BACKWARD, troops: b.defender.troops.after });
      else expect(b.defender.troops.after).toEqual({});
      expect((await cityBundle(g, q)).valleys).toEqual([]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).some((x) => x.playerIds.includes(q.id))).toBe(true);
    }));

  it('the hero of a garrison wiped out is idle again', () =>
    game(async (g) => {
      const { p, heroId, qHero, valley, campId } = await heldValley(g, { lightCavalry: 100 });
      const { report } = await attack(g, p, heroId, valley.id, { lightCavalry: 40_000 });
      expect(battleOf(report, 'valley')).toMatchObject({ result: 'attackerWon', defender: { troops: { after: {} } } });
      expect(battleOf(report, 'valley').defender.heroExp).toBeGreaterThan(0);
      expect(await armyRow(g, campId)).toBeUndefined();
      expect((await getHero(g, qHero)).status).toBe(HeroStatus.IDLE);
    }));

  it('an unguarded valley of another lord falls without a fight', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const { p: q, heroId: qHero } = await warrior(g);
      const valley = await occupyValley(g, q, qHero);
      const { report } = await attack(g, p, heroId, valley.id, { lightCavalry: 100 });
      const b = battleOf(report, 'valley');
      expect(b).toMatchObject({ result: 'attackerWon', occupied: true, defender: { player: q.name, hero: null, troops: { before: {} } } });
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(p.id);
    }));

  it('turns back from a valley whose owner became friendly', () =>
    game(async (g) => {
      const { p, heroId } = await warrior(g, { lightCavalry: 40_000 });
      const { p: q, heroId: qHero } = await warrior(g);
      const valley = await occupyValley(g, q, qHero);
      const bean = await send(g, p, { targetTileId: valley.id, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId });
      await allies(g, p, q);
      await arrive(g, bean.armyId);
      expect((await lastReport(g, p.id, 'report.title.missionAborted')).body).toEqual({ kind: 'text', text: msg('army.valleyNowFriendly') });
      expect((await getTile(g, valley.id)).ownerPlayerId).toBe(q.id);
    }));
});
