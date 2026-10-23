import { describe, expect, it } from 'vitest';
import { HERO_NAME_MAX, heroName, heroNameLists, heroNameParts, neighbourStates, seededRng, Sex } from '#/index.ts';

const { cultures, states } = heroNameLists();
const firstWord = (name: string) => name.split(' ')[0] ?? '';
const sample = (n: number, state: number, opts: Parameters<typeof heroName>[2] = {}) => {
  const rng = seededRng(`names:${state}`);
  return Array.from({ length: n }, () => heroName(rng, state, opts));
};

describe(heroNameLists.name, () => {
  it('gives every culture at least 40 men and 40 women, none twice', () => {
    for (const [id, c] of Object.entries(cultures)) {
      expect(c.men.length, id).toBeGreaterThanOrEqual(40);
      expect(c.women.length, id).toBeGreaterThanOrEqual(40);
      expect(new Set([...c.men, ...c.women]).size, id).toBe(c.men.length + c.women.length);
    }
  });

  it('gives each of the 16 states a culture and at least 20 places, none twice', () => {
    expect(states).toHaveLength(16);
    for (const s of states) {
      expect(cultures[s.culture]).toBeDefined();
      expect(s.places.length).toBeGreaterThanOrEqual(20);
      expect(new Set(s.places).size).toBe(s.places.length);
    }
  });
});

describe(heroNameParts.name, () => {
  it('spells every part with plain letters, as one word or a word and a name', () => {
    const { first, fathers, places } = heroNameParts();
    for (const n of first) expect(n).toMatch(/^[A-Z][a-z]+$/);
    for (const n of [...fathers, ...places]) expect(n).toMatch(/^([a-z]+ |d')?[A-Z][a-z]+$/);
  });

  it("builds fathers' names in each culture's form", () => {
    const { fathers } = heroNameParts();
    // Frisian, German, Lotharingian (sons only), Czech (sons and daughters, Vitek losing its e) and Italian
    for (const f of ['Ubbena', 'Radboda', 'Liudolfs', 'fiz Gozelo', 'Borivojuv', 'Borivojova', 'Vitkuv', 'Vitkova', 'di Guido']) expect(fathers).toContain(f);
    // no German genitive on a name ending in s, x or z, and none for Czech names ending in a vowel
    expect(fathers.filter((f) => /[sxz]s$/.test(f))).toEqual([]);
    expect(fathers.some((f) => f.startsWith('Mutina'))).toBe(false);
  });

  it("puts each culture's word before a place, d' before a vowel in French and Italian", () => {
    const { places } = heroNameParts();
    for (const p of ['von Meissen', 'de Verdun', "d'Arlon", 'z Vysehradu', 'da Lucca', "d'Asti"]) expect(places).toContain(p);
    expect(places).not.toContain('de Arlon');
  });
});

describe(neighbourStates.name, () => {
  it('lists the states sharing a border on the 4 × 4 grid', () => {
    expect(neighbourStates(0).sort((a, b) => a - b)).toEqual([1, 4]);
    expect(neighbourStates(5).sort((a, b) => a - b)).toEqual([1, 4, 6, 9]);
    expect(neighbourStates(15).sort((a, b) => a - b)).toEqual([11, 14]);
  });
});

describe(heroName.name, () => {
  it('keeps every name within HERO_NAME_MAX and to the characters a rename allows', () => {
    for (let state = 0; state < 16; state++)
      for (const { name } of sample(300, state, { travellers: true })) {
        expect(name.length).toBeLessThanOrEqual(HERO_NAME_MAX);
        expect(name).toMatch(/^[\p{L}\p{N} _.'-]+$/u);
      }
  });

  it('makes about half the heroes women, with names to match', () => {
    const tuscany = cultures.italian;
    const heroes = sample(2000, 14);
    const women = heroes.filter((h) => h.sex === Sex.FEMALE);
    expect(women.length / heroes.length).toBeGreaterThan(0.45);
    expect(women.length / heroes.length).toBeLessThan(0.55);
    for (const h of heroes) expect(h.sex === Sex.FEMALE ? tuscany.women : tuscany.men).toContain(firstWord(h.name));
  });

  it("uses all the patterns: a place, a father's name, both (when short enough), and the first name alone", () => {
    const names = sample(2000, 14).map((h) => h.name);
    expect(names.some((n) => / d(?:a |')/.test(n) && !n.includes(' di '))).toBe(true);
    expect(names.some((n) => n.includes(' di ') && !/ d(?:a |')/.test(n))).toBe(true);
    expect(names.some((n) => !n.includes(' '))).toBe(true);
    // both, with a place short enough: rare, since few fit ("Udo Imads von Bremen", "Ugo di Azzo d'Ivrea")
    const both = Array.from({ length: 16 }, (_, state) => sample(2000, state))
      .flat()
      .filter((h) => /^\S+ (?:fiz |di )?\S+ (?:von |de |z |da |d')\S+$/.test(h.name) && !/^\S+ (?:von|de|z|da) /.test(h.name));
    expect(both.length).toBeGreaterThan(50);
  });

  it("never makes a hero their own father's namesake", () => {
    for (const { name } of sample(3000, 0)) {
      const [first = '', father = ''] = name.split(' ');
      expect(father).not.toBe(`${first}a`);
      expect(father).not.toBe(`${first.slice(0, -1)}ena`);
    }
  });

  it('names travellers, about 1 in 5, after another state, and nobody without them', () => {
    const italian = new Set([...cultures.italian.men, ...cultures.italian.women]);
    // Saxony (1) is far from the Italian states, so a traveller there is rarely one of theirs
    const saxon = new Set([...cultures.saxon.men, ...cultures.saxon.women]);
    expect(sample(1000, 14).every((h) => italian.has(firstWord(h.name)))).toBe(true);
    const away = sample(2000, 1, { travellers: true }).filter((h) => !saxon.has(firstWord(h.name))).length / 2000;
    expect(away).toBeGreaterThan(0.1);
    expect(away).toBeLessThan(0.25);
  });

  it('avoids the names it is given, while it can', () => {
    const first = heroName(seededRng('taken'), 14);
    const again = heroName(seededRng('taken'), 14, { taken: new Set([first.name]) });
    expect(again.name).not.toBe(first.name);
    expect(again.sex).toBe(first.sex);
  });

  it('gives the same name for the same seed', () => {
    expect(heroName(seededRng('same'), 3)).toEqual(heroName(seededRng('same'), 3));
  });
});
