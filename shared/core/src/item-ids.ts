// Item ids, named after the item. The values are the original game's ids: they are stored in players'
// inventories and sent to the client, so never change one without a data migration.

export const ItemId = {
  // ---- construction and research speed-ups ----
  NOVICES_NOTES: 'consume.2.a',
  APPRENTICES_NOTES: 'consume.2.b',
  JOURNEYMANS_NOTES: 'consume.2.b.1',
  MASTERS_NOTES: 'consume.2.c',
  GRANDMASTERS_NOTES: 'consume.2.c.1',
  VILLARDS_SKETCHBOOK: 'consume.2.d',
  // ---- training speed-ups ----
  OTTOS_MUSTER_ROLL: 'player.troop.1.b',
  HENRYS_CASTLE_LAW: 'player.fort.1.c',
  // ---- production and gold boosts ----
  PLOUGHSHARE: 'player.resinc.1',
  HEAVY_PLOUGH: 'player.resinc.1.b',
  BOW_SAW: 'player.resinc.2',
  WATER_SAW: 'player.resinc.2.b',
  MASONS_PICK: 'player.resinc.3',
  TREADWHEEL_CRANE: 'player.resinc.3.b',
  HAND_BELLOWS: 'player.resinc.4',
  WATER_BELLOWS: 'player.resinc.4.b',
  TOLL_RIGHT: 'player.gold.1.a',
  MINT_RIGHT: 'player.gold.1.b',
  // ---- military boosts ----
  WAR_HORN: 'player.attackinc.1',
  OLIFANT: 'player.attackinc.1.b',
  GAMBESON: 'player.defendinc.1',
  HAUBERK: 'player.defendinc.1.b',
  IMPERIAL_BANNER: 'player.troop.1.a',
  BERNWARDS_HAMMER: 'player.queue.building',
  ELIZABETHS_BREAD: 'player.reduce.troops.upkeep.1',
  ELIZABETHS_GRANARY: 'player.reduce.troops.upkeep.7',
  MARSHALS_SEAL: 'player.reduce.troops.cost.1',
  MARSHALS_CHARTER: 'player.reduce.troops.cost.7',
  // ---- city ----
  KINGS_PEACE: 'player.peace.1',
  LOCATORS_CHARTER: 'consume.move.1',
  MAGDEBURG_RIGHTS: 'player.pop.1.a',
  THERIAC: 'player.relive.1',
  // ---- boxes ----
  BRONZE_COFFER: 'player.box.special.1',
  SILVER_COFFER: 'player.box.special.2',
  GOLD_COFFER: 'player.box.special.3',
  OATH_OF_FEALTY: 'player.box.currently.1',
  FOUNDERS_GIFT: 'player.box.present.2',
  // ---- heroes ----
  HOLY_WATER: 'hero.reset.1',
  JOYEUSE: 'hero.power.1',
  MIRROR_OF_KINGS: 'hero.management.1',
  STRATAGEMS: 'hero.intelligence.1',
  DEEDS_OF_THE_SAXONS: 'player.experience.1.a',
  EPITOME_OF_MILITARY_SCIENCE: 'player.experience.1.b',
  NIBELUNGENLIED: 'player.experience.1.c',
  // ---- medals (hero loyalty), level 1 … 9: medalId(level) ----
  CROSS_MEDAL: 'hero.loyalty.1',
  ROSE_MEDAL: 'hero.loyalty.2',
  LION_MEDAL: 'hero.loyalty.3',
  HONOUR_MEDAL: 'hero.loyalty.4',
  COURAGE_MEDAL: 'hero.loyalty.5',
  WISDOM_MEDAL: 'hero.loyalty.6',
  FIDELITY_MEDAL: 'hero.loyalty.7',
  JUSTICE_MEDAL: 'hero.loyalty.8',
  CROWN_MEDAL: 'hero.loyalty.9',
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
