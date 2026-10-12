// shop.* — buying items with a city's gold (there are no cents: itemGoldPrice) and using items
// (shop.useGoods / shop.useCastleGoods). Item effects are declared in @marchlands/core items.ts.

import {
  GameError,
  itemConfig,
  itemEffect,
  itemGoldPrice,
  ITEMS,
  addTroops,
  BuildingType,
  msg,
  ref,
  type GrantContents,
  type Message,
  civilCodePopulation,
  createBoxHero,
} from '@marchlands/core';
import { heroes } from '@marchlands/db';
import { cityStats, openOwnCity, type CityBundle } from '#/city.ts';
import type { Ctx } from '#/context.ts';
import { heroBean, troopBean } from '#/dto.ts';
import { addItem, consumeItem, gainResources, itemCount, pushCity, pushResources, setBuff } from '#/helpers.ts';
import { getPlayer, saveCity, savePlayer, type PlayerRow } from '#/repo.ts';
import { heroSlots, heroValues, pushHero } from '#/engine/heroes.ts';
import { settleAllCities } from '#/engine/research.ts';
import { PushCmd } from '@marchlands/contracts';

/** Shop catalogue (orig saleTypeBeans): items for sale grouped by type (item category id), priced in city gold; the client names both by id. */
export function catalogue() {
  const groups = new Map<number, { typeId: number; items: { id: string; price: number; dayLimit: number }[] }>();
  for (const i of ITEMS) {
    const price = itemGoldPrice(i.id);
    if (price == null) continue;
    const g = groups.get(i.type) ?? { typeId: i.type, items: [] };
    g.items.push({ id: i.id, price, dayLimit: i.dayLimit });
    groups.set(i.type, g);
  }
  return [...groups.values()].sort((a, b) => a.typeId - b.typeId);
}

/** Where an item used through another action is used, for a player (by the action's command). */
function useFromMessage(command: string): Message {
  if (command === 'speedup' || command.endsWith('.speedup')) return msg('item.useFrom.speedup');
  if (command.startsWith('heroes.')) return msg('item.useFrom.hero');
  return msg('item.useFrom.elsewhere');
}

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

/** shop.buy: buy items with a city's gold (itemGoldPrice); they go to the lord's inventory. */
export async function buyItemWithGold(ctx: Ctx, playerId: number, cityId: number, itemId: string, amount: number) {
  const price = itemGoldPrice(itemId);
  if (price == null) throw new GameError(msg('item.notForSale'), -99);
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) throw new GameError(msg('common.invalidAmount'), -28);
  const b = await openOwnCity(ctx, playerId, cityId);
  // dayLimit on items with a short validity is a per-day purchase cap (orig: unenforced)
  const cfg = itemConfig(itemId)!;
  if (cfg.dayLimit > 0 && cfg.dayLimit <= 1) {
    const day = today(ctx.now);
    const rec = b.player.misc.dailyLimits?.[itemId];
    const used = rec?.day === day ? rec.count : 0;
    if (used + amount > cfg.dayLimit) throw new GameError(msg('item.dailyLimit'), -99);
    b.player.misc = { ...b.player.misc, dailyLimits: { ...(b.player.misc.dailyLimits ?? {}), [itemId]: { day, count: used + amount } } };
  }
  const gold = price * amount;
  if (b.city.gold < gold) throw new GameError(msg('common.notEnoughGoldFor', { amount: gold }), -99);
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
    ctx.push(p.id, PushCmd.TROOP_UPDATE, { castleId: b.city.id, troop: troopBean(b.city.troops) });
  }
}

export interface UseItemResult {
  itemId: string;
  granted?: GrantContents;
  hero?: ReturnType<typeof heroBean>;
}

/**
 * shop.useGoods / shop.useCastleGoods. `cityId` is required for items acting on a city
 * (resources, troops, population, loyalty, heroes).
 */
export async function useItem(ctx: Ctx, playerId: number, itemId: string, cityId: number | null): Promise<UseItemResult> {
  const effect = itemEffect(itemId);
  if (!effect) throw new GameError(msg('item.cannotUse'), -99);
  if (effect.kind === 'command') throw new GameError(useFromMessage(effect.command), -99);
  const b = cityId != null ? await openOwnCity(ctx, playerId, cityId) : null;
  const p = b ? b.player : await getPlayer(ctx, playerId, { lock: true });
  if (itemCount(p, itemId) < 1) throw new GameError(msg('common.insufficientItems'), -24);
  const needCity = () => {
    if (!b) throw new GameError(msg('item.chooseCity'), -99);
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
      if (itemCount(p, effect.key) < 1) throw new GameError(msg('item.needKey', { key: ref.item(effect.key) }), -99);
      const contents = effect.contents();
      consumeItem(ctx, p, itemId);
      consumeItem(ctx, p, effect.key);
      await grant(ctx, p, b, contents);
      result.granted = contents;
      break;
    }
    case 'special': {
      switch (effect.handler) {
        case 'civilCode': {
          const city = needCity();
          consumeItem(ctx, p, itemId);
          const max = cityStats(city, ctx.now).maxPopulation;
          city.city.population = civilCodePopulation(city.city.population, max);
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
          if (city.heroes.length >= heroSlots(city)) throw new GameError(msg('hero.noVacancy', { building: ref.building(BuildingType.FEASTING_HALL) }), -99);
          consumeItem(ctx, p, itemId);
          const [row] = await ctx.tx
            .insert(heroes)
            .values({
              ...heroValues(createBoxHero(itemId, ctx.rng)),
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
      }
      break;
    }
  }
  if (b) await saveCity(ctx, b.city);
  await savePlayer(ctx, p);
  return result;
}
