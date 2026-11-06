// The values of these constants are stored in the database and sent to clients, so changing one needs a data migration
// (AGENTS.md). Code and other tests use the names, so they wouldn't notice: this test is the one place that writes them out.

import { describe, expect, it } from 'vitest';
import { ClientCmd } from '@marchlands/contracts';
import {
  ALL_REPORTS,
  BASIC_RESOURCES,
  BattleResult,
  BattleTarget,
  BuildingArea,
  ChatChannel,
  FLOW_TRAIN_MAX,
  FlowActionType,
  FlowCities,
  FlowHealWhen,
  FlowStatus,
  FlowWaitUntil,
  GameRefKind,
  HealPayment,
  HeroItemPayment,
  ItemUse,
  MarketOrderType,
  PlayerRelationKind,
  ReportBodyKind,
  RequirementKind,
  RESOURCE_KEYS,
  ResourceKey,
  SpotKind,
  TimedEventType,
  TradeCounterparty,
  TradeSide,
  UnlockKind,
  WorldMapSource,
} from '@marchlands/core';

describe('stored values', () => {
  it('flows', () => {
    expect(FlowActionType).toEqual({
      SET_MAYOR: 'setMayor',
      TRAIN_TROOPS: 'trainTroops',
      HEAL_TROOPS: 'healTroops',
      ATTACK_TARGETS: 'attackTargets',
      HIRE_HEROES: 'hireHeroes',
      WAIT: 'wait',
    });
    expect(FlowStatus).toEqual({ IDLE: 'idle', QUEUED: 'queued', RUNNING: 'running', WAITING: 'waiting' });
    expect(FlowCities).toEqual({ ALL: 'all' });
    expect(FlowWaitUntil).toEqual({ TIME: 'time', ARMIES_HOME: 'armiesHome' });
    expect(FlowHealWhen).toEqual({ NOW: 'now', ARMIES_HOME: 'armiesHome' });
    expect(FLOW_TRAIN_MAX).toBe('max');
  });

  it('battle results', () => {
    expect(BattleResult).toEqual({ ATTACKER_WON: 'attackerWon', DEFENDER_WON: 'defenderWon', DRAW: 'draw' });
  });

  it('item uses and unlocks', () => {
    expect(ItemUse).toEqual({ DIRECT: 'direct', ELSEWHERE: 'elsewhere', NONE: 'none' });
    expect(UnlockKind).toEqual({ BUILDING: 'building', TROOP: 'troop', TECH: 'tech' });
  });

  it('references in messages', () => {
    expect(GameRefKind).toEqual({
      TROOP: 'troop',
      BUILDING: 'building',
      TECH: 'tech',
      ITEM: 'item',
      TITLE: 'title',
      TILE: 'tile',
      RESOURCE: 'resource',
      STAT: 'stat',
      ZONE: 'zone',
      RANK: 'rank',
      GEAR: 'gear',
      ITEM_CATEGORY: 'itemCategory',
    });
  });

  it('spots on sprites (assets/spots.json)', () => {
    expect(SpotKind).toEqual({
      ANVIL: 'anvil',
      BANNER: 'banner',
      BLADE: 'blade',
      CATAPULT: 'catapult',
      CROPS: 'crops',
      DOME: 'dome',
      DUMMY: 'dummy',
      FIRE: 'fire',
      FLAP: 'flap',
      GEM: 'gem',
      GLOW: 'glow',
      HORSE: 'horse',
      LOGS: 'logs',
      MINE: 'mine',
      NOD: 'nod',
      ROCK: 'rock',
      SAILS: 'sails',
      SHEEP: 'sheep',
      SHINE: 'shine',
      SMOKE: 'smoke',
      STALL: 'stall',
      STAR: 'star',
      STIR: 'stir',
      STONE: 'stone',
      SWAY: 'sway',
      SWING: 'swing',
      TENT: 'tent',
      WATER: 'water',
      WELL: 'well',
      WHEEL: 'wheel',
      WINDOW: 'window',
    });
  });

  it('healing', () => {
    expect(HealPayment).toEqual({ RESOURCES: 'resources', HONOR: 'honor' });
  });

  it('timed events', () => {
    expect(TimedEventType).toEqual({
      BUILDING: 'building',
      RESEARCH: 'research',
      TRAIN: 'train',
      ARMY: 'army',
      ARMY_DEPART: 'army.depart',
      BUFF_EXPIRE: 'buff.expire',
      HERO_BUFF: 'hero.buff',
      SHIPMENT: 'shipment',
      CITY_ABANDON: 'city.abandon',
      FLOW_HEAL: 'flow.heal',
      FLOW_RESUME: 'flow.resume',
      FLOW_QUEUE: 'flow.queue',
    });
  });

  it('resources', () => {
    expect(ResourceKey).toEqual({ GOLD: 'gold', FOOD: 'food', WOOD: 'wood', STONE: 'stone', IRON: 'iron' });
    // the market numbers the basic resources by their position here (resType 0 food, 1 lumber, 2 stone, 3 iron)
    expect(BASIC_RESOURCES).toEqual(['food', 'wood', 'stone', 'iron']);
    expect(RESOURCE_KEYS).toEqual(['gold', 'food', 'wood', 'stone', 'iron']);
  });

  it('reports', () => {
    expect(ReportBodyKind).toEqual({
      BATTLE: 'battle',
      SCOUT: 'scout',
      MOVEMENT: 'movement',
      TRADE: 'trade',
      TEXT: 'text',
      DESERTION: 'desertion',
      DRAFT: 'draft',
    });
    expect(BattleTarget).toEqual({ CITY: 'city', NPC: 'npc', VALLEY: 'valley' });
    expect(TradeSide).toEqual({ BUY: 'buy', SELL: 'sell' });
    expect(ALL_REPORTS).toBe('all');
  });

  it('the market', () => {
    expect(MarketOrderType).toEqual({ LIMIT: 'limit', MARKET: 'market' });
    expect(TradeCounterparty).toEqual({ PLAYER: 'player', FACTIONS: 'factions', MERCHANT: 'merchant' });
  });

  it('heroes', () => {
    expect(HeroItemPayment).toEqual({ GOLD: 'gold' });
  });

  it('cities', () => {
    expect(BuildingArea).toEqual({ INSIDE: 'inside', OUTSIDE: 'outside', WALLS: 'walls' });
    expect(RequirementKind).toEqual({ BUILDING: 'building', TECH: 'tech', ITEM: 'item' });
  });

  it('chat and relations', () => {
    expect(ChatChannel).toEqual({ WORLD: 'world', BEGINNER: 'beginner', ALLIANCE: 'alliance', PRIVATE: 'private' });
    expect(PlayerRelationKind).toEqual({ FRIEND: 'friend', BLOCK: 'block' });
    expect(ClientCmd).toEqual({ PING: 'ping' });
  });

  it('the world', () => {
    expect(WorldMapSource).toEqual({ GENERATED: 'generated', LEGACY: 'legacy' });
  });
});
