// Player-facing technology descriptions, as messages (`techInfo.*`, worded by the client). Each effect mirrors
// where the tech is used (economy, construction, troops/marching, the battle simulator in `fixes` mode,
// scouting), with numbers taken from BALANCE, so the text follows the rules. "Unlocks" is derived from the
// requirement data and names nothing: the client names each entry by its id.

import { BALANCE } from './balance.ts';
import { FortType, TechType, TroopType } from './constants.ts';
import { isFortType, SIEGE } from './construction.ts';
import { BUILDINGS, RESEARCH, TROOPS } from './data/index.ts';
import { GEAR_PIECES, gearLevelPoints } from './gear.ts';
import { msg, ref, share, type Message } from './messages/index.ts';

/** A share param (0.125, shown as 12.5%). */
const pct = share;
/** A per-level battle bonus of BALANCE.battle.researchPct (whole percents, for the simulator's parity) as a share param. */
const battlePct = (percent: number) => share(percent / 100);
const timeCut = (level: number) => pct(1 - Math.pow(BALANCE.techTimeFactor, level));

// Battle bonuses per level, as the battle simulator applies them (battle/simulator.ts, battle/resolve.ts).
const BATTLE = BALANCE.battle.researchPct;

interface TechText {
  /** what one level does */
  summary: Message;
  /** the total effect at `level` (level > 0) */
  effect?: (level: number) => Message;
}

const RES_TECH = {
  [TechType.AGRICULTURE]: 'food',
  [TechType.LUMBERING]: 'wood',
  [TechType.MASONRY]: 'stone',
  [TechType.MINING]: 'iron',
} as const;

const TEXT: Record<number, TechText> = {
  ...Object.fromEntries(
    Object.entries(RES_TECH).map(([id, res]) => [
      Number(id),
      {
        summary: msg('techInfo.summary.resource', { resource: ref.resource(res), pct: pct(BALANCE.resourceTechBonusPerLevel) }),
        effect: (l: number) => msg('techInfo.effect.resource', { resource: ref.resource(res), pct: pct(l * BALANCE.resourceTechBonusPerLevel) }),
      },
    ]),
  ),
  [TechType.STOCKPILE]: {
    summary: msg('techInfo.summary.stockpile', { pct: pct(BALANCE.stockpileStorageBonusPerLevel) }),
    effect: (l) => msg('techInfo.effect.stockpile', { pct: pct(l * BALANCE.stockpileStorageBonusPerLevel) }),
  },
  [TechType.CONSTRUCTION]: {
    summary: msg('techInfo.summary.construction', { factor: BALANCE.techTimeFactor }),
    effect: (l) => msg('techInfo.effect.construction', { pct: timeCut(l) }),
  },
  [TechType.MILITARY_SCIENCE]: {
    summary: msg('techInfo.summary.militaryScience', { factor: BALANCE.techTimeFactor }),
    effect: (l) => msg('techInfo.effect.militaryScience', { pct: timeCut(l) }),
  },
  [TechType.METAL_CASTING]: {
    summary: msg('techInfo.summary.metalCasting', { troops: [...SIEGE].sort((a, b) => a - b).map(ref.troop), factor: BALANCE.techTimeFactor }),
    effect: (l) => msg('techInfo.effect.metalCasting', { pct: timeCut(l) }),
  },
  [TechType.HERO_ENHANCEMENT]: {
    summary: msg('techInfo.summary.heroEnhancement', {
      count: GEAR_PIECES.length,
      maxTier: BALANCE.heroGear.maxLevel,
      heroMaxLevel: BALANCE.heroMaxLevel,
    }),
    effect: (l) => msg('techInfo.effect.heroEnhancement', { level: l, points: GEAR_PIECES.length * gearLevelPoints(l) }),
  },
  [TechType.MILITARY_TRADITION]: {
    summary: msg('techInfo.summary.militaryTradition', { pct: battlePct(BATTLE.attack) }),
    effect: (l) => msg('techInfo.effect.militaryTradition', { pct: battlePct(l * BATTLE.attack) }),
  },
  [TechType.IRON_WORKING]: {
    summary: msg('techInfo.summary.ironWorking', { tower: ref.troop(FortType.ARCHER_TOWER), pct: battlePct(BATTLE.defence) }),
    effect: (l) => msg('techInfo.effect.ironWorking', { pct: battlePct(l * BATTLE.defence) }),
  },
  [TechType.MEDICINE]: {
    summary: msg('techInfo.summary.medicine', {
      from: ref.troop(TroopType.WORKER),
      to: ref.troop(TroopType.ARCHER),
      tower: ref.troop(FortType.ARCHER_TOWER),
      pct: battlePct(BATTLE.life),
      injured: pct(BALANCE.medicinePerLevel),
      max: pct(BALANCE.medicineMaxShare),
    }),
    effect: (l) =>
      msg('techInfo.effect.medicine', { life: battlePct(l * BATTLE.life), injured: pct(Math.min(BALANCE.medicineMaxShare, l * BALANCE.medicinePerLevel)) }),
  },
  [TechType.ARCHERY]: {
    summary: msg('techInfo.summary.archery', {
      troops: [TroopType.ARCHER, TroopType.BALLISTA, TroopType.CATAPULT, FortType.ARCHER_TOWER].map(ref.troop),
      pct: battlePct(BATTLE.range),
    }),
    effect: (l) => msg('techInfo.effect.archery', { pct: battlePct(l * BATTLE.range) }),
  },
  [TechType.COMPASS]: {
    summary: msg('techInfo.summary.compass', { march: pct(BALANCE.compassSpeedPerLevel), battle: battlePct(BATTLE.footSpeed) }),
    effect: (l) => msg('techInfo.effect.compass', { pct: pct(l * BALANCE.compassSpeedPerLevel) }),
  },
  [TechType.HORSEBACK_RIDING]: {
    summary: msg('techInfo.summary.horsebackRiding', { march: pct(BALANCE.horsebackSpeedPerLevel), battle: battlePct(BATTLE.mountedSpeed) }),
    effect: (l) => msg('techInfo.effect.horsebackRiding', { pct: pct(l * BALANCE.horsebackSpeedPerLevel) }),
  },
  [TechType.LOGISTICS]: {
    summary: msg('techInfo.summary.logistics', { pct: pct(BALANCE.logisticsLoadPerLevel) }),
    effect: (l) => msg('techInfo.effect.logistics', { pct: pct(l * BALANCE.logisticsLoadPerLevel) }),
  },
  [TechType.INFORMATICS]: {
    summary: msg('techInfo.summary.informatics', { heroes: 1, buildings: 2 }),
    effect: (l) => (l >= 2 ? msg('techInfo.effect.informaticsBuildings') : msg('techInfo.effect.informaticsHeroes')),
  },
  [TechType.MACHINERY]: { summary: msg('techInfo.summary.none') },
  [TechType.ENGINEERING]: { summary: msg('techInfo.summary.none') },
  [TechType.PRIVATEERING]: { summary: msg('techInfo.summary.none') },
};

export type TechUnlockKind = 'building' | 'troop' | 'tech';

export interface TechInfo {
  id: number;
  summary: Message;
  /** buildings, troops and technologies (by id) that require this tech, with the level they need */
  unlocks: { kind: TechUnlockKind; id: number; level: number }[];
}

/** Lowest required level of `techId` for each building, troop and technology that needs it. */
function unlocksOf(techId: number): TechInfo['unlocks'] {
  const out = new Map<string, TechInfo['unlocks'][number]>();
  const add = (kind: TechUnlockKind, id: number, level: number) => {
    const key = `${kind}:${id}`;
    const prev = out.get(key);
    if (!prev || level < prev.level) out.set(key, { kind, id, level });
  };
  // fortifications have building configs too, but are listed as the troops they are
  for (const b of BUILDINGS) {
    if (b.level !== 1 || isFortType(b.typeId)) continue;
    for (const t of b.requires.techs) if (t.id === techId) add('building', b.typeId, t.level);
  }
  for (const tr of TROOPS) for (const t of tr.requires.techs) if (t.id === techId) add('troop', tr.troopId, t.level);
  for (const r of RESEARCH) for (const t of r.requires.techs) if (t.id === techId && r.techId !== techId && r.level === 1) add('tech', r.techId, t.level);
  const order: TechUnlockKind[] = ['building', 'troop', 'tech'];
  return [...out.values()].sort((a, b) => a.level - b.level || order.indexOf(a.kind) - order.indexOf(b.kind) || a.id - b.id);
}

export function techInfo(techId: number): TechInfo {
  return { id: techId, summary: TEXT[techId]?.summary ?? msg('techInfo.summary.none'), unlocks: unlocksOf(techId) };
}

/** The total effect of a tech at `level` (null when it has no measurable effect). */
export function techEffect(techId: number, level: number): Message | null {
  if (level <= 0) return null;
  return TEXT[techId]?.effect?.(level) ?? null;
}
