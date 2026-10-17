// Item ids, named after the item. The values are the original game's ids: they are stored in players'
// inventories and sent to the client, so never change one without a data migration.

export const ItemId = {
  // ---- construction and research speed-ups ----
  BEGINNER_GUIDELINES: 'consume.2.a',
  PRIMARY_GUIDELINES: 'consume.2.b',
  INTERMEDIATE_GUIDELINES: 'consume.2.b.1',
  SENIOR_GUIDELINES: 'consume.2.c',
  MASTER_GUIDELINES: 'consume.2.c.1',
  ULTIMATE_GUIDELINES: 'consume.2.d',
  // ---- training speed-ups ----
  NAPOLEONS_DIARY: 'player.troop.1.b',
  ARCHIMEDES_NOTE: 'player.fort.1.c',
  // ---- production and gold boosts ----
  PLOWSHARES: 'player.resinc.1',
  IRON_RAKE: 'player.resinc.1.b',
  ARCH_SAW: 'player.resinc.2',
  DOUBLE_SAW: 'player.resinc.2.b',
  QUARRYING_TOOLS: 'player.resinc.3',
  ADV_QUARRYING_TOOLS: 'player.resinc.3.b',
  BLOWER: 'player.resinc.4',
  BLAST_FURNACE: 'player.resinc.4.b',
  TAX_POLICY: 'player.gold.1.a',
  ADV_TAX_POLICY: 'player.gold.1.b',
  // ---- military boosts ----
  WAR_HORN: 'player.attackinc.1',
  IVORY_HORN: 'player.attackinc.1.b',
  CORSELET: 'player.defendinc.1',
  ULTRA_CORSELET: 'player.defendinc.1.b',
  WAR_ENSIGN: 'player.troop.1.a',
  BERNINIS_HAMMER: 'player.queue.building',
  VESTAS_BLESSING: 'player.reduce.troops.upkeep.1',
  VESTAS_GRAND_BLESSING: 'player.reduce.troops.upkeep.7',
  QUARTERMASTERS_SEAL: 'player.reduce.troops.cost.1',
  QUARTERMASTERS_CHARTER: 'player.reduce.troops.cost.7',
  // ---- city ----
  TRUCE_AGREEMENT: 'player.peace.1',
  CITY_TELEPORTER: 'consume.move.1',
  CIVIL_CODE: 'player.pop.1.a',
  PENICILLIN: 'player.relive.1',
  // ---- boxes ----
  JUNIOR_MEDAL_BOX: 'player.box.special.1',
  MEDIUM_MEDAL_BOX: 'player.box.special.2',
  SENIOR_MEDAL_BOX: 'player.box.special.3',
  HERO_PACKAGE: 'player.box.currently.1',
  WELCOME_PACKAGE: 'player.box.present.2',
  // ---- heroes ----
  HOLY_WATER: 'hero.reset.1',
  EXCALIBUR: 'hero.power.1',
  WEALTH_OF_NATIONS: 'hero.management.1',
  ART_OF_WAR: 'hero.intelligence.1',
  ANABASIS: 'player.experience.1.a',
  EPITOME_OF_MILITARY_SCIENCE: 'player.experience.1.b',
  ON_WAR: 'player.experience.1.c',
  // ---- medals (hero loyalty), level 1 … 9: medalId(level) ----
  CROSS_MEDAL: 'hero.loyalty.1',
  ROSE_MEDAL: 'hero.loyalty.2',
  LION_MEDAL: 'hero.loyalty.3',
  HONOUR_MEDAL: 'hero.loyalty.4',
  COURAGE_MEDAL: 'hero.loyalty.5',
  WISDOM_MEDAL: 'hero.loyalty.6',
  FREEDOM_MEDAL: 'hero.loyalty.7',
  JUSTICE_MEDAL: 'hero.loyalty.8',
  NATION_MEDAL: 'hero.loyalty.9',
} as const;
export type ItemId = (typeof ItemId)[keyof typeof ItemId];
export const ITEM_IDS = Object.values(ItemId) as [ItemId, ...ItemId[]];

/**
 * Speed-ups that are not items (castle.speedUpBuildCommand / tech.speedUpResearch): the free one for the
 * last minutes, finishing at once for gold, and the original's half-time speed-up (orig: paid in cents;
 * here in gold, BALANCE.items.speedups).
 */
export const SpeedupId = { FREE: 'free.speed', GOLD: 'gold.speed', HALF_TIME: 'player.speedup.1' } as const;
export type SpeedupId = (typeof SpeedupId)[keyof typeof SpeedupId];
