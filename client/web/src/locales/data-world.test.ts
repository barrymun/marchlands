// Map tile names (data-tiles), zone names (data-zones), NPC faction names (data-factions) and alliance rank names (data-ranks), and the
// position messages built from them (msg-world `position.*`): every id the game defines is named.

import { afterEach, describe, expect, it } from 'vitest';

import { AllianceRank, BALANCE, FACTION_IDS, FactionId, HISTORIC_NAMES, historicCities, msg, ref, TileType } from '@marchlands/core';

import { factionName, historicName, rankName, seatTitleName, stateName, tileName, zoneName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';
import factionsGB from '@/locales/en-GB/data-factions.json';
import historicGB from '@/locales/en-GB/data-historic.json';
import ranksGB from '@/locales/en-GB/data-ranks.json';
import tilesGB from '@/locales/en-GB/data-tiles.json';
import zonesGB from '@/locales/en-GB/data-zones.json';

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);
const keys = (o: object) => sorted(Object.keys(o).map(Number));

afterEach(async () => {
  await i18n.changeLanguage('en-GB');
});

describe('data-tiles', () => {
  it('names every tile type in en-GB, and nothing else', () => {
    expect(keys(tilesGB)).toEqual(sorted(Object.values(TileType)));
  });

  it('is looked up by tile type', async () => {
    expect(tileName(TileType.NPC)).toBe('Barbarian city');
    await i18n.changeLanguage('ja-JP');
    expect(tileName(TileType.LAKE)).toBe('湖');
  });
});

describe('data-zones', () => {
  it('names every zone in en-GB, and nothing else', () => {
    expect(keys(zonesGB)).toEqual(Array.from({ length: BALANCE.stateGrid ** 2 }, (_, i) => i));
  });

  it('is looked up by zone id', async () => {
    expect(zoneName(1)).toBe('SAXONY');
    await i18n.changeLanguage('ja-JP');
    expect(zoneName(1)).toBe('ザクセン');
  });
});

describe('data-factions', () => {
  it('names every faction in en-GB, and nothing else', () => {
    expect(Object.keys(factionsGB).sort()).toEqual([...FACTION_IDS].sort());
  });

  it('is looked up by faction id', async () => {
    expect(factionName(FactionId.SAXON_LEAGUE)).toBe('Saxon League');
    await i18n.changeLanguage('ja-JP');
    expect(factionName(FactionId.BOHEMIAN_CROWN)).toBe('ボヘミア王冠領');
  });
});

describe('data-ranks', () => {
  it('names every alliance rank in en-GB, and nothing else', () => {
    expect(keys(ranksGB)).toEqual(sorted(Object.values(AllianceRank)));
  });

  it('is looked up by rank', async () => {
    expect(rankName(AllianceRank.VICE_HOST)).toBe('Vice Host');
    await i18n.changeLanguage('ja-JP');
    expect(rankName(AllianceRank.HOST)).toBe('盟主');
  });
});

describe('positions', () => {
  it('words a city, a tile with a level and one without', async () => {
    expect(translateMessage(msg('world.position.city', { name: 'Aachen', x: 12, y: 340 }))).toBe('Aachen (12,340)');
    expect(translateMessage(msg('world.position.tile', { tile: ref.tile(TileType.HILL), level: 3, x: 1, y: 2 }))).toBe('Hill Lv.3 (1,2)');
    expect(translateMessage(msg('world.position.place', { tile: ref.tile(TileType.FLAT), x: 1, y: 2 }))).toBe('Flat (1,2)');
    await i18n.changeLanguage('ja-JP');
    expect(translateMessage(msg('world.position.tile', { tile: ref.tile(TileType.NPC), level: 5, x: 1, y: 2 }))).toBe('蛮族の都市 Lv.5 (1,2)');
  });
});

describe('data-historic', () => {
  it('names every historic city of level 14 and up but Romagna’s last two, which the source’s map shows as Atlantis, and no level 12', () => {
    const named = historicCities()
      .filter((c) => c.level > 12 && !(c.y === 759 && (c.x === 693 || c.x === 759)))
      .map((c) => `${c.x},${c.y}`);
    expect(Object.keys(historicGB).sort()).toEqual(named.sort());
  });

  it('says in English what core names a held one (HISTORIC_NAMES)', () => {
    expect(historicGB).toEqual(HISTORIC_NAMES);
  });

  it('is looked up by place, and a level 12 has no name', async () => {
    expect(historicName(0, 0)).toBe('Atlantis');
    expect(historicName(300, 100)).toBe('Beijing');
    expect(historicName(9, 9)).toBeNull();
    await i18n.changeLanguage('ja-JP');
    expect(historicName(300, 100)).toBe('北京');
  });
});

describe(stateName.name, () => {
  it('writes a state’s name in title case', () => {
    expect(stateName(2)).toBe('North March');
  });
});

describe('seat titles', () => {
  it('names a state’s ruler with the state in title case, and Atlantis’s sovereign', async () => {
    expect(seatTitleName({ level: 16, zoneId: 2 })).toBe('Ruler of North March');
    expect(seatTitleName({ level: 18, zoneId: 0 })).toBe('Sovereign of Atlantis');
    await i18n.changeLanguage('ja-JP');
    expect(seatTitleName({ level: 16, zoneId: 1 })).toBe('ザクセンの統治者');
  });
});
