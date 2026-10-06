// Player-facing technology descriptions. Each effect mirrors where the tech is used (economy,
// construction, troops/marching, the battle simulator in `fixes` mode, scouting), with numbers
// taken from BALANCE, so the text follows the rules. "Unlocks" is derived from the requirement data.

import { BALANCE } from './balance.ts';
import { BUILDING_NAMES, TECH_NAMES, TechType, TROOP_NAMES } from './constants.ts';
import { BUILDINGS, RESEARCH, TROOPS } from './data/index.ts';

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const timeCut = (level: number) => pct(1 - Math.pow(BALANCE.techTimeFactor, level));

interface TechText {
  /** what one level does, in a sentence */
  summary: string;
  /** the total effect at `level` (level > 0) */
  effect?: (level: number) => string;
}

const RES_TECH: Record<number, string> = { [TechType.AGRICULTURE]: 'food', [TechType.LUMBERING]: 'lumber', [TechType.MASONRY]: 'stone', [TechType.MINING]: 'iron' };

const TEXT: Record<number, TechText> = {
  ...Object.fromEntries(
    Object.entries(RES_TECH).map(([id, res]) => [
      Number(id),
      {
        summary: `+${pct(BALANCE.resourceTechBonusPerLevel)} ${res} production per level (on field output).`,
        effect: (l: number) => `+${pct(l * BALANCE.resourceTechBonusPerLevel)} ${res} production`,
      },
    ]),
  ),
  [TechType.STOCKPILE]: {
    summary: `+${pct(BALANCE.stockpileStorageBonusPerLevel)} storage for food, lumber, stone and iron per level.`,
    effect: (l) => `+${pct(l * BALANCE.stockpileStorageBonusPerLevel)} storage`,
  },
  [TechType.CONSTRUCTION]: {
    summary: `Building, demolition and fortification times ×${BALANCE.techTimeFactor} per level.`,
    effect: (l) => `−${timeCut(l)} build, demolish and fortification time`,
  },
  [TechType.MILITARY_SCIENCE]: {
    summary: `Training time of every troop except siege units ×${BALANCE.techTimeFactor} per level.`,
    effect: (l) => `−${timeCut(l)} troop training time`,
  },
  [TechType.METAL_CASTING]: {
    summary: `Training time of siege units (ballistas, battering rams, catapults) ×${BALANCE.techTimeFactor} per level.`,
    effect: (l) => `−${timeCut(l)} siege training time`,
  },
  [TechType.MILITARY_TRADITION]: {
    summary: 'Troop attack +5% per level in battle.',
    effect: (l) => `+${l * 5}% troop attack`,
  },
  [TechType.IRON_WORKING]: {
    summary: "Troops and Archer's Towers take less damage: defence +5% per level in battle.",
    effect: (l) => `+${l * 5}% troop defence`,
  },
  [TechType.MEDICINE]: {
    summary: `Life of foot troops (workers to archers) and Archer's Towers +5% per level in battle. ${pct(BALANCE.medicinePerLevel)} per level of the troops you lose (up to 50%), defending your city or attacking, survive as injured troops you can heal with resources or honor.`,
    effect: (l) => `+${l * 5}% foot troop life, ${pct(Math.min(0.5, l * BALANCE.medicinePerLevel))} of fallen troops recover injured`,
  },
  [TechType.ARCHERY]: {
    summary: "Range of archers, ballistas, catapults and Archer's Towers +5% per level in battle.",
    effect: (l) => `+${l * 5}% range`,
  },
  [TechType.COMPASS]: {
    summary: `Foot troops march +${pct(BALANCE.compassSpeedPerLevel)} faster per level, and move +10% faster per level in battle.`,
    effect: (l) => `+${pct(l * BALANCE.compassSpeedPerLevel)} foot troop speed`,
  },
  [TechType.HORSEBACK_RIDING]: {
    summary: `Mounted and siege units march +${pct(BALANCE.horsebackSpeedPerLevel)} faster per level, and move +5% faster per level in battle.`,
    effect: (l) => `+${pct(l * BALANCE.horsebackSpeedPerLevel)} mounted and siege speed`,
  },
  [TechType.LOGISTICS]: {
    summary: `Armies carry +${pct(BALANCE.logisticsLoadPerLevel)} more resources per level (plunder and transport).`,
    effect: (l) => `+${pct(l * BALANCE.logisticsLoadPerLevel)} carrying capacity`,
  },
  [TechType.INFORMATICS]: {
    summary: "Better scouting of lords' cities: level 1 also reveals their heroes, level 2 also their buildings.",
    effect: (l) => (l >= 2 ? 'scouts see troops, resources, heroes and buildings' : 'scouts see troops, resources and heroes'),
  },
  [TechType.MACHINERY]: { summary: 'No effect on this server yet.' },
  [TechType.ENGINEERING]: { summary: 'No effect on this server yet.' },
  [TechType.PRIVATEERING]: { summary: 'No effect on this server yet.' },
};

export interface TechInfo {
  id: number;
  name: string;
  summary: string;
  /** buildings, troops and technologies that require this tech, with the level they need */
  unlocks: { kind: 'building' | 'troop' | 'tech'; name: string; level: number }[];
}

/** Lowest required level of `techId` for each building, troop and technology that needs it. */
function unlocksOf(techId: number): TechInfo['unlocks'] {
  const out = new Map<string, TechInfo['unlocks'][number]>();
  const add = (kind: 'building' | 'troop' | 'tech', name: string | undefined, level: number) => {
    if (!name) return;
    const key = `${kind}:${name}`;
    const prev = out.get(key);
    if (!prev || level < prev.level) out.set(key, { kind, name, level });
  };
  for (const b of BUILDINGS) for (const t of b.requires.techs) if (t.id === techId && b.level === 1) add('building', BUILDING_NAMES[b.typeId], t.level);
  for (const tr of TROOPS) for (const t of tr.requires.techs) if (t.id === techId) add('troop', TROOP_NAMES[tr.troopId], t.level);
  for (const r of RESEARCH) for (const t of r.requires.techs) if (t.id === techId && r.techId !== techId && r.level === 1) add('tech', TECH_NAMES[r.techId], t.level);
  return [...out.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function techInfo(techId: number): TechInfo {
  return { id: techId, name: TECH_NAMES[techId] ?? `Tech ${techId}`, summary: TEXT[techId]?.summary ?? '', unlocks: unlocksOf(techId) };
}

/** The total effect of a tech at `level` ('' when it has no measurable effect). */
export function techEffect(techId: number, level: number): string {
  if (level <= 0) return '';
  return TEXT[techId]?.effect?.(level) ?? '';
}
