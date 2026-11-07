// Hero generation and progression (orig spitfire::RandomStat / CreateRandomHero, Hero.cpp).

import { BALANCE } from '#/balance.ts';
import type { Sex } from '#/constants.ts';
import { heroName } from '#/hero-names.ts';
import { pick, randInt, type Rng, seededRng } from '#/rng.ts';

export interface HeroStats {
  level: number;
  experience: number;
  upgradeExp: number;
  loyalty: number;
  basePower: number;
  baseManagement: number;
  baseStratagem: number;
  power: number;
  management: number;
  stratagem: number;
  powerAdded: number;
  managementAdded: number;
  stratagemAdded: number;
  powerBuffAdded: number;
  managementBuffAdded: number;
  stratagemBuffAdded: number;
  remainPoint: number;
}

export interface GeneratedHero extends HeroStats {
  name: string;
  sex: Sex;
  logoUrl: string;
}

/** Total attributes including equipment/buff bonuses (orig GetPower/GetManagement/GetStratagem). */
export const heroPower = (h: HeroStats) => h.power + h.powerAdded + h.powerBuffAdded;
export const heroManagement = (h: HeroStats) => h.management + h.managementAdded + h.managementBuffAdded;
export const heroStratagem = (h: HeroStats) => h.stratagem + h.stratagemAdded + h.stratagemBuffAdded;

/**
 * (marchlands) What an attribute of a hero is worth as if the hero were level 1: its value now, plus its unspent points, less
 * one per level above 1. Points an Inn offer already has in other attributes never come back, so this, not the stored base,
 * says what it can reach: this + (level - 1) at any level, with every point from here on put in that attribute.
 */
export const levelOneValue = (value: number, h: { level: number; remainPoint: number }) => value + h.remainPoint - (h.level - 1);

/** Experience for the next level: level² × 100 (level 99 → 980,100); (marchlands) none past BALANCE.heroMaxLevel. */
export const upgradeExpFor = (level: number) => {
  const l = Math.min(level, BALANCE.heroMaxLevel);
  return l * l * 100;
};

/** (marchlands) BALANCE.heroSoftCap: the attribute in full up to the knee, √(knee × attribute) above it. */
export function softCapAttribute(value: number, on: boolean): number {
  const { knee } = BALANCE.heroSoftCap;
  return on && value > knee ? Math.sqrt(knee * value) : value;
}

/** Mayor production bonus (share of field output) from the mayor's politics, soft-capped when on. */
export const mayorProductionBonus = (politics: number) => softCapAttribute(politics, BALANCE.heroSoftCap.production) * BALANCE.mayorManagementProductionFactor;

/** Hero attack's share added to troop attack in battle (attack / 100), soft-capped when on. */
export const heroBattleAttackBonus = (attack: number) => softCapAttribute(attack, BALANCE.heroSoftCap.battle) / 100;

/** (marchlands) Heroes at BALANCE.heroMaxLevel gain no more experience. */
export const heroAtMaxLevel = (h: { level: number }) => h.level >= BALANCE.heroMaxLevel;

/** Add experience to a hero (nothing at the maximum level). */
export function addHeroExp(h: { level: number; experience: number }, exp: number): void {
  if (heroAtMaxLevel(h)) {
    h.experience = 0;
    return;
  }
  h.experience += exp;
}

type Levelling = { level: number; experience: number; upgradeExp: number; remainPoint: number };

/** (marchlands) How many levels the hero's experience pays for right now, up to BALANCE.heroMaxLevel (orig: one per hero.levelUp). */
export function levelsReady(h: Omit<Levelling, 'remainPoint'>): number {
  let { level, experience, upgradeExp } = h;
  let n = 0;
  while (experience >= upgradeExp && level < BALANCE.heroMaxLevel) {
    experience -= upgradeExp;
    level += 1;
    upgradeExp = upgradeExpFor(level);
    n += 1;
  }
  return n;
}

/** Spend experience on every level it pays for (+1 attribute point each); returns the levels gained. */
export function levelUpAll(h: Levelling): number {
  const n = levelsReady(h);
  for (let i = 0; i < n; i++) {
    h.experience -= h.upgradeExp;
    h.level += 1;
    h.remainPoint += 1;
    h.upgradeExp = upgradeExpFor(h.level);
  }
  // experience left over at the maximum level is dropped
  if (heroAtMaxLevel(h)) h.experience = 0;
  return n;
}

/** Base attribute roll (orig RandomStat distribution). */
export function randomStat(rng: Rng): number {
  const r = randInt(rng, 0, 9999);
  if (r < 6500) return 15 + randInt(rng, 0, 20);
  if (r < 8500) return 30 + randInt(rng, 0, 20);
  if (r < 9500) return 45 + randInt(rng, 0, 15);
  if (r < 9900) return 60 + randInt(rng, 0, 10);
  if (r < 9950) return 70 + randInt(rng, 0, 5);
  if (r < 9975) return 75 + randInt(rng, 0, 4);
  return 10;
}

const FACES = Array.from({ length: 30 }, (_, i) => `images/icon/player/faceA${i + 1}.jpg`);

/** Heroes the Inn offers at `innLevel`: one per level, up to BALANCE.inn.maxOffers. */
export function innOffers(innLevel: number): number {
  return Math.min(BALANCE.inn.maxOffers, innLevel);
}

/** Highest level of a hero the Inn offers at `innLevel`. */
export function innHeroMaxLevel(innLevel: number): number {
  return BALANCE.inn.heroLevelsPerInnLevel * innLevel;
}

/**
 * Tavern hero for an Inn of `innLevel` (orig CreateRandomHero): level 1..5*inn, `level`
 * attribute points spread randomly over power/management/stratagem on top of base rolls.
 * Fixes the original's bug where base stratagem could be dropped. (marchlands) Named for the
 * city's state, now and then a traveller's (heroName), avoiding the names in `taken`.
 */
export function createRandomHero(innLevel: number, rng: Rng, city: { state: number; taken?: ReadonlySet<string> }): GeneratedHero {
  const { name, sex } = heroName(rng, city.state, { travellers: true, taken: city.taken });
  const level = randInt(rng, 1, Math.max(1, innHeroMaxLevel(innLevel)));
  const baseManagement = randomStat(rng);
  const baseStratagem = randomStat(rng);
  const basePower = randomStat(rng);
  let remain = level;
  const p = randInt(rng, 0, remain - 1);
  remain -= p;
  const m = remain > 0 ? randInt(rng, 0, remain - 1) : 0;
  remain -= m;
  const s = remain;
  return {
    name,
    sex,
    logoUrl: pick(rng, FACES),
    level,
    experience: 0,
    upgradeExp: upgradeExpFor(level),
    loyalty: 70,
    basePower,
    baseManagement,
    baseStratagem,
    power: basePower + p,
    management: baseManagement + m,
    stratagem: baseStratagem + s,
    powerAdded: 0,
    managementAdded: 0,
    stratagemAdded: 0,
    powerBuffAdded: 0,
    managementBuffAdded: 0,
    stratagemBuffAdded: 0,
    remainPoint: 0,
  };
}

/**
 * Temporary defending hero of an NPC city (orig NpcCity::ResetHero) or valley (ValleyData::Reset) in `state`, named for
 * it. The name comes from its own generator seeded by two draws, as many as the old names took, so a seed kept on a
 * tile still gives the same level and stats.
 */
export function createGuardHero(maxLevel: number, rng: Rng, state: number): GeneratedHero {
  const { name, sex } = heroName(seededRng(`${rng.next()}:${rng.next()}`), state);
  const level = randInt(rng, 1, Math.max(1, maxLevel));
  const power = 30 + randInt(rng, 0, 29);
  return {
    name,
    sex,
    logoUrl: pick(rng, FACES),
    level,
    experience: 0,
    upgradeExp: upgradeExpFor(level),
    loyalty: BALANCE.heroMaxLoyalty,
    basePower: power,
    baseManagement: 30,
    baseStratagem: 30,
    power,
    management: 30 + randInt(rng, 0, 29),
    stratagem: 30 + randInt(rng, 0, 29),
    powerAdded: level,
    managementAdded: 0,
    stratagemAdded: 0,
    powerBuffAdded: 0,
    managementBuffAdded: 0,
    stratagemBuffAdded: 0,
    remainPoint: 0,
  };
}

/** A hero's loyalty after a medal (BALANCE.items.medalLoyalty), never above BALANCE.heroMaxLoyalty. */
export function loyaltyAfterMedal(loyalty: number, itemId: string): number {
  return Math.min(BALANCE.heroMaxLoyalty, loyalty + (BALANCE.items.medalLoyalty[itemId] ?? 0));
}

export const heroHireCost = (level: number) => level * BALANCE.heroHireCostPerLevel;
export const tavernRefreshCost = (innLevel: number) => Math.max(1, innLevel) * BALANCE.tavernRefreshGoldPerInnLevel;
export const heroAwardCost = (level: number) => level * BALANCE.heroAwardCostPerLevel;

/** Attribute cap: base stats + one point per level (invariant enforced by hero.addPoint). */
export const heroPointCap = (h: HeroStats) => h.basePower + h.baseManagement + h.baseStratagem + h.level;

/** Experience an experience book gives a hero whose next level needs `upgradeExp` (BALANCE.items.experienceBooks; 0 for other items). */
export function experienceItemGain(itemId: string, upgradeExp: number): number {
  const book = BALANCE.items.experienceBooks[itemId];
  return book ? Math.max(book.min, Math.floor(upgradeExp * book.share)) : 0;
}

/**
 * The Inn's offers at `innLevel`, given the heroes it offers now: the ones it keeps, the ones it drops
 * (it shrank), how many new heroes it adds, and the Inn level they are generated at (capped like the offers).
 */
export function tavernRefill<T>(current: readonly T[], innLevel: number) {
  const offers = innOffers(innLevel);
  const keep = current.slice(0, offers);
  return { keep, drop: current.slice(offers), add: offers - keep.length, heroInnLevel: offers };
}
