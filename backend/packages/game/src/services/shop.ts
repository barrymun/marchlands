// shop.* — buying items with a city's gold (there are no cents: itemGoldPrice) and using items
// (shop.useGoods / shop.useCastleGoods). Item effects are declared in @marchlands/core items.ts.

import {
  amuletDirectPayout,
  CHAT_ICONS,
  createRandomHero,
  GameError,
  HERO_BOX_QUALITY,
  itemConfig,
  itemEffect,
  itemGoldPrice,
  ITEMS,
  randInt,
  rollAmulet,
  upgradeExpFor,
  addTroops,
  type GrantContents,
} from '@marchlands/core';
import { heroes } from '@marchlands/db';
import { cityStats, openOwnCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { heroBean, troopBean } from '../dto.ts';
import { addItem, consumeItem, gainResources, itemCount, pushCity, pushResources, setBuff } from '../helpers.ts';
import { getPlayer, saveCity, savePlayer, type PlayerRow } from '../repo.ts';
import { heroSlots, heroValues, pushHero } from './heroes.ts';
import { settleAllCities } from './research.ts';

const ITEM_TYPE_NAMES: Record<number, string> = { 1: 'Speed up', 2: 'Chest', 3: 'Produce', 4: 'Treasure' };

/** Shop catalogue (orig saleTypeBeans): items for sale grouped by type, priced in city gold. */
export function catalogue() {
  const groups = new Map<number, { typeId: number; typeName: string; items: { id: string; name: string; price: number; dayLimit: number }[] }>();
  for (const i of ITEMS) {
    const price = itemGoldPrice(i.id);
    if (price == null) continue;
    const g = groups.get(i.type) ?? { typeId: i.type, typeName: ITEM_TYPE_NAMES[i.type] ?? 'Other', items: [] };
    g.items.push({ id: i.id, name: i.name, price, dayLimit: i.dayLimit });
    groups.set(i.type, g);
  }
  return [...groups.values()].sort((a, b) => a.typeId - b.typeId);
}

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

/** shop.buy: buy items with a city's gold (itemGoldPrice); they go to the lord's inventory. */
export async function buyItemWithGold(ctx: Ctx, playerId: number, cityId: number, itemId: string, amount: number) {
  const price = itemGoldPrice(itemId);
  if (price == null) throw new GameError('This item is not for sale.', -99);
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) throw new GameError('Not going to happen.', -28);
  const b = await openOwnCity(ctx, playerId, cityId);
  // dayLimit on items with a short validity is a per-day purchase cap (orig: unenforced)
  const cfg = itemConfig(itemId)!;
  if (cfg.dayLimit > 0 && cfg.dayLimit <= 1) {
    const day = today(ctx.now);
    const rec = b.player.misc.dailyLimits?.[itemId];
    const used = rec?.day === day ? rec.count : 0;
    if (used + amount > cfg.dayLimit) throw new GameError('Daily purchase limit reached.', -99);
    b.player.misc = { ...b.player.misc, dailyLimits: { ...(b.player.misc.dailyLimits ?? {}), [itemId]: { day, count: used + amount } } };
  }
  const gold = price * amount;
  if (b.city.gold < gold) throw new GameError(`Not enough gold: ${gold.toLocaleString('en')} needed.`, -99);
  b.city.gold -= gold;
  ctx.stat(b.player.id, b.city.id, { 'spent.items.gold': gold });
  addItem(ctx, b.player, itemId, amount);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
  return { itemId, count: itemCount(b.player, itemId), gold };
}

// ---------------------------------------------------------------------------------------------
// Using items
// ---------------------------------------------------------------------------------------------

async function grant(ctx: Ctx, p: PlayerRow, b: CityBundle | null, g: GrantContents) {
  for (const [id, n] of Object.entries(g.items ?? {})) addItem(ctx, p, id, n);
  if (b && g.resources) {
    gainResources(b.city, g.resources);
    pushResources(ctx, b);
  }
  if (b && g.troops) {
    b.city.troops = addTroops(b.city.troops, g.troops);
    ctx.push(p.id, 'server.TroopUpdate', { castleId: b.city.id, troop: troopBean(b.city.troops) });
  }
}

export interface UseItemResult {
  itemId: string;
  granted?: GrantContents;
  amulet?: { slots: { id: string; count: number; kind: number }[]; winner: number; prize: { id: string; count: number } };
  hero?: ReturnType<typeof heroBean>;
}

/**
 * shop.useGoods / shop.useCastleGoods. `cityId` is required for items acting on a city
 * (resources, troops, population, loyalty, heroes).
 */
export async function useItem(ctx: Ctx, playerId: number, itemId: string, cityId: number | null): Promise<UseItemResult> {
  const effect = itemEffect(itemId);
  if (!effect) throw new GameError('This item cannot be used here.', -99);
  if (effect.kind === 'command') throw new GameError(`Use this item through ${effect.command}.`, -99);
  const b = cityId != null ? await openOwnCity(ctx, playerId, cityId) : null;
  const p = b ? b.player : await getPlayer(ctx, playerId, { lock: true });
  if (itemCount(p, itemId) < 1) throw new GameError('Insufficient items.', -24);
  const needCity = () => {
    if (!b) throw new GameError('Choose a city to use this item in.', -99);
    return b;
  };
  const result: UseItemResult = { itemId };

  switch (effect.kind) {
    case 'buff': {
      // production buffs change every city's rates: settle them first
      await settleAllCities(ctx, p);
      consumeItem(ctx, p, itemId);
      setBuff(ctx, p, effect.buff, effect.desc, ctx.now + effect.durationMs, { extend: true, itemId });
      break;
    }
    case 'grant': {
      const city = effect.resources || effect.troops ? needCity() : b;
      consumeItem(ctx, p, itemId);
      await grant(ctx, p, city, effect);
      result.granted = effect;
      break;
    }
    case 'box': {
      const contents = effect.contents(ctx.rng);
      const city = contents.resources || contents.troops ? needCity() : b;
      consumeItem(ctx, p, itemId);
      await grant(ctx, p, city, contents);
      result.granted = contents;
      break;
    }
    case 'chest': {
      if (itemCount(p, effect.key) < 1) throw new GameError(`You need a ${itemConfig(effect.key)?.name ?? 'key'} to open this.`, -99);
      const contents = effect.contents();
      consumeItem(ctx, p, itemId);
      consumeItem(ctx, p, effect.key);
      await grant(ctx, p, b, contents);
      result.granted = contents;
      break;
    }
    case 'amulet': {
      const city = needCity();
      consumeItem(ctx, p, itemId);
      const { slots, winner } = rollAmulet(ctx.rng);
      const prize = slots[winner];
      const direct = amuletDirectPayout(prize.id);
      if (direct?.resource) {
        gainResources(city.city, { [direct.resource]: prize.count });
        pushResources(ctx, city);
      } else addItem(ctx, p, prize.id, prize.count);
      result.amulet = { slots, winner, prize: { id: prize.id, count: prize.count } };
      const cfg = itemConfig(prize.id);
      const price = itemGoldPrice(prize.id);
      const worth = price ? ` (worth ${(price * prize.count).toLocaleString('en')} gold)` : '';
      if (prize.kind <= 2) {
        ctx.broadcast('server.SystemInfoMsg', {
          alliance: false,
          tV: true,
          noSenderSystemInfo: true,
          msg: `${p.sex === 1 ? 'Lady' : 'Lord'} <b>${p.name}</b> gained <b>${prize.count} ${cfg?.name ?? prize.id}</b>${worth} from the Amulet!`,
        });
      }
      break;
    }
    case 'special': {
      switch (effect.handler) {
        case 'speechText': {
          const city = needCity();
          consumeItem(ctx, p, itemId);
          city.city.loyalty = 100;
          city.city.grievance = 0;
          pushCity(ctx, city);
          break;
        }
        case 'civilCode': {
          const city = needCity();
          consumeItem(ctx, p, itemId);
          const max = cityStats(city, ctx.now).maxPopulation;
          city.city.population = Math.min(max, city.city.population + Math.max(100, Math.floor(max * 0.2)));
          pushCity(ctx, city);
          break;
        }
        case 'cureInjured': {
          const city = needCity();
          consumeItem(ctx, p, itemId);
          city.city.troops = addTroops(city.city.troops, city.city.injuredTroops);
          city.city.injuredTroops = {};
          pushCity(ctx, city);
          break;
        }
        case 'heroBox': {
          const city = needCity();
          if (city.heroes.length >= heroSlots(city)) throw new GameError('Insufficient vacancies in Feasting Hall.', -99);
          consumeItem(ctx, p, itemId);
          const q = HERO_BOX_QUALITY[itemId] ?? { level: 10, minStat: 40 };
          const g = createRandomHero(1, ctx.rng);
          const bump = (v: number) => Math.max(v, q.minStat + randInt(ctx.rng, 0, 10));
          const basePower = bump(g.basePower);
          const baseManagement = bump(g.baseManagement);
          const baseStratagem = bump(g.baseStratagem);
          const [row] = await ctx.tx
            .insert(heroes)
            .values({
              ...heroValues(g),
              level: q.level,
              upgradeExp: upgradeExpFor(q.level),
              basePower,
              baseManagement,
              baseStratagem,
              power: basePower,
              management: baseManagement,
              stratagem: baseStratagem,
              remainPoint: q.level,
              loyalty: 100,
              playerId: p.id,
              cityId: city.city.id,
              inTavern: false,
              createdAt: ctx.now,
            })
            .returning();
          pushHero(ctx, p.id, row, 0);
          result.hero = heroBean(row);
          break;
        }
        case 'chatIcon': {
          consumeItem(ctx, p, itemId);
          const icon = CHAT_ICONS[itemId];
          setBuff(ctx, p, 'ChatIconBuff', 'Publicity Ambassador', ctx.now + icon.durationMs, { param: icon.icon });
          p.misc = { ...p.misc, icon: icon.icon };
          break;
        }
      }
      break;
    }
  }
  if (b) await saveCity(ctx, b.city);
  await savePlayer(ctx, p);
  return result;
}
