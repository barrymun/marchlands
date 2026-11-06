// Draws the sprites that are made in code, replacing any placeholders:
//   npm run art:draw                    every drawn building, map tile, unit and resource icon
//   npm run art:draw -- cottage forest  only the ones named (file names as in client/web/src/lib/game-art.ts; `walls`)
// Buildings (tools/art/buildings/) go to client/web/src/assets/buildings/, valley tiles (tools/art/tiles.ts) to
// client/web/src/assets/tiles/, as <name>-<band>.png for each art band, the walls' frame pieces
// (tools/art/walls.ts) to client/web/src/assets/walls/, and the troops (tools/art/troops.ts) and fortifications
// (tools/art/fortifications.ts) to client/web/src/assets/units/ as <name>.png, the troop badges (tools/art/badges.ts)
// to client/web/src/assets/badges/, the resource icons (tools/art/resources.ts) to client/web/src/assets/resources/,
// the isometric city view's ground and walls (tools/art/city.ts) and its grand Town Hall
// (tools/art/buildings/town-hall.ts) to client/web/src/assets/city/, and the hero gear (tools/art/gear.ts: each piece at
// every gear level, the backdrops and the stars; `gear`) to client/web/src/assets/gear/, and the hero figure's layers
// (tools/art/figure.ts: the gear at every level for each sex, the skin tones and the hairstyles; `figure`) to
// client/web/src/assets/figure/.
// A building with moving parts (windmill sails, a water wheel) also gets a bare sprite without them,
// <name>-<band>-bare.png, which the animated town draws them turning over. Where each sprite's moving parts stand
// (its spots, tools/art/pixel.ts) goes to client/web/src/assets/spots.json, keyed by <folder>/<file>.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { BuildingType, Sex, SpotKind } from '@marchlands/core';

import { BADGE_DRAWINGS } from './badges.ts';
import { academy } from './buildings/academy.ts';
import { barracks } from './buildings/barracks.ts';
import { beaconTower } from './buildings/beacon-tower.ts';
import { cottage } from './buildings/cottage.ts';
import { embassy } from './buildings/embassy.ts';
import { farm } from './buildings/farm.ts';
import { feastingHall } from './buildings/feasting-hall.ts';
import { forge } from './buildings/forge.ts';
import { inn } from './buildings/inn.ts';
import { ironmine } from './buildings/ironmine.ts';
import { marketplace } from './buildings/marketplace.ts';
import { quarry } from './buildings/quarry.ts';
import { rallySpot } from './buildings/rally-spot.ts';
import { reliefStation } from './buildings/relief-station.ts';
import { sawmill } from './buildings/sawmill.ts';
import { stable } from './buildings/stable.ts';
import { grandTownHall, townHall } from './buildings/town-hall.ts';
import { warehouse } from './buildings/warehouse.ts';
import { workshop } from './buildings/workshop.ts';
import { CITY_GROUND_DRAWINGS, CITY_WALL_DRAWINGS } from './city.ts';
import { hair, skin } from './figure/body.ts';
import { FIGURE_GEAR } from './figure.ts';
import { FORT_DRAWINGS } from './fortifications.ts';
import { GEAR_BACKDROP, GEAR_DRAWINGS, GEAR_STAR, GEAR_TWINS } from './gear.ts';
import { IsoCanvas } from './iso.ts';
import { ITEM_DRAWINGS } from './items.ts';
import type { PixelCanvas, Spot } from './pixel.ts';
import { RESOURCE_DRAWINGS } from './resources.ts';
import { HISTORIC_DRAWINGS, TILE_DRAWINGS } from './tiles.ts';
import { TROOP_DRAWINGS } from './troops.ts';
import { WALL_DRAWINGS } from './walls.ts';
import {
  ART_BANDS,
  bareArtFile,
  buildingArtFile,
  cityGroundFile,
  cityWallFile,
  FIGURE_HAIR_COLOURS,
  FIGURE_HAIR_STYLES,
  FIGURE_SKIN_TONES,
  figureCapeFile,
  figureHairFile,
  figureHelmFile,
  figureLegsFile,
  figureSkinFile,
  figureUpperFile,
  GEAR_ART_LEVELS,
  GEAR_STAR_KINDS,
  GEAR_TWIN_PARTS,
  gearArtFile,
  gearBackdropFile,
  gearStarFile,
  gearTwinFile,
  grandTownHallFile,
  HISTORIC_ART_LEVELS,
  historicArtFile,
  itemArtFile,
  resourceArtFile,
  tileArtFile,
  troopBadgeFile,
  unitArtFile,
  WALL_PIECES,
  wallArtFile,
} from '../../client/web/src/lib/game-art.ts';
import type { CityGround, CityWallPiece, ResourceKey, WallBand } from '../../client/web/src/lib/game-art.ts';

const ASSETS = path.resolve(import.meta.dirname, '../../client/web/src/assets');

type Drawing = Record<number, () => IsoCanvas>;

/** Buildings drawn in code, by building type: a drawing for each art band. */
const BUILDINGS: Record<number, Drawing> = {
  [BuildingType.COTTAGE]: cottage,
  [BuildingType.TOWN_HALL]: townHall,
  [BuildingType.SAWMILL]: sawmill,
  [BuildingType.FARM]: farm,
  [BuildingType.QUARRY]: quarry,
  [BuildingType.IRONMINE]: ironmine,
  [BuildingType.ACADEMY]: academy,
  [BuildingType.BARRACKS]: barracks,
  [BuildingType.BEACON_TOWER]: beaconTower,
  [BuildingType.EMBASSY]: embassy,
  [BuildingType.FEASTING_HALL]: feastingHall,
  [BuildingType.FORGE]: forge,
  [BuildingType.INN]: inn,
  [BuildingType.MARKETPLACE]: marketplace,
  [BuildingType.RALLY_SPOT]: rallySpot,
  [BuildingType.RELIEF_STATION]: reliefStation,
  [BuildingType.STABLE]: stable,
  [BuildingType.WAREHOUSE]: warehouse,
  [BuildingType.WORKSHOP]: workshop,
};

const { positionals } = parseArgs({ allowPositionals: true });
const wanted = new Set(positionals);

/** Every sprite's spots by <folder>/<file>: what's in spots.json now, updated as sprites are drawn, written at the end. */
const SPOTS_FILE = path.join(ASSETS, 'spots.json');
const spots: Record<string, Spot[]> = fs.existsSync(SPOTS_FILE) ? JSON.parse(fs.readFileSync(SPOTS_FILE, 'utf8')) : {};
/** Parts the animated town draws moving over a bare sprite. */
const MOVING: ReadonlySet<SpotKind> = new Set([SpotKind.SAILS, SpotKind.WHEEL, SpotKind.SHEEP]);

/** Save a sprite and its spots; one with moving parts also gets a bare sprite drawn without them. */
function save(dir: string, file: string, drawing: () => PixelCanvas) {
  const c = drawing();
  fs.writeFileSync(path.join(ASSETS, dir, file), c.png());
  if (c.spots.length) spots[`${dir}/${file}`] = c.spots;
  else delete spots[`${dir}/${file}`];
  if (c.spots.some((s) => MOVING.has(s.k))) {
    IsoCanvas.bare = true;
    try {
      fs.writeFileSync(path.join(ASSETS, dir, bareArtFile(file)), drawing().png());
    } finally {
      IsoCanvas.bare = false;
    }
  }
}

function draw(drawings: Record<number, Drawing>, dir: string, fileOf: (type: number, band: number) => string) {
  fs.mkdirSync(path.join(ASSETS, dir), { recursive: true });
  for (const [type, bands] of Object.entries(drawings)) {
    const name = fileOf(Number(type), 1).replace(/-1\.png$/, '');
    if (wanted.size && !wanted.has(name)) continue;
    for (const { band } of ART_BANDS) save(dir, fileOf(Number(type), band), bands[band]);
    console.log(`drew ${dir}/${name} (${ART_BANDS.length} bands)`);
  }
}

draw(BUILDINGS, 'buildings', buildingArtFile);
draw(TILE_DRAWINGS, 'tiles', tileArtFile);

if (!wanted.size || wanted.has('historic')) {
  for (const level of HISTORIC_ART_LEVELS) save('tiles', historicArtFile(level), HISTORIC_DRAWINGS[level]);
  console.log(`drew tiles/historic (${HISTORIC_ART_LEVELS.length} levels)`);
}

if (!wanted.size || wanted.has('walls')) {
  fs.mkdirSync(path.join(ASSETS, 'walls'), { recursive: true });
  for (const { band } of ART_BANDS) for (const piece of WALL_PIECES) save('walls', wallArtFile(band, piece), () => WALL_DRAWINGS[piece](band));
  console.log(`drew walls (${WALL_PIECES.length} pieces × ${ART_BANDS.length} bands)`);
}

fs.mkdirSync(path.join(ASSETS, 'units'), { recursive: true });
for (const [type, drawing] of Object.entries({ ...TROOP_DRAWINGS, ...FORT_DRAWINGS })) {
  const file = unitArtFile(Number(type));
  if (wanted.size && !wanted.has(file.replace(/\.png$/, ''))) continue;
  fs.writeFileSync(path.join(ASSETS, 'units', file), drawing().png());
  console.log(`drew units/${file}`);
}

fs.mkdirSync(path.join(ASSETS, 'resources'), { recursive: true });
for (const [key, drawing] of Object.entries(RESOURCE_DRAWINGS) as [ResourceKey, () => PixelCanvas][]) {
  if (wanted.size && !wanted.has(key)) continue;
  fs.writeFileSync(path.join(ASSETS, 'resources', resourceArtFile(key)), drawing().png());
  console.log(`drew resources/${resourceArtFile(key)}`);
}

fs.mkdirSync(path.join(ASSETS, 'badges'), { recursive: true });
for (const [type, drawing] of Object.entries(BADGE_DRAWINGS)) {
  const file = troopBadgeFile(Number(type));
  if (wanted.size && !wanted.has(file.replace(/\.png$/, ''))) continue;
  fs.writeFileSync(path.join(ASSETS, 'badges', file), drawing().png());
  console.log(`drew badges/${file}`);
}

fs.mkdirSync(path.join(ASSETS, 'city'), { recursive: true });
for (const [name, drawing] of Object.entries(CITY_GROUND_DRAWINGS) as [CityGround, () => IsoCanvas][]) {
  if (wanted.size && !wanted.has(name) && !wanted.has('city')) continue;
  save('city', cityGroundFile(name), drawing);
  console.log(`drew city/${cityGroundFile(name)}`);
}
if (!wanted.size || wanted.has('city')) {
  for (const { band } of ART_BANDS)
    for (const [piece, drawing] of Object.entries(CITY_WALL_DRAWINGS) as [CityWallPiece, (band: WallBand) => IsoCanvas][])
      save('city', cityWallFile(band, piece), () => drawing(band as WallBand));
  console.log(`drew city walls (${Object.keys(CITY_WALL_DRAWINGS).length} pieces × ${ART_BANDS.length} bands)`);
  for (const { band } of ART_BANDS) save('city', grandTownHallFile(band), grandTownHall[band]);
  console.log(`drew city/town-hall (${ART_BANDS.length} bands)`);
}

if (!wanted.size || wanted.has('gear')) {
  fs.mkdirSync(path.join(ASSETS, 'gear'), { recursive: true });
  for (const [piece, drawing] of Object.entries(GEAR_DRAWINGS))
    for (const level of GEAR_ART_LEVELS) save('gear', gearArtFile(piece, level), () => drawing(level));
  // a piece whose part sways alone also gets its twins: without the part, and the part alone (no spots of their own)
  for (const [piece, twin] of Object.entries(GEAR_TWINS))
    for (const level of GEAR_ART_LEVELS)
      if ((spots[`gear/${gearArtFile(piece, level)}`] ?? []).some((s) => s.k === SpotKind.SWAY))
        for (const part of GEAR_TWIN_PARTS) fs.writeFileSync(path.join(ASSETS, 'gear', gearTwinFile(piece, level, part)), twin(level, part).png());
  for (const level of GEAR_ART_LEVELS) save('gear', gearBackdropFile(level), () => GEAR_BACKDROP(level));
  for (const kind of GEAR_STAR_KINDS) save('gear', gearStarFile(kind), () => GEAR_STAR(kind));
  console.log(`drew gear (${Object.keys(GEAR_DRAWINGS).join(', ')} × ${GEAR_ART_LEVELS.length} levels, backdrops, stars)`);
}

if (!wanted.size || wanted.has('figure')) {
  fs.mkdirSync(path.join(ASSETS, 'figure'), { recursive: true });
  const sexes = [Sex.MALE, Sex.FEMALE];
  for (const level of GEAR_ART_LEVELS) {
    save('figure', figureCapeFile(level), () => FIGURE_GEAR.cape(level));
    save('figure', figureHelmFile(level), () => FIGURE_GEAR.helm(level));
    for (const sex of sexes) {
      save('figure', figureLegsFile(sex, level), () => FIGURE_GEAR.legs(sex, level));
      save('figure', figureUpperFile(sex, level), () => FIGURE_GEAR.upper(sex, level));
    }
  }
  for (const sex of sexes) {
    for (const tone of FIGURE_SKIN_TONES) save('figure', figureSkinFile(sex, tone), () => skin(sex, tone));
    for (const style of FIGURE_HAIR_STYLES[sex])
      for (const colour of FIGURE_HAIR_COLOURS) save('figure', figureHairFile(style, colour), () => hair(style, colour));
  }
  console.log(`drew figure (cape, helm, legs and upper body × ${GEAR_ART_LEVELS.length} levels, skin tones, hairstyles)`);
}

fs.mkdirSync(path.join(ASSETS, 'items'), { recursive: true });
for (const [id, drawing] of Object.entries(ITEM_DRAWINGS)) {
  const file = itemArtFile(id);
  if (!file) throw new Error(`no file name for item ${id}`);
  if (wanted.size && !wanted.has('items') && !wanted.has(file.replace(/\.png$/, ''))) continue;
  fs.writeFileSync(path.join(ASSETS, 'items', file), drawing().png());
}
if (!wanted.size || wanted.has('items')) console.log(`drew items (${Object.keys(ITEM_DRAWINGS).length} icons)`);

fs.writeFileSync(SPOTS_FILE, JSON.stringify(Object.fromEntries(Object.entries(spots).sort(([a], [b]) => a.localeCompare(b)))) + '\n');
console.log(`wrote spots.json (${Object.keys(spots).length} sprites)`);
