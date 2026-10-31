import { describe, expect, it } from 'vitest';

import { BALANCE, FACTION_IDS, FactionId, homeFaction } from '@marchlands/core';

import { addStanding, cityTerms, standingsOf, tradedWithFactions } from '#/engine/reputation.ts';
import { getCity } from '#/repo.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';

const R = BALANCE.reputation;

describe(standingsOf.name, () => {
  it('stands at 0 with every faction until something changes it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await standingsOf(g, p.id)).toEqual(Object.fromEntries(FACTION_IDS.map((id) => [id, 0])));
    }));
});

describe(addStanding.name, () => {
  it('moves one faction, keeps it within ±max and lets it drift back towards 0', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await addStanding(g, p.id, FactionId.SAXON_LEAGUE, -30)).toBe(-30);
      expect(await addStanding(g, p.id, FactionId.SAXON_LEAGUE, -500)).toBe(-R.max);
      expect(await addStanding(g, p.id, FactionId.ITALIAN_LEAGUE, 12)).toBe(12);
      g.advance(R.driftHalfLifeMs);
      const now = await standingsOf(g, p.id);
      expect(now.saxon).toBeCloseTo(-R.max / 2);
      expect(now.italian).toBeCloseTo(6);
      expect(now.bohemian).toBe(0);
    }));
});

describe(tradedWithFactions.name, () => {
  it("raises standing with the city's home faction, at most maxPerDay a game day", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const home = homeFaction((await getCity(g, p.cityId)).tileId);
      if (!home) throw new Error('no home faction');
      const { goldPerPoint, maxPerDay } = R.trade;
      await tradedWithFactions(g, p.id, (await getCity(g, p.cityId)).tileId, goldPerPoint);
      expect((await standingsOf(g, p.id))[home.id]).toBeCloseTo(1);
      await tradedWithFactions(g, p.id, (await getCity(g, p.cityId)).tileId, goldPerPoint * 100);
      expect((await standingsOf(g, p.id))[home.id]).toBeCloseTo(maxPerDay);
    }));
});

describe(cityTerms.name, () => {
  it("gives each city its home faction, its player's standing with it and the spread that sets", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const q = await createTestPlayer(g);
      const tileId = (await getCity(g, p.cityId)).tileId;
      const home = homeFaction(tileId);
      if (!home) throw new Error('no home faction');
      await addStanding(g, p.id, home.id, R.max);
      const terms = await cityTerms(g, [p.cityId, q.cityId]);
      expect(terms.get(p.cityId)).toEqual({ playerId: p.id, tileId, faction: home.id, standing: R.max, spread: R.spread.best });
      expect(terms.get(q.cityId)).toMatchObject({ playerId: q.id, standing: 0, spread: BALANCE.npcTrade.playerSpread });
    }));

  it("has no spread for a city whose home faction is hostile: it won't trade", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const home = homeFaction((await getCity(g, p.cityId)).tileId);
      if (!home) throw new Error('no home faction');
      await addStanding(g, p.id, home.id, R.refuseBelow);
      expect((await cityTerms(g, [p.cityId])).get(p.cityId)?.spread).toBeNull();
    }));

  it('answers nothing for no cities', () =>
    game(async (g) => {
      expect((await cityTerms(g, [])).size).toBe(0);
    }));
});
