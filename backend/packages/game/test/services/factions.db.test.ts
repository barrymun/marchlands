import { describe, expect, it } from 'vitest';

import { FACTION_IDS, MINUTE } from '@marchlands/core';

import { loadNpcEconomy, npcTradeTick, saveNpcEconomy } from '#/engine/npc-economy.ts';
import { factions } from '#/index.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

describe(factions.list.name, () => {
  it('lists every faction with nothing before their trade starts', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await factions.list(g, p.id)).toEqual(FACTION_IDS.map((id) => ({ id, gold: 0, treasury: 0, standing: 0 })));
    }));

  it("adds up each faction's groups: its gold now and its treasury", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await npcTradeTick(g);
      const all = await factions.list(g, p.id);
      for (const f of all) {
        expect(f.treasury).toBeGreaterThan(0);
        expect(f.gold).toBe(f.treasury);
      }
      // drain one faction's groups (the Saxon League holds zones 0-2)
      const econ = await loadNpcEconomy(g, false);
      if (!econ) throw new Error('no NPC economy');
      const gold = Object.fromEntries(econ.groups.map((x) => [`${x.zone}:${x.level}`, x.zone <= 2 ? 0 : (econ.gold[`${x.zone}:${x.level}`] ?? 0)]));
      await saveNpcEconomy(g, { ...econ, gold });
      g.advance(MINUTE);
      const after = await factions.list(g, p.id);
      expect(after.find((f) => f.id === 'saxon')?.gold).toBe(0);
      expect(after.find((f) => f.id === 'italian')?.gold).toBe(all.find((f) => f.id === 'italian')?.gold);
    }));
});
