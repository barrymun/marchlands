// Running boosts (item and hero boosts) (see index.ts): what a buff does, stored in its `desc`
// (players.buffs, heroes.buffs, battle report bonuses) and worded by the client.
export const BUFF_MESSAGES = {
  /** Food / lumber / stone / iron production item (`resource`), `percent`: BALANCE.resourceBuffBonus */
  production: ['resource', 'percent'],
  /** gold income item, `percent`: BALANCE.resourceBuffBonus */
  goldIncome: ['percent'],
  /** attack item (Ivory Horn), `percent`: the battle bonus (combat.ts buffBonus) */
  troopAttack: ['percent'],
  /** defence item, `percent`: the battle bonus (combat.ts buffBonus) */
  troopDefense: ['percent'],
  /** War Ensign, `percent`: BALANCE.warEnsignTroopBonus */
  armySize: ['percent'],
  /** extra construction queue item */
  buildingQueue: [],
  /** upkeep item, `percent`: the reduction (economy.ts) */
  upkeep: ['percent'],
  /** Quartermaster item, `percent`: BALANCE.trainCostReduction */
  trainingCost: ['percent'],
  /** Truce Agreement running */
  truce: [],
  /** a new Truce Agreement cannot be used yet */
  truceCooldown: [],
  /** the City Teleporter cannot be used yet */
  teleportCooldown: [],
  /** holiday mode */
  holiday: [],
  /** hero attribute item (`stat`), `percent`: HERO_ATTRIBUTE_BUFF.bonus */
  heroStat: ['stat', 'percent'],
  /** a captured hero's home city (param: the city) */
  homeCity: [],
} as const;
