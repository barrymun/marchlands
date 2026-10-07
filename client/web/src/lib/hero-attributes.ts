// Hero attributes with their display colours: one place to reference politics = green, attack = red, intelligence = blue.

import { heroManagement, heroPower, heroStratagem } from '@evony/core';
import type { HeroBean } from '@evony/api-client';

/** Badge colours (background + text, light and dark) per attribute. */
export const ATTRIBUTE_TONE = {
  pol: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  att: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  int: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
} as const;

export type AttributeKey = keyof typeof ATTRIBUTE_TONE;

export const HERO_ATTRIBUTES = [
  { key: 'pol', label: 'Politics', short: 'pol', value: heroManagement, tone: ATTRIBUTE_TONE.pol },
  { key: 'att', label: 'Attack', short: 'att', value: heroPower, tone: ATTRIBUTE_TONE.att },
  { key: 'int', label: 'Intelligence', short: 'int', value: heroStratagem, tone: ATTRIBUTE_TONE.int },
] as const satisfies readonly { key: AttributeKey; label: string; short: string; value: (h: HeroBean) => number; tone: string }[];

export type HeroAttributeValue = (typeof HERO_ATTRIBUTES)[number] & { v: number };

/** Every attribute with the hero's current value (buffs included). */
export function heroAttributeValues(hero: HeroBean): HeroAttributeValue[] {
  return HERO_ATTRIBUTES.map((a) => ({ ...a, v: a.value(hero) }));
}

/** The hero's highest attribute (what the hero is best at); ties go to the first in HERO_ATTRIBUTES. */
export function dominantAttribute(hero: HeroBean): HeroAttributeValue {
  return heroAttributeValues(hero).reduce((best, a) => (a.v > best.v ? a : best));
}
