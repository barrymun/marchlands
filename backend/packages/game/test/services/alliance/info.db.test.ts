import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AllianceRank, ArmyDirection, BALANCE, Mission, msg, Relation } from '@marchlands/core';
import { alliances, armies, players } from '@marchlands/db';
import { alliance } from '#/index.ts';
import { addMember, createTestAlliance, relationsOf } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** An army row between two players' cities (what armies.send would store). */
async function insertArmy(g: TestGame, from: TestPlayer, to: TestPlayer) {
  const [start, target] = [await reloadCity(g, from.cityId), await reloadCity(g, to.cityId)];
  const pos = (name: string) => msg('world.position.city', { name, x: 0, y: 0 });
  const [row] = await g.tx
    .insert(armies)
    .values({
      playerId: from.id,
      cityId: from.cityId,
      mission: Mission.ATTACK,
      direction: ArmyDirection.FORWARD,
      startTileId: start.tileId,
      targetTileId: target.tileId,
      targetPlayerId: to.id,
      troops: {},
      resources: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 },
      startTime: g.now,
      reachTime: g.now + 60_000,
      startPosName: pos(from.name),
      targetPosName: pos(to.name),
      createdAt: g.now,
    })
    .returning();
  return row;
}

describe(alliance.myAlliance.name, () => {
  it('is null for a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await alliance.myAlliance(g, p.id)).toBeNull();
    }));

  it('describes the alliance, the live member count and the relation lists', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      await alliance.setInfo(g, a.host.id, { note: 'Note', intro: 'Intro', motd: 'Hello' });
      const info = await alliance.myAlliance(g, m.id);
      expect(info).toEqual({
        friendlyList: [],
        middleList: [],
        enemyList: [],
        myRank: AllianceRank.MEMBER,
        alliance: {
          id: a.id,
          allianceName: a.name,
          creatorName: a.host.name,
          leaderName: a.host.name,
          allianceNote: 'Note',
          allianceInfo: 'Intro',
          motd: 'Hello',
          memberCount: 2,
          memberLimit: BALANCE.allianceMaxMembers,
          prestige: 0,
          rank: 0,
        },
      });
    }));

  it('has no leader name when the alliance has no leader', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await g.tx.update(alliances).set({ leaderPlayerId: null }).where(eq(alliances.id, a.id));
      expect((await alliance.myAlliance(g, a.host.id))?.alliance.leaderName).toBe('');
    }));
});

describe(`${alliance.myAlliance.name}: relation lists`, () => {
  it('lists the alliances this one set as ally, neutral and enemy', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const [ally, neutral, enemy] = [await createTestAlliance(g), await createTestAlliance(g), await createTestAlliance(g)];
      await alliance.setRelation(g, a.host.id, ally.name, Relation.ALLY);
      await alliance.setRelation(g, a.host.id, neutral.name, Relation.NEUTRAL);
      await alliance.setRelation(g, a.host.id, enemy.name, Relation.ENEMY);
      const summary = (x: { id: number; name: string }) => ({ id: x.id, allianceName: x.name, rank: 0, prestige: 0, honor: 0, memberCount: 1 });
      expect(await relationsOf(g, a)).toEqual({ friendlyList: [summary(ally)], middleList: [summary(neutral)], enemyList: [summary(enemy)] });
      // friendship is one-sided, war is mutual
      expect(await relationsOf(g, ally)).toEqual({ friendlyList: [], middleList: [], enemyList: [] });
      expect((await relationsOf(g, enemy)).enemyList).toEqual([summary(a)]);
    }));

  it('is empty for an alliance with no relations', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      expect(await relationsOf(g, a)).toEqual({ friendlyList: [], middleList: [], enemyList: [] });
    }));
});

describe(alliance.allianceInfo.name, () => {
  it('finds the alliance by name, ignoring case', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      await alliance.setInfo(g, a.host.id, { intro: 'We build.' });
      expect(await alliance.allianceInfo(g, a.name.toUpperCase())).toEqual({
        id: a.id,
        allianceName: a.name,
        leader: a.host.name,
        creator: a.host.name,
        prestigeCount: 0,
        ranking: 0,
        memberCount: 1,
        allianceInfo: 'We build.',
      });
    }));

  it('rejects an unknown alliance', () =>
    game(async (g) => {
      await expectRefused(alliance.allianceInfo(g, 'No Such Order'), msg('alliance.namedNotFound', { name: 'No Such Order' }));
    }));
});

describe(alliance.listAlliances.name, () => {
  it('searches by part of the name, by prestige then id, a page at a time', () =>
    game(async (g) => {
      const a = await createTestAlliance(g, { name: 'Zeta Wolves' });
      const b = await createTestAlliance(g, { name: 'Zeta Bears' });
      const c = await createTestAlliance(g, { name: 'Zeta Hawks' });
      await createTestAlliance(g, { name: 'Other Order' });
      await g.tx.update(alliances).set({ prestige: 500.7 }).where(eq(alliances.id, c.id));

      const page1 = await alliance.listAlliances(g, 'zeta', 1, 2);
      expect(page1).toMatchObject({ pageNo: 1, pageSize: 2, totalPage: 2 });
      expect(page1.alliances.map((x) => x.allianceName)).toEqual(['Zeta Hawks', 'Zeta Wolves']);
      expect(page1.alliances[0]).toEqual({ id: c.id, allianceName: 'Zeta Hawks', rank: 0, prestige: 500, honor: 0, memberCount: 1 });
      expect((await alliance.listAlliances(g, 'zeta', 2, 2)).alliances.map((x) => x.id)).toEqual([b.id]);
      expect((await alliance.listAlliances(g, 'WOLVES', 1, 10)).alliances.map((x) => x.id)).toEqual([a.id]);
    }));

  it('clamps the page and page size, and ignores LIKE wildcards in the key', () =>
    game(async (g) => {
      await createTestAlliance(g, { name: 'Alpha One' });
      await createTestAlliance(g, { name: 'Alpha Two' });
      const all = await alliance.listAlliances(g, '', 1, 50);
      expect((await alliance.listAlliances(g, '', 0, 0)).pageSize).toBe(1);
      expect(await alliance.listAlliances(g, '', -3, 1000)).toMatchObject({ pageNo: 1, pageSize: 50 });
      expect((await alliance.listAlliances(g, 'Alp%a', 1, 50)).alliances).toEqual([]);
      expect((await alliance.listAlliances(g, 'Al_pha', 1, 50)).alliances.map((x) => x.allianceName)).toEqual(['Alpha One', 'Alpha Two']);
      expect((await alliance.listAlliances(g, '%', 1, 50)).alliances).toEqual(all.alliances);
    }));
});

describe(alliance.members.name, () => {
  it('lists members by rank, then prestige', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const low = await addMember(g, a);
      const high = await addMember(g, a);
      const officer = await addMember(g, a, AllianceRank.OFFICER);
      await g.tx.update(players).set({ prestige: 99.9, honor: 5.5 }).where(eq(players.id, high.id));
      const list = await alliance.members(g, low.id);
      expect(list.map((m) => m.id)).toEqual([a.host.id, officer.id, high.id, low.id]);
      expect(list[2]).toMatchObject({ userName: high.name, levelId: AllianceRank.MEMBER, prestige: 99, honor: 5 });
    }));

  it("counts each member's cities", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      expect((await alliance.members(g, m.id)).map((x) => x.castleCount)).toEqual([1, 1]);
    }));

  it('rejects a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.members(g, p.id), msg('alliance.notMember'));
    }));
});

describe(alliance.events.name, () => {
  it('lists the event log newest first, up to the limit', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      g.advance(1000);
      const m = await addMember(g, a);
      const log = await alliance.events(g, m.id);
      expect(log).toEqual([
        { message: msg('alliance.event.joined', { name: m.name }), time: g.now },
        { message: msg('alliance.event.created', { name: a.name }), time: g.now - 1000 },
      ]);
      expect(await alliance.events(g, m.id, 1)).toHaveLength(1);
    }));

  it('rejects a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.events(g, p.id), msg('alliance.notMember'));
    }));
});

describe(alliance.militarySituation.name, () => {
  it("lists members' armies and armies coming at members, not others", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const m = await addMember(g, a);
      const outsider = await createTestPlayer(g);
      const stranger = await createTestPlayer(g);
      const out = await insertArmy(g, m, outsider);
      const incoming = await insertArmy(g, outsider, a.host);
      await insertArmy(g, outsider, stranger);

      const list = await alliance.militarySituation(g, a.host.id);
      expect(list.map((x) => x.armyId).sort()).toEqual([out.id, incoming.id].sort());
      expect(list.find((x) => x.armyId === out.id)).toEqual({
        armyId: out.id,
        king: m.name,
        missionType: Mission.ATTACK,
        direction: ArmyDirection.FORWARD,
        startPosName: out.startPosName,
        targetPosName: out.targetPosName,
        reachTime: out.reachTime,
        incoming: false,
      });
      expect(list.find((x) => x.armyId === incoming.id)).toMatchObject({ king: outsider.name, incoming: true });
    }));

  it('rejects a player in no alliance', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(alliance.militarySituation(g, p.id), msg('alliance.notMember'));
    }));
});
