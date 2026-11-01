import { describe, expect, it } from 'vitest';
import { BALANCE, BASIC_RESOURCES, faction, FACTION_IDS, FactionId, factionOfZone, factionRivals, FACTIONS, isFactionLevel, npcFaction } from '#/index.ts';

const ZONES = BALANCE.stateGrid ** 2;
/** The tile at (x, y). */
const tile = (x: number, y: number) => y * BALANCE.mapSize + x;

describe('FACTIONS', () => {
  it('lists every FactionId once', () => {
    expect(FACTIONS.map((f) => f.id).sort()).toEqual([...FACTION_IDS].sort());
  });

  it('holds every zone, each by one faction', () => {
    expect(FACTIONS.flatMap((f) => f.zones).sort((a, b) => a - b)).toEqual(Array.from({ length: ZONES }, (_, i) => i));
  });

  it("gives each faction neighbouring zones (a zone's neighbours share a side on the zone grid)", () => {
    const g = BALANCE.stateGrid;
    const touch = (a: number, b: number) => Math.abs((a % g) - (b % g)) + Math.abs(Math.floor(a / g) - Math.floor(b / g)) === 1;
    for (const f of FACTIONS) {
      // spread from the first zone to every zone touching one already reached
      const reached = new Set(f.zones.slice(0, 1));
      let added = true;
      while (added) {
        added = false;
        for (const z of f.zones) {
          if (reached.has(z) || ![...reached].some((r) => touch(r, z))) continue;
          reached.add(z);
          added = true;
        }
      }
      expect(reached.size, f.id).toBe(f.zones.length);
    }
  });

  it('makes every basic resource some faction strength and another faction shortage, never both for one faction', () => {
    const strongIn = new Set(FACTIONS.flatMap((f) => f.strong));
    const shortOf = new Set(FACTIONS.flatMap((f) => f.short));
    expect(BASIC_RESOURCES.filter((r) => !strongIn.has(r) || !shortOf.has(r))).toEqual([]);
    expect(FACTIONS.filter((f) => f.strong.some((r) => f.short.includes(r))).map((f) => f.id)).toEqual([]);
  });
});

describe(factionOfZone.name, () => {
  it('finds the faction holding a zone', () => {
    expect(factionOfZone(1)?.id).toBe(FactionId.SAXON_LEAGUE);
    expect(factionOfZone(6)?.id).toBe(FactionId.FRANCONIAN_HEARTLAND);
    expect(factionOfZone(15)?.id).toBe(FactionId.ITALIAN_LEAGUE);
  });

  it('is null for a number that is no zone', () => {
    expect(factionOfZone(ZONES)).toBeNull();
    expect(factionOfZone(-1)).toBeNull();
  });
});

describe(faction.name, () => {
  it('finds a faction by id', () => {
    expect(faction(FactionId.BOHEMIAN_CROWN).zones).toEqual([3, 7, 11]);
  });
});

describe(isFactionLevel.name, () => {
  it('starts at BALANCE.factions.minLevel', () => {
    expect(isFactionLevel(BALANCE.factions.minLevel - 1)).toBe(false);
    expect(isFactionLevel(BALANCE.factions.minLevel)).toBe(true);
    expect(isFactionLevel(10)).toBe(true);
  });
});

describe(npcFaction.name, () => {
  it("is the faction holding the city's zone, from the minimum level up", () => {
    // Friesland is the north-west corner, Romagna the south-east
    expect(npcFaction(tile(10, 10), 5)?.id).toBe(FactionId.SAXON_LEAGUE);
    expect(npcFaction(tile(BALANCE.mapSize - 1, BALANCE.mapSize - 1), 10)?.id).toBe(FactionId.ITALIAN_LEAGUE);
  });

  it('is null for a bandit below the minimum level', () => {
    expect(npcFaction(tile(10, 10), BALANCE.factions.minLevel - 1)).toBeNull();
  });
});

describe(factionRivals.name, () => {
  const rivals = (id: FactionId) =>
    factionRivals(id)
      .map((f) => f.id)
      .sort();

  it('lists the factions holding a zone that borders one of its own', () => {
    expect(rivals(FactionId.SAXON_LEAGUE)).toEqual([FactionId.BOHEMIAN_CROWN, FactionId.FRANCONIAN_HEARTLAND, FactionId.LOTHARINGIAN_CROWN].sort());
    expect(rivals(FactionId.ITALIAN_LEAGUE)).toEqual([FactionId.BOHEMIAN_CROWN, FactionId.FRANCONIAN_HEARTLAND, FactionId.LOTHARINGIAN_CROWN].sort());
  });

  it('gives the Franconian Heartland, the crossroads, every other faction', () => {
    expect(rivals(FactionId.FRANCONIAN_HEARTLAND)).toEqual(FACTION_IDS.filter((id) => id !== FactionId.FRANCONIAN_HEARTLAND).sort());
  });

  it('never lists the faction itself, and is symmetric', () => {
    for (const f of FACTIONS) {
      expect(rivals(f.id)).not.toContain(f.id);
      for (const r of factionRivals(f.id)) expect(rivals(r.id)).toContain(f.id);
    }
  });
});
