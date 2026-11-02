import { DAY, getGameSpeed, HOUR } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/**
 * The locale dates and times are written in: the player's, but Arabic with Western digits (0-9), as the coordinates
 * and times the code writes are.
 */
const dateLocale = () => (i18n.language === 'ar' ? 'ar-u-nu-latn' : i18n.language);

/**
 * Number formats for the current locale (made again when the locale changes). English locales share plain
 * 'en' (en-GB alone would write 1.2m for 1.2M); others use their own (ja-JP: 12万), Arabic with Western digits.
 */
let formats: {
  lng: string;
  compact: Intl.NumberFormat;
  whole: Intl.NumberFormat;
  decimals: Map<string, Intl.NumberFormat>;
  percents: Map<string, Intl.NumberFormat>;
} | null = null;
const numberLocale = () => (i18n.language.startsWith('en') ? 'en' : dateLocale());
function numberFormats() {
  if (formats?.lng !== i18n.language) {
    const locale = numberLocale();
    formats = {
      lng: i18n.language,
      compact: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
      whole: new Intl.NumberFormat(locale),
      decimals: new Map(),
      percents: new Map(),
    };
  }
  return formats;
}

/** A number with up to `max` decimals (at least `min`), not abbreviated: 1,234.57. */
export function fmtDecimal(n: number, max: number, min = 0): string {
  const { decimals } = numberFormats();
  const key = `${min}-${max}`;
  let f = decimals.get(key);
  if (!f) decimals.set(key, (f = new Intl.NumberFormat(numberLocale(), { minimumFractionDigits: min, maximumFractionDigits: max })));
  return f.format(n);
}

/** A date and time in the current locale (11/10/2026, 13:14:10 in en-GB). */
export const dateTime = (ms: number) => new Date(ms).toLocaleString(dateLocale());

/** A time of day in the current locale; `short` leaves out the seconds. */
export const clockTime = (ms: number, short = false) =>
  new Date(ms).toLocaleTimeString(dateLocale(), short ? { hour: '2-digit', minute: '2-digit' } : undefined);

/** A time of day in UTC, to the second and on the 24-hour clock in every locale: landing times (camp times). */
export const utcClock = (ms: number) =>
  new Date(ms).toLocaleTimeString(dateLocale(), { timeZone: 'UTC', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** A day and month in the current locale (11 Oct in en-GB), for chart axes. */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const fmt = (n: number) => (Math.abs(n) >= 100_000 ? numberFormats().compact.format(n) : numberFormats().whole.format(Math.floor(n)));
export const fmtExact = (n: number) => numberFormats().whole.format(Math.floor(n));
export const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(-n)}`);

/** A per-game-hour rate (as the server computes it) per real hour: game time runs GAME_SPEED times faster. */
export const realHourly = (perGameHour: number) => perGameHour * getGameSpeed();
/** "+1.2M/h": a per-game-hour rate shown per real hour. */
export const signedRate = (perGameHour: number) => i18n.t('common:units.perHour', { value: signed(realHourly(perGameHour)) });

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
  const days = (v: number) => i18n.t('common:units.days', { value: v });
  const hours = (v: number) => i18n.t('common:units.hours', { value: v });
  const minutes = (v: number | string) => i18n.t('common:units.minutes', { value: v });
  const seconds = (v: number | string) => i18n.t('common:units.seconds', { value: v });
  if (d) return `${days(d)} ${hours(h)} ${minutes(pad(m))}`;
  if (h) return `${hours(h)} ${minutes(pad(m))} ${seconds(pad(s))}`;
  if (m) return `${minutes(m)} ${seconds(pad(s))}`;
  return seconds(s);
}

/** A length of time in words: whole days when it is a day or more ("7 days"), else hours ("6 hours"). */
export function period(ms: number): string {
  const days = ms / DAY;
  return days >= 1 ? i18n.t('common:durations.days', { count: days }) : i18n.t('common:durations.hours', { count: Math.round(ms / HOUR) });
}

/** The two largest units: 4d 18h, 18h 03m, 5m 09s. */
export function shortDuration(ms: number): string {
  return duration(ms).split(' ').slice(0, 2).join(' ');
}

export const RESOURCES = ['gold', 'food', 'wood', 'stone', 'iron'] as const;
export type Resource = (typeof RESOURCES)[number];
/** A resource's name as a label ("Lumber"). */
export const resourceLabel = (r: Resource) => i18n.t(`common:resources.${r}`);

/**
 * A fraction (a share, 0.25) as a percent in the current locale, with up to `max` decimals (at least `min`):
 * percent(0.25) -> 25%, percent(0.005, 1) -> 0.5%, percent(0.05, 1, 1) -> 5.0%.
 */
export function percent(x: number, max = 0, min = 0): string {
  const { percents } = numberFormats();
  const key = `${min}-${max}`;
  let f = percents.get(key);
  if (!f) percents.set(key, (f = new Intl.NumberFormat(numberLocale(), { style: 'percent', minimumFractionDigits: min, maximumFractionDigits: max })));
  return f.format(x);
}
