// Building descriptions: summary, placement, effect per level (core building-info.ts) (see index.ts).
export const BUILDING_INFO_MESSAGES = {
  // ---- summary: what a building does ----
  /** `count`: field slots per level (BALANCE.outerSlotsPerTownHall), `base`: BALANCE.outerSlotsBase, `level`: BALANCE.beginnerTownHallLevel, `building`: the Town Hall */
  'summary.townHall': ['count', 'base', 'level', 'building'],
  /** `forts`: the fortifications (troop refs), `tower`: the archer's tower */
  'summary.walls': ['forts', 'tower'],
  'summary.cottage': [],
  /** a resource field (`resource`) */
  'summary.field': ['resource'],
  'summary.warehouse': [],
  'summary.barracks': [],
  /** `queues`: BALANCE.researchQueues, `building`: the Academy */
  'summary.academy': ['queues', 'building'],
  /** `gold`: BALANCE.tavernRefreshGoldPerInnLevel */
  'summary.inn': ['gold'],
  'summary.feastingHall': [],
  /** `count`: BALANCE.rallySpotArmiesPerLevel, `troops`: BALANCE.rallySpotTroopsPerLevel, `item`: the Imperial Banner, `percent`: BALANCE.imperialBannerTroopBonus */
  'summary.rallySpot': ['count', 'troops', 'item', 'percent'],
  /** `count`: BALANCE.marketMaxOrdersPerLevel */
  'summary.marketplace': ['count'],
  'summary.reliefStation': [],
  'summary.beaconTower': [],
  'summary.embassy': [],
  /** a building that only unlocks others (Stable, Forge, Workshop) */
  'summary.prerequisite': [],

  // ---- placement: where it can be built and how many ----
  /** Town Hall and Walls */
  'placement.unique': [],
  'placement.inside': [],
  'placement.insideLimited': ['limit'],
  'placement.outside': [],
  'placement.outsideLimited': ['limit'],

  // ---- effect: what a building gives at a level ----
  /** `slots`: field slots, `count`: valleys */
  'effect.townHall': ['slots', 'count'],
  /** `space`: fortification space, `count`: queued batches, `hitPoints`: wall hit points, `percent`: tower range bonus */
  'effect.walls': ['space', 'count', 'hitPoints', 'percent'],
  'effect.cottage': ['population'],
  /** `amount` of `resource` per hour, `storage`, `count`: workers */
  'effect.field': ['amount', 'resource', 'storage', 'count'],
  'effect.warehouse': ['amount'],
  /** `count`: queued batches */
  'effect.barracks': ['count'],
  'effect.academy': ['level'],
  /** `count`: hero offers, `level`: highest hero level */
  'effect.inn': ['count', 'level'],
  /** `count`: hero slots */
  'effect.feastingHall': ['count'],
  /** `count`: armies, `troops`: troops per army */
  'effect.rallySpot': ['count', 'troops'],
  /** `count`: waiting orders */
  'effect.marketplace': ['count'],
  'effect.reliefStation': ['multiplier'],
  'effect.beaconTroops': [],
  'effect.beaconHeroes': [],
} as const;
