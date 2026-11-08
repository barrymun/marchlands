// Running boosts (item and hero boosts) (see index.ts): what a buff does, stored in its `desc`
// (players.buffs, heroes.buffs, battle report bonuses) and worded by the client.
export const BUFF_MESSAGES = {
  /** Food / lumber / stone / iron production item (`resource`), `percent`: BALANCE.resourceBuffBonus */
  production: ['resource', 'percent'],
  /** gold income item, `percent`: BALANCE.resourceBuffBonus */
  goldIncome: ['percent'],
  /** attack item (Olifant), `percent`: the battle bonus (combat.ts buffBonus) */
  troopAttack: ['percent'],
  /** defence item, `percent`: the battle bonus (combat.ts buffBonus) */
  troopDefense: ['percent'],
  /** Imperial Banner, `percent`: BALANCE.imperialBannerTroopBonus */
  armySize: ['percent'],
  /** extra construction queue item */
  buildingQueue: [],
  /** upkeep item, `percent`: the reduction (economy.ts) */
  upkeep: ['percent'],
  /** Marshal's Seal or Charter, `percent`: BALANCE.trainCostReduction */
  trainingCost: ['percent'],
  /** King's Peace running */
  truce: [],
  /** a new King's Peace cannot be used yet */
  truceCooldown: [],
  /** the Locator's Charter cannot be used yet */
  teleportCooldown: [],
  /** holiday mode */
  holiday: [],
  /** hero attribute item (`stat`), `percent`: BALANCE.items.heroAttributeBuff.bonus */
  heroStat: ['stat', 'percent'],
} as const;
