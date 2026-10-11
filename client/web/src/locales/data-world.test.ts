// Map tile names (data-tiles), zone names (data-zones) and alliance rank names (data-ranks), and the
// position messages built from them (msg-world `position.*`): every id the game defines is named.

import { afterEach, describe, expect, it } from 'vitest';
import { AllianceRank, BALANCE, msg, ref, TileType } from '@marchlands/core';
import tilesGB from '@/locales/en-GB/data-tiles.json';
import zonesGB from '@/locales/en-GB/data-zones.json';
import ranksGB from '@/locales/en-GB/data-ranks.json';
import { rankName, tileName, zoneName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';
import { translateMessage } from '@/lib/messages';

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
