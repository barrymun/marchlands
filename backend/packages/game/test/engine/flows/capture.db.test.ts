import { and, eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { freshNpcState, tileId, TileType, tileXY } from '@marchlands/core';
import { tiles } from '@marchlands/db';

import { dropCapturedTarget } from '#/engine/flows.ts';
import { admin } from '#/index.ts';
import { getTile, saveTile } from '#/repo.ts';
import { createTestPlayer, reloadCity } from '#test/support/factories.ts';
import { armyPreset, farmingCity, flowOf, newFlow, runFlowIn } from '#test/support/flows.ts';
import { game, type TestGame } from '#test/support/game.ts';

const mayor = { type: 'setMayor', stat: 'power' };
const attack = (targets: Record<string, number[]>) => ({ type: 'attackTargets', presetId: '', targets });

/** The nearest barbarian city to this city. */
async function npcNear(g: TestGame, cityId: number) {
  const c = await reloadCity(g, cityId);
  const { x, y } = tileXY(c.tileId);
  const near: number[] = [];
  for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) near.push(tileId(x + dx, y + dy));
  const rows = await g.tx
    .select({ id: tiles.id })
    .from(tiles)
    .where(and(inArray(tiles.id, near), eq(tiles.type, TileType.NPC)));
  const dist = (id: number) => Math.abs(tileXY(id).x - x) + Math.abs(tileXY(id).y - y);
  const [nearest] = rows.map((r) => r.id).sort((p, q) => dist(p) - dist(q));
  if (nearest == null) throw new Error('no barbarian city near');
  return nearest;
}

describe(dropCapturedTarget.name, () => {
  it("takes the captured tile off every player's farming lists, and tells them", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const fa = await newFlow(g, a, { name: 'A', actions: [mayor, attack({ [a.cityId]: [100, 200, 300] }), attack({ [a.cityId]: [200] })] });
      const fb = await newFlow(g, b, { name: 'B', actions: [attack({ [b.cityId]: [200] })] });

      await dropCapturedTarget(g, 200);
      expect((await flowOf(g, a, fa.id)).actions).toEqual([mayor, attack({ [a.cityId]: [100, 300] }), attack({ [a.cityId]: [] })]);
      expect((await flowOf(g, b, fb.id)).actions).toEqual([attack({ [b.cityId]: [] })]);
      expect(g.pushes(PushCmd.FLOW_UPDATE).map((p) => [p.playerIds, p.data])).toEqual(
        expect.arrayContaining([
          [[a.id], { flowId: fa.id, status: 'idle' }],
          [[b.id], { flowId: fb.id, status: 'idle' }],
        ]),
      );
    }));

  it('leaves flows that do not list the tile alone', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const f = await newFlow(g, a, { name: 'A', actions: [mayor, attack({ [a.cityId]: [100, 300] })] });
      await dropCapturedTarget(g, 200);
      expect((await flowOf(g, a, f.id)).actions).toEqual([mayor, attack({ [a.cityId]: [100, 300] })]);
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toEqual([]);
    }));
});

describe(`${dropCapturedTarget.name} (through combat)`, () => {
  it('a barbarian city taken by an attack leaves the farming lists that had it', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await admin.setPlayerFlags(g, a.name, { title: 9, beginner: false });
      await farmingCity(g, a, a.cityId, 5000);
      const npc = await npcNear(g, a.cityId);
      // a barbarian city with no defenders left and its loyalty nearly gone (not regenerating before the army arrives)
      const tile = await getTile(g, npc);
      const { state } = freshNpcState(tile.level, g.now + 3_600_000);
      await saveTile(g, { ...tile, state: { ...state, loyalty: 1 }, troops: {}, forts: {} });

      const preset = await armyPreset(g, a, 'Siege', { militia: 5000 });
      const fa = await newFlow(g, a, { name: 'Take', actions: [{ type: 'attackTargets', presetId: preset, targets: { [a.cityId]: [npc] } }] });
      const fb = await newFlow(g, b, { name: 'Farm', actions: [attack({ [b.cityId]: [npc, 5] })] });
      await runFlowIn(g, a, fa.id);
      await g.runDue(g.events('army')[0].dueAt);

      expect((await getTile(g, npc)).ownerPlayerId).toBe(a.id);
      expect((await flowOf(g, a, fa.id)).actions[0]).toMatchObject({ targets: { [a.cityId]: [] } });
      expect((await flowOf(g, b, fb.id)).actions[0]).toMatchObject({ targets: { [b.cityId]: [5] } });
      expect(g.pushes(PushCmd.FLOW_UPDATE)).toContainEqual(expect.objectContaining({ playerIds: [b.id], data: { flowId: fb.id, status: 'idle' } }));
    }));
});
