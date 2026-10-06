import { BUILDING_NAMES, getGameSpeed, TROOP_NAMES } from '@evony/core';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en');

export const fmt = (n: number) => (Math.abs(n) >= 100_000 ? compact.format(n) : whole.format(Math.floor(n)));
export const fmtExact = (n: number) => whole.format(Math.floor(n));
export const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(-n)}`);

/** A per-game-hour rate (as the server computes it) per real hour: game time runs GAME_SPEED times faster. */
export const realHourly = (perGameHour: number) => perGameHour * getGameSpeed();
/** "+1.2M/h": a per-game-hour rate shown per real hour. */
export const signedRate = (perGameHour: number) => `${signed(realHourly(perGameHour))}/h`;

/** 1h 02m 03s */
export function duration(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86_400);
  s -= d * 86_400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  if (d) return `${d}d ${h}h ${pad(m)}m`;
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export const buildingName = (typeId: number) => BUILDING_NAMES[typeId] ?? `Building ${typeId}`;
export const troopName = (troopId: number) => TROOP_NAMES[troopId] ?? `Unit ${troopId}`;

export const RESOURCES = ['gold', 'food', 'wood', 'stone', 'iron'] as const;
export type Resource = (typeof RESOURCES)[number];
export const RESOURCE_LABEL: Record<Resource, string> = { gold: 'Gold', food: 'Food', wood: 'Lumber', stone: 'Stone', iron: 'Iron' };
