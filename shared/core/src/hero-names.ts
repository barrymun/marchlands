// (marchlands) Hero names (docs/features/hero-names.md): a first name from the culture of the state the hero comes
// from, with a real place of that state, a father's name, or both, each in the culture's own form ("Gero von Meissen",
// "Ugo di Guido", "Jitka Borivojova"). Plain spellings (A to Z), at most HERO_NAME_MAX characters. The lists live in
// this module of their own so they stay out of the client's bundle.

import { BALANCE } from '#/balance.ts';
import { Sex } from '#/constants.ts';
import { pick, type Rng } from '#/rng.ts';

/** The longest name a hero may have, generated or given by a rename. */
export const HERO_NAME_MAX = 20;

/** Share of the Inn's heroes who come from another state (travellers), and of those, from a neighbouring one. */
const TRAVELLER_SHARE = 0.2;
const NEIGHBOUR_SHARE = 0.75;
/** How a name is built: with a place, with a father's name, with both, or the first name alone (the rest). */
const WITH_PLACE = 0.45;
const WITH_FATHER = 0.35;
const WITH_BOTH = 0.1;
/** Tries at a name nobody else in the city has, before taking a repeat. */
const TRIES = 10;

interface Culture {
  men: readonly string[];
  women: readonly string[];
  /** the word before a place */
  from: 'von' | 'de' | 'z' | 'da';
  /** a father's name in the culture's form, for a son or a daughter; null where the culture has none */
  father: (name: string, sex: Sex) => string | null;
}

/** A list of names or places, one word each. */
const words = (list: string) => list.trim().split(/\s+/);

const German = (name: string) => (/[sxz]$/.test(name) ? null : `${name}s`);

/** The cultures a state's heroes are named in. */
const CultureId = {
  FRISIAN: 'frisian',
  SAXON: 'saxon',
  FRANCONIAN: 'franconian',
  LOTHARINGIAN: 'lotharingian',
  CZECH: 'czech',
  CARINTHIAN: 'carinthian',
  ITALIAN: 'italian',
} as const;
type CultureId = (typeof CultureId)[keyof typeof CultureId];

const CULTURES = {
  [CultureId.FRISIAN]: {
    men: words(`
      Radbod Popko Sicco Ubbo Haio Tjaard Eppo Wigbold Abbo Poppo Gerolf Ritsert Douwe Sjoerd Tjalling Wybren Hessel Jelle Gerbrand
      Feddo Hidde Lubbert Menno Okko Edzard Enno Imel Folkert Rienk Tako Wiard Wilke Ulbe Sibrand Keno Tamme Snelger Bauke Reinold
      Liudger
    `),
    women: words(`
      Ymke Foelke Tjetske Ebel Theda Wendela Rixt Hylck Teetje Gerske Aafke Sjoukje Doutzen Jeltje Hiske Fokje Ritske Tetta Ida Imma
      Gela Ava Eelke Frouk Geertje Harmke Lutske Nynke Oedske Reinou Sytske Tryntje Wike Wobke Swaantje Ettje Anske Grietje Hebeltje
      Auck
    `),
    from: 'von',
    // Ubbo's son or daughter is an Ubbena, Radbod's a Radboda
    father: (name) => (/[aeiou]$/.test(name) ? `${name.slice(0, -1)}ena` : `${name}a`),
  },
  [CultureId.SAXON]: {
    men: words(`
      Liudolf Gero Wichmann Ekkehard Hermann Bernhard Thietmar Brun Widukind Ludger Meinwerk Bernward Dietrich Siegfried Wigger Egbert
      Amelung Lothar Ordulf Udo Gunzelin Werner Hoyer Wilhelm Albrecht Heinrich Wiprecht Thankmar Volkmar Esiko Dedo Hodo Billung Rikdag
      Erp Folkwin Unwan Hathagat Walbert Imad
    `),
    women: words(`
      Oda Hathui Mathilde Hathumod Gerberga Hrotsvit Eilika Gerburg Liutgard Adelheid Sophia Emma Frederuna Hadwig Imma Thiadhild Godila
      Gisla Bia Eilswind Reinhild Walburga Odilia Geva Ida Hazecha Gertrud Richardis Mechthild Wiltrud Swanhild Aldburg Bertha Irmgard
      Bertrada Christina Ermgard Hildeswith Wendelgard Fritheburg
    `),
    from: 'von',
    father: German,
  },
  [CultureId.FRANCONIAN]: {
    men: words(`
      Konrad Welf Arnulf Luitpold Eberhard Gebhard Burchard Ulrich Berthold Rudolf Ernst Wolfger Engelhard Adalbert Hartwig Megingoz
      Babo Rapoto Sighard Aribo Wernher Walther Diepold Friedrich Ludwig Heinrich Kuno Manegold Ruotger Siboto Wolfram Hartmann Reinmar
      Gottfried Albrecht Erchanger Bertolf Luitgar Otnand Gozbert
    `),
    women: words(`
      Gisela Kunigunde Imma Judith Uta Hedwig Agnes Irmengard Luitgard Reginlinde Hildegard Adelheid Richlinde Bertha Mechthild Wulfhild
      Gertrud Elisabeth Margarete Sophie Beatrix Liutswind Ermentrud Himiltrud Engelrad Haziga Richgard Kunizza Wiltrud Heilka Herrad
      Diemut Guta Petrissa Willibirg Tuta Ita Adala Gerbirg Swanhild
    `),
    from: 'von',
    father: German,
  },
  [CultureId.LOTHARINGIAN]: {
    men: words(`
      Gozelo Godefroy Thierry Rainier Renaud Hugues Baudouin Gerard Albert Arnoul Lambert Gislebert Conon Frederic Thibaut Simon Mathieu
      Ferry Henri Guillaume Othon Raoul Gautier Amaury Guy Humbert Amedee Rodolphe Wigeric Ricwin Adalberon Folmar Sigefroi Wenric
      Bertrand Etienne Girard Josselin Aymon Gaucher
    `),
    women: words(`
      Ermengarde Ida Beatrice Mathilde Adele Berthe Gisele Hedwige Richilde Agnes Ermesinde Clemence Alix Sibylle Helvide Ode Gertrude
      Yolande Isabelle Marguerite Alienor Emma Aelis Pernelle Petronille Laurette Hawide Hersende Ermentrude Cunegonde Guiburc Mahaut
      Blanche Aude Agathe Garsende Hodierne Ascelina Ricarde Odile
    `),
    from: 'de',
    // a son is Thierry fiz Gozelo; the period has no such form for a daughter, so she goes by a place
    father: (name, sex) => (sex === Sex.MALE ? `fiz ${name}` : null),
  },
  [CultureId.CZECH]: {
    men: words(`
      Borivoj Vratislav Bretislav Sobeslav Jaromir Oldrich Spytihnev Boleslav Vladislav Jaroslav Svatopluk Ctirad Hostivit Neklan
      Kresina Mstis Slavibor Radim Bohus Dobromir Zdislav Hroznata Kojata Bohuslav Drslav Hrabis Vsebor Smil Zbraslav Vitek Hynek Vok
      Budivoj Mutina Ratibor Domaslav Lutobor Bozej Prvoslav Unislav
    `),
    women: words(`
      Ludmila Dobrava Jitka Drahomira Bozena Svatava Dobroslava Zdislava Vojslava Mlada Pribyslava Strezislava Kazi Teta Libuse Radka
      Bohumila Milada Vlasta Ctislava Dobromila Jaromira Lubomira Bolemila Hodava Kunhuta Anezka Eliska Jaroslava Sobeslava Vratislava
      Mstislava Ratislava Bohdana Dobrislava Ludka Blazena Stanislava Mirka Velena
    `),
    from: 'z',
    // Borivoj's son is Borivojuv, his daughter Borivojova; Vitek's are Vitkuv and Vitkova
    father: (name, sex) => {
      if (/[aeiouy]$/.test(name)) return null;
      const stem = name.replace(/e([kc])$/, '$1');
      return sex === Sex.MALE ? `${stem}uv` : `${stem}ova`;
    },
  },
  [CultureId.CARINTHIAN]: {
    men: words(`
      Adalbero Markwart Engelbert Hartwig Bernhard Ulrich Heinrich Hermann Gottfried Hotimir Borut Gorazd Valuk Ingo Ratold Wezelin
      Aribo Otakar Liutold Konrad Starchand Pribislav Wilhelm Poppo Chazil Udalrich Gebhard Rapoto Sieghard Swiker Ortolf Pilgrim
      Wernhard Hertnit Wolfker Dietmar Wolfold Engelschalk Witigo Kazimir
    `),
    women: words(`
      Hemma Richardis Imma Beatrix Liutgard Hildegard Mechthild Kunigunde Gertrud Willibirg Adelheid Diemut Sophia Agnes Irmgard
      Elisabeth Uta Hadmut Tuta Wilburg Ita Gisela Engelburg Hiltrud Ellinburg Perchta Wezela Gerbirg Margareta Ottilie Reginhild
      Heilwig Ljuba Milena Dragomira Mira Slava Dobrina Bogdana Zdenka
    `),
    from: 'von',
    father: German,
  },
  [CultureId.ITALIAN]: {
    men: words(`
      Arduino Berengario Bonifacio Guido Ugo Ottone Lanfranco Adalberto Oberto Azzo Alberto Tedaldo Ranieri Guglielmo Corrado Enrico
      Federico Rolando Ubaldo Gerardo Ildebrando Pandolfo Landolfo Manfredi Ruggero Tancredi Uberto Ugolino Sigifredo Anselmo Ariberto
      Arnolfo Bernardo Goffredo Lotario Ezzelino Obizzo Rambaldo Teobaldo Opizo
    `),
    women: words(`
      Matilde Willa Berta Adelaide Beatrice Ermengarda Gisla Richilde Teodora Sofia Costanza Imilla Cunizza Adelasia Giuditta Agnese
      Bianca Gualdrada Ermellina Sibilla Jacopa Benedetta Agata Lucia Chiara Caterina Emilia Giovanna Margherita Isabella Orabile Elena
      Ottavia Aldruda Mabilia Tiburga Imelda Berengaria Altruda Contessa
    `),
    from: 'da',
    father: (name) => `di ${name}`,
  },
} satisfies Record<string, Culture>;

/** Each state's culture and places (real towns, castles and abbeys), by state: 0 Friesland … 15 Romagna. */
const STATES: readonly { culture: CultureId; places: readonly string[] }[] = [
  {
    culture: CultureId.FRISIAN,
    places: words(`
      Stavoren Dokkum Bolsward Franeker Harlingen Sneek Emden Norden Aurich Jever Groningen Workum Winsum Esens Leer Egmond Medemblik
      Hallum Wittmund Loppersum
    `),
  },
  {
    culture: CultureId.SAXON,
    places: words(`
      Magdeburg Goslar Hildesheim Halberstadt Bremen Verden Minden Paderborn Corvey Werla Luneburg Hamburg Stade Bardowick Soest
      Osnabruck Hameln Einbeck Celle Gifhorn Northeim Dassel
    `),
  },
  {
    culture: CultureId.SAXON,
    places: words(`
      Salzwedel Stendal Havelberg Arneburg Gardelegen Osterburg Werben Spandau Kopenick Lebus Seehausen Calbe Walbeck Plotzkau
      Ballenstedt Aschersleben Bernburg Zerbst Belzig Burg
    `),
  },
  {
    culture: CultureId.CZECH,
    places: words(`
      Vysehradu Prahy Kourimi Libice Melnika Zatce Litomeric Plzne Budce Chrudimi Caslavi Hradce Kladska Biliny Doksan Tetina Kolina
      Chebu Lokte Krivoklatu Teplic Pisku
    `),
  },
  {
    culture: CultureId.LOTHARINGIAN,
    places: words(`
      Bouillon Namur Louvain Liege Huy Dinant Aix Cambrai Brabant Hainaut Mons Limbourg Nivelles Gembloux Stavelot Malmedy Tongres
      Anvers Bruxelles Chiny Durbuy Looz
    `),
  },
  {
    culture: CultureId.FRANCONIAN,
    places: words(`
      Wurzburg Bamberg Nurnberg Fulda Mainz Worms Speyer Frankfurt Rothenburg Ansbach Hersfeld Henneberg Castell Wertheim Lorsch Hanau
      Coburg Kitzingen Ingelheim Oppenheim Abenberg Rieneck
    `),
  },
  {
    culture: CultureId.SAXON,
    places: words(`
      Erfurt Eisenach Gotha Arnstadt Jena Weimar Naumburg Merseburg Meissen Zeitz Muhlhausen Nordhausen Wartburg Schwarzburg Orlamunde
      Saalfeld Altenburg Gleichen Querfurt Wettin Kafernburg
    `),
  },
  {
    culture: CultureId.CZECH,
    places: words(`
      Olomouce Brna Znojma Velehradu Mikulcic Hodonina Breclavi Prerova Jihlavy Trebice Kromerize Opavy Litovle Bitova Pernstejna
      Boskovic Holasovic Vranova Lomnice Kunstatu
    `),
  },
  {
    culture: CultureId.LOTHARINGIAN,
    places: words(`
      Verdun Metz Toul Nancy Bar Epinal Remiremont Luneville Commercy Vaudemont Chatel Ligny Sarrebourg Thionville Longwy Briey Arlon
      Luxembourg Vianden Salm Dabo Lixheim
    `),
  },
  {
    culture: CultureId.FRANCONIAN,
    places: words(`
      Ulm Augsburg Konstanz Reichenau Zurich Basel Staufen Esslingen Rottweil Tubingen Zollern Kempten Lindau Memmingen Ravensburg
      Buchhorn Altdorf Calw Urach Teck Kyburg Lenzburg
    `),
  },
  {
    culture: CultureId.FRANCONIAN,
    places: words(`
      Regensburg Freising Passau Landshut Ingolstadt Andechs Scheyern Salzburg Straubing Eichstatt Wasserburg Kelheim Ebersberg
      Tegernsee Burghausen Moosburg Chiemsee Vohburg Sulzbach Bogen Neuburg Dachau
    `),
  },
  {
    culture: CultureId.CARINTHIAN,
    places: words(`
      Gurk Villach Klagenfurt Friesach Karnburg Spanheim Ossiach Millstatt Lavant Treffen Wolfsberg Bleiburg Griffen Eppenstein
      Ortenburg Sternberg Gmund Hollenburg Liebenfels Stein
    `),
  },
  {
    culture: CultureId.LOTHARINGIAN,
    places: words(`
      Besancon Vienne Lyon Arles Geneve Lausanne Grandson Salins Dole Gray Neuchatel Valence Grenoble Vesoul Joux Romont Gex Savoie
      Aoste Orange Embrun Die
    `),
  },
  {
    culture: CultureId.ITALIAN,
    places: words(`
      Milano Pavia Monza Como Bergamo Brescia Cremona Lodi Lecco Novara Vercelli Asti Torino Ivrea Varese Crema Mantova Verona Vicenza
      Padova Treviso Susa
    `),
  },
  {
    culture: CultureId.ITALIAN,
    places: words(`
      Lucca Pisa Firenze Siena Arezzo Volterra Pistoia Prato Fiesole Cortona Chiusi Massa Livorno Grosseto Populonia Poggibonsi Empoli
      Sovana Pescia Barga Carrara Pontremoli
    `),
  },
  {
    culture: CultureId.ITALIAN,
    places: words(`
      Ravenna Rimini Forli Faenza Imola Cesena Bologna Ferrara Modena Reggio Parma Bertinoro Comacchio Cervia Lugo Pesaro Fano Sarsina
      Meldola Urbino Piacenza Nonantola
    `),
  },
];

const stateAt = (state: number) => {
  const s = STATES[state];
  if (!s) throw new Error(`no state ${state}`);
  return s;
};

/**
 * The states that share a border with `state`, as BALANCE.stateGrid lays them out.
 * @internal
 */
export function neighbourStates(state: number): number[] {
  const n = BALANCE.stateGrid;
  const col = state % n;
  const row = Math.floor(state / n);
  const around: [number, number][] = [
    [col - 1, row],
    [col + 1, row],
    [col, row - 1],
    [col, row + 1],
  ];
  return around.filter(([c, r]) => c >= 0 && c < n && r >= 0 && r < n).map(([c, r]) => r * n + c);
}

/** Where a hero of an Inn in `state` comes from: mostly the state itself, now and then a traveller. */
function homeState(rng: Rng, state: number): number {
  if (rng.next() >= TRAVELLER_SHARE) return state;
  const near = neighbourStates(state);
  if (rng.next() < NEIGHBOUR_SHARE) return pick(rng, near);
  const others = STATES.map((_, i) => i).filter((i) => i !== state && !near.includes(i));
  return pick(rng, others);
}

/** "von Meissen", "de Verdun", "d'Arlon", "z Vysehradu", "da Lucca", "d'Asti". */
function fromPlace(culture: Culture, place: string): string {
  // eslint-disable-next-line marchlands/no-string-compare -- words of the names themselves: the particles that elide before a vowel
  return (culture.from === 'de' || culture.from === 'da') && /^[AEIOU]/.test(place) ? `d'${place}` : `${culture.from} ${place}`;
}

/** A name for a hero of `sex` from `state`: the pattern rolled, else a shorter one that fits HERO_NAME_MAX. */
function nameFrom(rng: Rng, state: number, sex: Sex): string {
  const { culture: id, places } = stateAt(state);
  const culture: Culture = CULTURES[id];
  const first = pick(rng, sex === Sex.MALE ? culture.men : culture.women);
  const place = fromPlace(culture, pick(rng, places));
  // the father is never the hero's namesake (no Tjalling Tjallinga)
  const fathers = culture.men.filter((m) => m !== first);
  const father = culture.father(pick(rng, fathers), sex);
  const r = rng.next();
  const withPlace = `${first} ${place}`;
  const withFather = father ? `${first} ${father}` : null;
  let tries: (string | null)[] = [];
  if (r < WITH_PLACE) tries = [withPlace, withFather];
  else if (r < WITH_PLACE + WITH_FATHER) tries = [withFather, withPlace];
  else if (r < WITH_PLACE + WITH_FATHER + WITH_BOTH) {
    // both fit only with a short place: one of those, if any
    const both = father ? places.map((p) => `${first} ${father} ${fromPlace(culture, p)}`).filter((n) => n.length <= HERO_NAME_MAX) : [];
    tries = [both.length ? pick(rng, both) : null, withPlace, withFather];
  }
  return tries.find((n): n is string => n != null && n.length <= HERO_NAME_MAX) ?? first;
}

export interface HeroName {
  name: string;
  sex: Sex;
}

/**
 * A new hero's name and sex (half are women) for a city or tile in `state`. With `travellers`, about 1 in 5 comes from
 * another state (mostly a neighbouring one) and is named after it; `taken` are names to avoid (the player's other
 * heroes, the Inn's other offers), tried TRIES times before a repeat is accepted.
 */
export function heroName(rng: Rng, state: number, opts: { travellers?: boolean; taken?: ReadonlySet<string> } = {}): HeroName {
  const sex = rng.next() < 0.5 ? Sex.MALE : Sex.FEMALE;
  const home = opts.travellers ? homeState(rng, state) : state;
  let name = nameFrom(rng, home, sex);
  for (let i = 1; i < TRIES && opts.taken?.has(name); i++) name = nameFrom(rng, home, sex);
  return { name, sex };
}

/**
 * Every first name, father's name and place of every culture, in the forms they take in a name, for the tests that check
 * them all (plain letters, nothing rude, short enough).
 * @internal
 */
export function heroNameParts(): { first: string[]; fathers: string[]; places: string[] } {
  const first: string[] = [];
  const fathers: string[] = [];
  const places: string[] = [];
  for (const c of Object.values(CULTURES) as Culture[]) {
    first.push(...c.men, ...c.women);
    for (const m of c.men) for (const sex of [Sex.MALE, Sex.FEMALE]) fathers.push(c.father(m, sex) ?? '');
  }
  for (const s of STATES) places.push(...s.places.map((p) => fromPlace(CULTURES[s.culture], p)));
  return { first, fathers: fathers.filter(Boolean), places };
}

/**
 * Each culture's men's and women's names, and each state's places, for the tests that count them.
 * @internal
 */
export const heroNameLists = () => ({
  cultures: CULTURES as Record<CultureId, Pick<Culture, 'men' | 'women'>>,
  states: STATES,
});
