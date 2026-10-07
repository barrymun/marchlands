// (evony-re) Hero gear, after Age II's Hero Enhancement: 14 pieces that every hero of a lord wears.
// The pieces' level is the lord's Hero Enhancement research (1-10); stars (0-10 per piece) are
// bought with medals and belong to the lord as well. A hero can use gear levels and stars up to its
// gear tier (from its own level), and all of it boosts the one attribute chosen for that hero.

import { BALANCE } from './balance.ts';
import { TechType } from './constants.ts';
import { medalId } from './items.ts';

export const GEAR_PIECES = [
  { id: 'weapon', name: 'Weaponry' },
  { id: 'shield', name: 'Shield' },
  { id: 'mount', name: 'Mount' },
  { id: 'necklace', name: 'Necklace' },
  { id: 'charm', name: 'Charm' },
  { id: 'ring', name: 'Ring' },
  { id: 'head', name: 'Head Gear' },
  { id: 'shoulder', name: 'Shoulder Gear' },
  { id: 'chest', name: 'Chest Gear' },
  { id: 'back', name: 'Back Gear' },
  { id: 'gauntlets', name: 'Gauntlets' },
  { id: 'belt', name: 'Belt' },
  { id: 'legs', name: 'Leg Gear' },
  { id: 'feet', name: 'Foot Gear' },
] as const;

export type GearPieceId = (typeof GEAR_PIECES)[number]['id'];
export const GEAR_PIECE_IDS: readonly GearPieceId[] = GEAR_PIECES.map((p) => p.id);
export const isGearPiece = (id: string): id is GearPieceId => (GEAR_PIECE_IDS as readonly string[]).includes(id);

/** The attribute a hero's gear boosts. */
export type GearStat = 'power' | 'management' | 'stratagem';
export const GEAR_STATS: readonly GearStat[] = ['power', 'management', 'stratagem'];

/** A lord's gear: piece level (= Hero Enhancement research level) and stars per piece. */
export interface LordGear {
  level: number;
  stars: Partial<Record<GearPieceId, number>>;
}

/** The lord's gear from their research and misc (stars). */
export function lordGear(p: { research: Record<number, { level: number } | undefined>; misc: { gearStars?: Partial<Record<string, number>> } }): LordGear {
  const stars: LordGear['stars'] = {};
  for (const [id, n] of Object.entries(p.misc.gearStars ?? {})) if (isGearPiece(id) && n) stars[id] = n;
  return { level: p.research[TechType.HERO_ENHANCEMENT]?.level ?? 0, stars };
}

/**
 * How many gear levels and stars a hero of `heroLevel` can use: none at levels 1-9, 1 at 10-19, …,
 * 9 at 90-99 and all 10 at the maximum level (100).
 */
export function gearTier(heroLevel: number): number {
  return Math.max(0, Math.min(BALANCE.heroGear.maxLevel, Math.floor(heroLevel / 10)));
}

/** Stars a piece can hold: no more than the Hero Enhancement level (stars bought beyond it wait, unused). */
export const gearStarLimit = (gear: LordGear) => Math.min(gear.level, BALANCE.heroGear.maxStars);

/** Attribute points of one piece at gear level `level`: 1 + 2 + … + level (55 at level 10). */
export const gearLevelPoints = (level: number) => (level * (level + 1)) / 2;

export interface GearPieceBonus {
  id: GearPieceId;
  name: string;
  /** the lord's level and stars for this piece */
  level: number;
  stars: number;
  /** what this hero can use of them (gear tier; stars also no more than the Hero Enhancement level) */
  usedLevel: number;
  usedStars: number;
  points: number;
}

/** Every piece's contribution for a hero of `heroLevel`, and the total. */
export function heroGearBreakdown(heroLevel: number, gear: LordGear): { tier: number; pieces: GearPieceBonus[]; total: number } {
  const tier = gearTier(heroLevel);
  const pieces = GEAR_PIECES.map((p) => {
    const level = Math.min(gear.level, BALANCE.heroGear.maxLevel);
    const stars = Math.min(gear.stars[p.id] ?? 0, BALANCE.heroGear.maxStars);
    const usedLevel = Math.min(level, tier);
    const usedStars = Math.min(stars, tier, gearStarLimit(gear));
    return { id: p.id, name: p.name, level, stars, usedLevel, usedStars, points: gearLevelPoints(usedLevel) + usedStars * BALANCE.heroGear.starPoints };
  });
  return { tier, pieces, total: pieces.reduce((s, p) => s + p.points, 0) };
}

/** Total gear points for a hero of `heroLevel`. */
export const heroGearBonus = (heroLevel: number, gear: LordGear) => heroGearBreakdown(heroLevel, gear).total;

/** Medals for a piece's star `star` (1-10): stars 1-9 take one medal of that level, star 10 several Nation Medals. */
export function gearStarCost(star: number): { itemId: string; count: number } {
  const { maxStars, lastStarMedals } = BALANCE.heroGear;
  if (star >= maxStars) return { itemId: medalId(9), count: lastStarMedals };
  return { itemId: medalId(star), count: 1 };
}

interface GearedHero {
  level: number;
  power: number;
  management: number;
  stratagem: number;
  powerAdded: number;
  managementAdded: number;
  stratagemAdded: number;
  gearStat: string | null;
}

/** The attribute a hero's gear boosts: the chosen one, else the hero's highest assigned attribute. */
export function heroGearStat(h: Pick<GearedHero, 'power' | 'management' | 'stratagem' | 'gearStat'>): GearStat {
  if (h.gearStat && (GEAR_STATS as readonly string[]).includes(h.gearStat)) return h.gearStat as GearStat;
  if (h.power >= h.management && h.power >= h.stratagem) return 'power';
  return h.management >= h.stratagem ? 'management' : 'stratagem';
}

/** Put the hero's gear points on its gear attribute (`gear` null: no gear, e.g. a captive). Returns whether anything changed. */
export function syncHeroGear(h: GearedHero, gear: LordGear | null): boolean {
  const bonus = gear ? heroGearBonus(h.level, gear) : 0;
  const stat = heroGearStat(h);
  const next = { powerAdded: 0, managementAdded: 0, stratagemAdded: 0, [`${stat}Added`]: bonus };
  const changed = h.powerAdded !== next.powerAdded || h.managementAdded !== next.managementAdded || h.stratagemAdded !== next.stratagemAdded;
  Object.assign(h, next);
  return changed;
}
