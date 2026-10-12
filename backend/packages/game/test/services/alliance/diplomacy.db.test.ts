import { describe, expect, it } from 'vitest';
import { AllianceRank, BALANCE, msg, Relation, scaled } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { alliance } from '#/index.ts';
import { addMember, allianceRow, createTestAlliance, relationsOf } from '#test/support/alliance.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

const ids = (list: { id: number }[]) => list.map((x) => x.id);

describe(alliance.setRelation.name, () => {
  it('friendship is one-sided and announced to the other alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const vice = await addMember(g, a, AllianceRank.VICE_HOST);
      const b = await createTestAlliance(g);
      g._pushes.length = 0;
      await alliance.setRelation(g, vice.id, b.name.toLowerCase(), Relation.ALLY);

      expect(ids((await relationsOf(g, a)).friendlyList)).toEqual([b.id]);
      expect(await relationsOf(g, b)).toEqual({ friendlyList: [], middleList: [], enemyList: [] });
      const told = msg('alliance.event.relationSet', { name: a.name, relation: msg('alliance.relation.ally') });
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)).toEqual([
        { playerIds: [b.host.id], cmd: PushCmd.SYSTEM_INFO_MESSAGE, data: { alliance: true, tV: false, noSenderSystemInfo: false, msg: told } },
      ]);
      expect((await alliance.events(g, b.host.id)).map((e) => e.message)).toContainEqual(told);
    }));

  it('changes an existing relation', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      await alliance.setRelation(g, a.host.id, b.name, Relation.ALLY);
      await alliance.setRelation(g, a.host.id, b.name, Relation.NEUTRAL);
      expect(await relationsOf(g, a)).toMatchObject({ friendlyList: [], middleList: [{ id: b.id }] });
    }));

  it('war is mutual, broadcast to everyone, and puts both alliances on the war cooldown', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      await alliance.setRelation(g, b.host.id, a.name, Relation.ALLY);
      g._pushes.length = 0;
      await alliance.setRelation(g, a.host.id, b.name, Relation.ENEMY);

      expect(ids((await relationsOf(g, a)).enemyList)).toEqual([b.id]);
      expect(await relationsOf(g, b)).toMatchObject({ friendlyList: [], enemyList: [{ id: a.id }] });
      const until = g.now + scaled(BALANCE.allianceWarCooldownMs);
      expect((await allianceRow(g, a.id)).warCooldownUntil).toBe(until);
      expect((await allianceRow(g, b.id)).warCooldownUntil).toBe(until);
      expect(g.pushes(PushCmd.SYSTEM_INFO_MESSAGE)[0]).toEqual({
        playerIds: [],
        cmd: PushCmd.SYSTEM_INFO_MESSAGE,
        data: { alliance: false, tV: true, noSenderSystemInfo: true, msg: msg('alliance.warDeclared', { name: a.name, target: b.name }) },
      });
    }));

  it('no new war until the cooldown has passed, for either side', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const c = await createTestAlliance(g);
      await alliance.setRelation(g, a.host.id, b.name, Relation.ENEMY);
      g.advance(scaled(BALANCE.allianceWarCooldownMs) - 1);
      await expectRefused(alliance.setRelation(g, a.host.id, c.name, Relation.ENEMY), msg('alliance.warCooldown'));
      await expectRefused(alliance.setRelation(g, b.host.id, c.name, Relation.ENEMY), msg('alliance.warCooldown'));
      // other relations are not limited
      await alliance.setRelation(g, a.host.id, c.name, Relation.ALLY);
      g.advance(1);
      await alliance.setRelation(g, a.host.id, c.name, Relation.ENEMY);
      expect(ids((await relationsOf(g, a)).enemyList).sort()).toEqual([b.id, c.id].sort());
    }));

  it('rejects the relation already set, quoting it', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      await alliance.setRelation(g, a.host.id, b.name, Relation.NEUTRAL);
      await expectRefused(
        alliance.setRelation(g, a.host.id, b.name, Relation.NEUTRAL),
        msg('alliance.alreadyRelation', { relation: msg('alliance.relation.neutral') }),
      );
      await alliance.setRelation(g, a.host.id, b.name, Relation.ENEMY);
      await expectRefused(
        alliance.setRelation(g, b.host.id, a.name, Relation.ENEMY),
        msg('alliance.alreadyRelation', { relation: msg('alliance.relation.enemy') }),
      );
    }));

  it('needs Vice Host or above, a valid relation and another, existing alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const b = await createTestAlliance(g);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.setRelation(g, a.host.id, b.name, 0), msg('alliance.invalidRelation'));
      await expectRefused(alliance.setRelation(g, a.host.id, b.name, 4), msg('alliance.invalidRelation'));
      await expectRefused(alliance.setRelation(g, outsider.id, b.name, Relation.ALLY), msg('alliance.notMember'));
      await expectRefused(alliance.setRelation(g, presbyter.id, b.name, Relation.ALLY), msg('alliance.rankTooLow'));
      await expectRefused(alliance.setRelation(g, a.host.id, 'No Such Order', Relation.ALLY), msg('alliance.namedNotFound', { name: 'No Such Order' }));
      await expectRefused(alliance.setRelation(g, a.host.id, a.name, Relation.ALLY), msg('alliance.invalidTarget'));
    }));
});

describe(alliance.dropRelation.name, () => {
  it("drops this alliance's relation only (the other side of a war stays)", () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const b = await createTestAlliance(g);
      const c = await createTestAlliance(g);
      await alliance.setRelation(g, a.host.id, b.name, Relation.ENEMY);
      await alliance.setRelation(g, a.host.id, c.name, Relation.ALLY);
      await alliance.dropRelation(g, a.host.id, b.name);
      expect(await relationsOf(g, a)).toMatchObject({ friendlyList: [{ id: c.id }], enemyList: [] });
      expect(ids((await relationsOf(g, b)).enemyList)).toEqual([a.id]);
      await alliance.dropRelation(g, a.host.id, b.name); // no relation left: no error
    }));

  it('needs Vice Host or above and an existing alliance', () =>
    game(async (g) => {
      const a = await createTestAlliance(g);
      const presbyter = await addMember(g, a, AllianceRank.PRESIDENT);
      const b = await createTestAlliance(g);
      const outsider = await createTestPlayer(g);
      await expectRefused(alliance.dropRelation(g, outsider.id, b.name), msg('alliance.notMember'));
      await expectRefused(alliance.dropRelation(g, presbyter.id, b.name), msg('alliance.rankTooLow'));
      await expectRefused(alliance.dropRelation(g, a.host.id, 'No Such Order'), msg('alliance.namedNotFound', { name: 'No Such Order' }));
    }));
});
