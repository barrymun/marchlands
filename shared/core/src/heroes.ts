// Hero generation and progression (orig spitfire::RandomStat / CreateRandomHero, Hero.cpp).

import { BALANCE } from './balance.ts';
import { pick, randInt, type Rng } from './rng.ts';

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
  logoUrl: string;
}

/** Total attributes including equipment/buff bonuses (orig GetPower/GetManagement/GetStratagem). */
export const heroPower = (h: HeroStats) => h.power + h.powerAdded + h.powerBuffAdded;
export const heroManagement = (h: HeroStats) => h.management + h.managementAdded + h.managementBuffAdded;
export const heroStratagem = (h: HeroStats) => h.stratagem + h.stratagemAdded + h.stratagemBuffAdded;

export const upgradeExpFor = (level: number) => level * level * 100;

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

const FIRST_NAMES = [
  'Aldric', 'Baldwin', 'Cedric', 'Conrad', 'Edmund', 'Godfrey', 'Gunther', 'Hector', 'Leopold', 'Lothar',
  'Magnus', 'Odo', 'Otto', 'Rainald', 'Roland', 'Siegfried', 'Tancred', 'Theobald', 'Ulric', 'Walter',
  'Adela', 'Beatrix', 'Cunigunde', 'Edith', 'Gisela', 'Hildegard', 'Isolde', 'Mathilda', 'Richenza', 'Sibylla',
  'Arnulf', 'Bertram', 'Dietrich', 'Eckhart', 'Florian', 'Gerold', 'Heinrich', 'Ivo', 'Konrad', 'Ludwig',
];
const EPITHETS = [
  'the Bold', 'the Wise', 'the Just', 'the Stern', 'the Fair', 'the Young', 'the Elder', 'the Lion', 'the Hammer',
  'the Pious', 'the Brave', 'the Swift', 'the Iron', 'the Red', 'the Black', 'the Tall', 'the Silent', 'the Shrewd',
];
const FACES = Array.from({ length: 30 }, (_, i) => `images/icon/player/faceA${i + 1}.jpg`);

export function randomHeroName(rng: Rng): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, EPITHETS)}`;
}

/**
 * Tavern hero for an Inn of `innLevel` (orig CreateRandomHero): level 1..5*inn, `level`
 * attribute points spread randomly over power/management/stratagem on top of base rolls.
 * Fixes the original's bug where base stratagem could be dropped.
 */
export function createRandomHero(innLevel: number, rng: Rng): GeneratedHero {
  const level = randInt(rng, 1, Math.max(1, innLevel * 5));
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
    name: randomHeroName(rng),
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

/** Temporary defending hero of an NPC city (orig NpcCity::ResetHero) or valley (ValleyData::Reset). */
export function createGuardHero(maxLevel: number, rng: Rng): GeneratedHero {
  const level = randInt(rng, 1, Math.max(1, maxLevel));
  const power = 30 + randInt(rng, 0, 29);
  return {
    name: randomHeroName(rng),
    logoUrl: pick(rng, FACES),
    level,
    experience: 0,
    upgradeExp: upgradeExpFor(level),
    loyalty: 100,
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

export const heroHireCost = (level: number) => level * BALANCE.heroHireCostPerLevel;
export const tavernRefreshCost = (innLevel: number) => Math.max(1, innLevel) * BALANCE.tavernRefreshGoldPerInnLevel;
export const heroAwardCost = (level: number) => level * BALANCE.heroAwardCostPerLevel;

/** Attribute cap: base stats + one point per level (invariant enforced by hero.addPoint). */
export const heroPointCap = (h: HeroStats) => h.basePower + h.baseManagement + h.baseStratagem + h.level;

/** Experience granted by the original's experience books. */
export function experienceItemGain(itemId: string, upgradeExp: number): number {
  switch (itemId) {
    case 'player.experience.1.a':
      return Math.max(1000, Math.floor(upgradeExp * 0.08));
    case 'player.experience.1.b':
      return Math.max(10_000, Math.floor(upgradeExp * 0.3));
    case 'player.experience.1.c':
      return Math.max(100_000, Math.floor(upgradeExp));
    default:
      return 0;
  }
}

/** Loyalty medals hero.loyalty.1..9 */
export const LOYALTY_MEDALS: Record<string, number> = {
  'hero.loyalty.1': 5,
  'hero.loyalty.2': 10,
  'hero.loyalty.3': 15,
  'hero.loyalty.4': 20,
  'hero.loyalty.5': 25,
  'hero.loyalty.6': 30,
  'hero.loyalty.7': 40,
  'hero.loyalty.8': 50,
  'hero.loyalty.9': 60,
};
