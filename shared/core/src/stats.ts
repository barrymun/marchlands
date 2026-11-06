// (marchlands) The names of a player's statistics counters (player_stats.counters): `group.detail`, such as trained.archer,
// killed.trap, produced.food or npcWins.10. The backend adds to them (ctx.stat) and the Statistics page reads them. Stored, so a
// value never changes without a data migration.

/** A counter's group; the detail after it is a troop, resource, item, level or battle target. */
export const StatGroup = {
  TRAINED: 'trained',
  KILLED: 'killed',
  LOST: 'lost',
  INJURED: 'injured',
  HEALED: 'healed',
  DESERTED: 'deserted',
  DISBANDED: 'disbanded',
  PRODUCED: 'produced',
  WASTED: 'wasted',
  TAXED: 'taxed',
  PLUNDERED: 'plundered',
  STOLEN: 'stolen',
  ATTACKS_WON: 'attacks.won',
  ATTACKS_LOST: 'attacks.lost',
  DEFENSES_WON: 'defenses.won',
  DEFENSES_LOST: 'defenses.lost',
  CAPTURED: 'captured',
  TAKEN: 'taken',
  NPC_WINS: 'npcWins',
  ITEMS_USED: 'items.used',
  ITEMS_GAINED: 'items.gained',
  MARKET_BOUGHT: 'market.bought',
  MARKET_SOLD: 'market.sold',
  GAINED_DAILY_GIFT: 'gained.dailyGift',
  GAINED_BLESSING: 'gained.blessing',
  SPENT_BUILDING: 'spent.building',
  SPENT_RESEARCH: 'spent.research',
  SPENT_TRAINING: 'spent.training',
  SPENT_HEALING: 'spent.healing',
  SPENT_SPEEDUPS: 'spent.speedups',
  SPENT_ITEMS: 'spent.items',
  SPENT_HEROES: 'spent.heroes',
  SPENT_VALLEYS: 'spent.valleys',
  SPENT_COMFORT: 'spent.comfort',
  SPENT_OTHER: 'spent.other',
} as const;
export type StatGroup = (typeof StatGroup)[keyof typeof StatGroup];

/** Counters with no detail to vary. */
export const StatCounter = {
  HONOR: 'honor',
  HEROES_HIRED: 'heroes.hired',
  LEVELS_BUILDING: 'levels.building',
  LEVELS_RESEARCH: 'levels.research',
  LEVELS_HERO: 'levels.hero',
  LEVELS_DEMOLISHED: 'levels.demolished',
  UPKEEP_FOOD: 'upkeep.food',
  SALARIES_GOLD: 'salaries.gold',
  SPENT_HEALING_HONOR: 'spent.healing.honor',
  MARKET_GOLD_PAID: 'market.goldPaid',
  MARKET_GOLD_RECEIVED: 'market.goldReceived',
  SCOUTING_WON: 'scouting.won',
  SCOUTING_LOST: 'scouting.lost',
  SCOUTING_WON_DEFENDING: 'scouting.wonDefending',
  SCOUTING_LOST_DEFENDING: 'scouting.lostDefending',
  CAPTURED_CITY: 'captured.city',
  CAPTURED_NPC: 'captured.npc',
  CAPTURED_VALLEY: 'captured.valley',
} as const;
export type StatCounter = (typeof StatCounter)[keyof typeof StatCounter];

/** A counter's key: `trained.archer`. */
export const statKey = (group: StatGroup, detail: string | number) => `${group}.${detail}`;
/** What every counter of a group starts with: `trained.`. */
export const statPrefix = (group: StatGroup) => `${group}.`;
