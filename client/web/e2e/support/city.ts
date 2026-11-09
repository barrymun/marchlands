// Set-up a test needs in its city, made through the API the way a player would, finished with the game's own
// speed-ups: the free speed-up finishes a building with up to 5 game minutes left (every level 1 or 2 the set-up builds
// at once, the Academy's 8 minutes after a 3-minute wait), and gold the Marketplace (40,000 of the city's 100,000) and
// the Town Hall's level 2 (85,000: a test that needs it has an account of its own).
import type { CityBean, CityHeroList, HeroBean, MapSearchResult, TavernOffers, TrainSplitResult } from '@marchlands/api-client';
import { BuildingStatus, BuildingType, SpeedupId, TileType, TOWN_HALL_POSITION, TROOP_ID_BY_KEY } from '@marchlands/core';

import type { Account } from './accounts.ts';
import { api, until } from './api.ts';

/** Slots inside the walls the set-up builds on, from the far end, so tests building in the first free slot don't meet them. */
const SETUP_SLOTS: Partial<Record<BuildingType, number>> = {
  [BuildingType.BARRACKS]: 31,
  [BuildingType.RALLY_SPOT]: 30,
  [BuildingType.MARKETPLACE]: 29,
  [BuildingType.COTTAGE]: 28,
  [BuildingType.INN]: 27,
  [BuildingType.FEASTING_HALL]: 26,
  [BuildingType.ACADEMY]: 25,
  [BuildingType.TOWN_HALL]: TOWN_HALL_POSITION,
};

/** Too long to wait for the free speed-up: bought with gold. */
const BOUGHT: readonly BuildingType[] = [BuildingType.MARKETPLACE, BuildingType.TOWN_HALL];

/** What each needs first (the game's requirements, shared/core/src/data). */
const NEEDS: Partial<Record<BuildingType, [BuildingType, number]>> = {
  [BuildingType.BARRACKS]: [BuildingType.RALLY_SPOT, 1],
  [BuildingType.INN]: [BuildingType.COTTAGE, 2],
  [BuildingType.FEASTING_HALL]: [BuildingType.INN, 1],
  [BuildingType.ACADEMY]: [BuildingType.TOWN_HALL, 2],
};

const getCity = (account: Account) => api<CityBean>('GET', `/cities/${account.city.id}`, undefined, account.token);

/** `typeId` at `level` or more in its set-up slot, built or upgraded and sped up as need be. */
export async function ensureBuilding(account: Account, typeId: BuildingType, level = 1): Promise<void> {
  const positionId = SETUP_SLOTS[typeId];
  if (positionId === undefined) throw new Error(`no set-up slot for building ${typeId}`);
  const inSlot = async () => (await getCity(account)).buildings.find((b) => b.positionId === positionId);
  const need = NEEDS[typeId];
  if (need) await ensureBuilding(account, ...need);
  const { id } = account.city;
  for (let at = await inSlot(); !at || at.level < level; at = await inSlot()) {
    // one construction at a time: wait for another test's to finish (at once at a fast GAME_SPEED)
    await until('the city to finish building', async () =>
      (await getCity(account)).buildings.every((b) => b.status === BuildingStatus.IDLE) ? true : undefined,
    );
    if (at) await api('POST', `/cities/${id}/buildings/${positionId}/upgrade`, undefined, account.token);
    else await api('POST', `/cities/${id}/buildings`, { typeId, positionId }, account.token);
    const speedup = (itemId: SpeedupId) => api('POST', `/cities/${id}/buildings/${positionId}/speedup`, { itemId }, account.token);
    if (BOUGHT.includes(typeId)) await speedup(SpeedupId.GOLD);
    else
      // the free speed-up is refused until 5 game minutes are left (at once for most, 3 minutes for the Academy)
      await until(
        `the free speed-up for building ${typeId}`,
        () =>
          speedup(SpeedupId.FREE).then(
            () => true,
            (err: unknown) => {
              if (String(err).includes('common.freeSpeedupTooEarly')) return undefined;
              throw err;
            },
          ),
        5 * 60_000,
      );
    const next = (at?.level ?? 0) + 1;
    // the worker finishes it as soon as it's due
    await until(`building ${typeId} level ${next}`, async () => {
      const b = await inSlot();
      return b && b.level >= next && b.status === BuildingStatus.IDLE ? true : undefined;
    });
  }
}

/** At least `count` militia at home: trained if need be (25 game seconds each, the one wait in the set-up). */
export async function ensureMilitia(account: Account, count: number) {
  await ensureBuilding(account, BuildingType.BARRACKS);
  const atHome = async () => (await getCity(account)).troop.militia ?? 0;
  const have = await atHome();
  if (have >= count) return;
  await api<TrainSplitResult>(
    'POST',
    `/cities/${account.city.id}/troops/train-split`,
    { troopId: TROOP_ID_BY_KEY.militia, count: count - have },
    account.token,
  );
  await until('militia trained', async () => ((await atHome()) >= count ? true : undefined), 5 * 60_000);
}

/** A hero living in the city (an army that attacks needs one): hired from the Inn if need be. */
export async function ensureHero(account: Account): Promise<HeroBean> {
  const { id } = account.city;
  const living = async () => (await api<CityHeroList>('GET', `/cities/${id}/heroes`, undefined, account.token)).heroes;
  const [hero] = await living();
  if (hero) return hero;
  await ensureBuilding(account, BuildingType.FEASTING_HALL);
  const [offer] = (await api<TavernOffers>('GET', `/cities/${id}/tavern`, undefined, account.token)).heros;
  if (!offer) throw new Error('the Inn offers no hero');
  return api<HeroBean>('POST', `/cities/${id}/tavern/${offer.id}/hire`, undefined, account.token);
}

const VALLEY_TYPES = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE];

/** An unheld valley near the city, the lowest level first, then the nearest (with PvP off it can still be attacked). */
export async function freeValleyNear(account: Account) {
  const { x, y } = account.city;
  const found = await Promise.all(
    VALLEY_TYPES.map((type) => api<MapSearchResult>('GET', `/map/search?x=${x}&y=${y}&radius=15&type=${type}`, undefined, account.token)),
  );
  const [best] = found
    .flat()
    .filter((t) => t.ownerCityId == null)
    .sort((a, b) => a.level - b.level || Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  if (!best) throw new Error(`no unheld valley within 15 tiles of (${x},${y})`);
  return best;
}
