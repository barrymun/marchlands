// Hero attributes with their display colours: one place to reference politics = green, attack = red, intelligence = blue.
// (Running item bonuses are purple: tones.ts.)

import type { HeroBean } from '@marchlands/api-client';
import { type GearStat, heroManagement, heroPower, heroStratagem } from '@marchlands/core';
import { i18n } from '@/lib/i18n';

/** Badge colours (background + text, light and dark) per attribute. */
const ATTRIBUTE_TONE = {
  pol: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  att: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  int: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
} as const;

export type AttributeKey = keyof typeof ATTRIBUTE_TONE;

/** Border colours per attribute, to pick out a card or row (e.g. the boost that suits a hero best). */
export const ATTRIBUTE_BORDER = {
  pol: 'border-emerald-500/70',
  att: 'border-rose-500/70',
  int: 'border-sky-500/70',
} as const satisfies Record<AttributeKey, string>;

/** `stat`: the attribute's field name on the hero (and in gear / boost APIs); `label` and `short` are in the current locale. */
const HERO_ATTRIBUTES = [
  {
    key: 'pol',
    stat: 'management',
    get label() {
      return i18n.t('common:heroAttributes.politics');
    },
    get short() {
      return i18n.t('common:heroAttributes.politicsShort');
    },
    value: heroManagement,
    tone: ATTRIBUTE_TONE.pol,
  },
  {
    key: 'att',
    stat: 'power',
    get label() {
      return i18n.t('common:heroAttributes.attack');
    },
    get short() {
      return i18n.t('common:heroAttributes.attackShort');
    },
    value: heroPower,
    tone: ATTRIBUTE_TONE.att,
  },
  {
    key: 'int',
    stat: 'stratagem',
    get label() {
      return i18n.t('common:heroAttributes.intelligence');
    },
    get short() {
      return i18n.t('common:heroAttributes.intelligenceShort');
    },
    value: heroStratagem,
    tone: ATTRIBUTE_TONE.int,
  },
] as const satisfies readonly { key: AttributeKey; stat: GearStat; label: string; short: string; value: (h: HeroBean) => number; tone: string }[];

/** The attribute entry for a field name ('power' | 'management' | 'stratagem'). */
export const attributeOfStat = (stat: GearStat) => HERO_ATTRIBUTES.find((a) => a.stat === stat) ?? HERO_ATTRIBUTES[0]; // there is one for each stat

export type HeroAttributeValue = (typeof HERO_ATTRIBUTES)[number] & { v: number };

/** Every attribute with the hero's current value (buffs included). */
export function heroAttributeValues(hero: HeroBean): HeroAttributeValue[] {
  return HERO_ATTRIBUTES.map((a) => ({ ...a, v: a.value(hero) }));
}

/** The hero's highest attribute (what the hero is best at); ties go to the first in HERO_ATTRIBUTES. */
export function dominantAttribute(hero: HeroBean): HeroAttributeValue {
  return heroAttributeValues(hero).reduce((best, a) => (a.v > best.v ? a : best));
}
