import { describe, expect, it } from 'vitest';
import { BuffId, GameError, msg, type BuffState, type Message } from '@marchlands/core';
import {
  activeBuff,
  addPrestige,
  assertClean,
  assertResources,
  cleanName,
  escapeHtml,
  gainResources,
  itemCount,
  spendGold,
  spendResources,
  type CityRow,
  type PlayerRow,
} from '../src/index.ts';

const city = (res: Partial<Record<'gold' | 'food' | 'wood' | 'stone' | 'iron', number>> = {}) =>
  ({ gold: 0, food: 0, wood: 0, stone: 0, iron: 0, ...res }) as CityRow;

const player = (fields: Partial<PlayerRow>) => ({ prestige: 0, items: {}, buffs: [], ...fields }) as PlayerRow;

/** The message `fn` was refused with (and its legacy code). */
function refusal(fn: () => unknown): { msg: Message; code: number } {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    return { msg: (err as GameError).msg, code: (err as GameError).code };
  }
  return expect.unreachable('expected a refusal');
}

describe(assertResources.name, () => {
  it('passes when the city has enough of everything asked for', () => {
    expect(() => assertResources(city({ food: 10, wood: 5 }), { food: 10, wood: 5 })).not.toThrow();
    expect(() => assertResources(city(), {})).not.toThrow();
  });

  it('refuses when anything is short, with the given message and code', () => {
    expect(refusal(() => assertResources(city({ food: 10 }), { food: 11 }))).toEqual({ msg: msg('common.notEnoughResources'), code: -1 });
    expect(refusal(() => assertResources(city({ food: 10 }), { gold: 1 }, msg('common.notEnoughGold'), -7))).toEqual({
      msg: msg('common.notEnoughGold'),
      code: -7,
    });
  });
});

describe(spendResources.name, () => {
  it('takes the cost from the city', () => {
    const c = city({ gold: 5, food: 10, wood: 7 });
    spendResources(c, { food: 4, wood: 7 });
    expect(c).toMatchObject({ gold: 5, food: 6, wood: 0, stone: 0, iron: 0 });
  });

  it('takes nothing when it cannot pay it all', () => {
    const c = city({ food: 10, wood: 1 });
    expect(refusal(() => spendResources(c, { food: 4, wood: 2 })).msg).toEqual(msg('common.notEnoughResources'));
    expect(c).toMatchObject({ food: 10, wood: 1 });
  });
});

describe(gainResources.name, () => {
  it('adds resources (times `mult`), never going below zero, ignoring storage', () => {
    const c = city({ food: 10, wood: 3 });
    gainResources(c, { food: 5, gold: 1_000_000_000 });
    expect(c).toMatchObject({ food: 15, gold: 1_000_000_000 });
    gainResources(c, { food: 2, wood: 2 }, -3);
    expect(c).toMatchObject({ food: 9, wood: 0 });
  });
});

describe(addPrestige.name, () => {
  it('adds prestige between 0 and 2,100,000,000', () => {
    const p = player({ prestige: 100 });
    addPrestige(p, 50);
    expect(p.prestige).toBe(150);
    addPrestige(p, -1000);
    expect(p.prestige).toBe(0);
    addPrestige(p, 3_000_000_000);
    expect(p.prestige).toBe(2_100_000_000);
  });
});

describe('itemCount', () => {
  it('is how many of an item the player holds, 0 for none', () => {
    const p = player({ items: { a: 3 } });
    expect(itemCount(p, 'a')).toBe(3);
    expect(itemCount(p, 'b')).toBe(0);
  });
});

describe(spendGold.name, () => {
  it("takes the gold from the city's", () => {
    const c = city({ gold: 100 });
    spendGold(c, 40);
    expect(c.gold).toBe(60);
    spendGold(c, 60);
    expect(c.gold).toBe(0);
  });

  it('does nothing for no gold', () => {
    const c = city({ gold: 0 });
    spendGold(c, 0);
    spendGold(c, -5);
    expect(c.gold).toBe(0);
  });

  it('refuses when the city has too little, naming the amount rounded up', () => {
    const c = city({ gold: 10 });
    expect(refusal(() => spendGold(c, 10.2))).toEqual({ msg: msg('common.notEnoughGoldFor', { amount: 11 }), code: -99 });
    expect(c.gold).toBe(10);
  });
});

describe('activeBuff', () => {
  const buff = (id: BuffState['id'], endTime: number): BuffState => ({ id, desc: msg('buff.truce'), endTime });

  it('finds a buff that has not ended yet', () => {
    const p = player({ buffs: [buff(BuffId.ATTACK, 100), buff(BuffId.TRUCE, 200)] });
    expect(activeBuff(p, BuffId.TRUCE, 150)).toEqual(buff(BuffId.TRUCE, 200));
    expect(activeBuff(p, BuffId.ATTACK, 99)).toEqual(buff(BuffId.ATTACK, 100));
  });

  it('ignores one that has ended (its end time included) or is missing', () => {
    const p = player({ buffs: [buff(BuffId.ATTACK, 100)] });
    expect(activeBuff(p, BuffId.ATTACK, 100)).toBeUndefined();
    expect(activeBuff(p, BuffId.DEFENSE, 0)).toBeUndefined();
  });
});

describe(cleanName.name, () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Sir   Lancelot \t of  Camelot ', 1, 40)).toBe('Sir Lancelot of Camelot');
    expect(cleanName(42, 1, 10)).toBe('42');
  });

  it("accepts letters of any script, digits and _ . ' -", () => {
    expect(cleanName("O'Brien_the-2nd.", 1, 20)).toBe("O'Brien_the-2nd.");
    expect(cleanName('Ærøskøbing', 1, 20)).toBe('Ærøskøbing');
    expect(cleanName('東京', 1, 20)).toBe('東京');
  });

  it('refuses a name too short or too long (after trimming), saying what is named', () => {
    const what = msg('common.cityName');
    expect(refusal(() => cleanName('  ab  ', 3, 10, what))).toEqual({ msg: msg('common.nameLength', { what, min: 3, max: 10 }), code: -87 });
    expect(refusal(() => cleanName('abcdefghijk', 3, 10)).msg).toEqual(msg('common.nameLength', { what: msg('common.name'), min: 3, max: 10 }));
    expect(refusal(() => cleanName(null, 1, 10)).msg.code).toBe('common.nameLength');
    expect(cleanName('abc', 3, 3)).toBe('abc');
  });

  it('refuses other characters', () => {
    for (const bad of ['<b>', 'a;b', 'emoji 🙂', 'a/b', 'a"b']) {
      expect(refusal(() => cleanName(bad, 1, 20, msg('common.heroName')))).toEqual({
        msg: msg('common.nameInvalid', { what: msg('common.heroName') }),
        code: -87,
      });
    }
  });
});

describe(assertClean.name, () => {
  it('refuses a name containing a banned word, in any case', () => {
    expect(refusal(() => assertClean('BigShitTown'))).toEqual({ msg: msg('common.nameNotAllowed'), code: -99 });
    expect(refusal(() => assertClean('fuck')).msg).toEqual(msg('common.nameNotAllowed'));
  });

  it('accepts other names', () => {
    expect(() => assertClean('Camelot')).not.toThrow();
  });
});

describe(escapeHtml.name, () => {
  it('escapes the characters HTML gives meaning to', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });

  it('leaves other text alone, and escapes an ampersand once', () => {
    expect(escapeHtml('plain text')).toBe('plain text');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});
