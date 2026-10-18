// Draws the sprites that are made in code, replacing any placeholders:
//   npm run art:draw                    every drawn building, map tile, unit and resource icon
//   npm run art:draw -- cottage forest  only the ones named (file names as in client/web/src/lib/game-art.ts; `walls`)
// Buildings (tools/art/buildings/) go to client/web/src/assets/buildings/, valley tiles (tools/art/tiles.ts) to
// client/web/src/assets/tiles/, as <name>-<band>.png for each art band, the walls' frame pieces
// (tools/art/walls.ts) to client/web/src/assets/walls/, and the troops (tools/art/troops.ts) and fortifications
// (tools/art/fortifications.ts) to client/web/src/assets/units/ as <name>.png, and the resource icons
// (tools/art/resources.ts) to client/web/src/assets/resources/.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { BuildingType } from '@marchlands/core';

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
import { townHall } from './buildings/town-hall.ts';
import { warehouse } from './buildings/warehouse.ts';
import { workshop } from './buildings/workshop.ts';
import { FORT_DRAWINGS } from './fortifications.ts';
import type { IsoCanvas } from './iso.ts';
import type { PixelCanvas } from './pixel.ts';
import { RESOURCE_DRAWINGS } from './resources.ts';
import { TILE_DRAWINGS } from './tiles.ts';
import { TROOP_DRAWINGS } from './troops.ts';
import { WALL_DRAWINGS } from './walls.ts';
import { ART_BANDS, buildingArtFile, resourceArtFile, tileArtFile, unitArtFile, WALL_PIECES, wallArtFile } from '../../client/web/src/lib/game-art.ts';
import type { ResourceKey } from '../../client/web/src/lib/game-art.ts';

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

function draw(drawings: Record<number, Drawing>, dir: string, fileOf: (type: number, band: number) => string) {
  fs.mkdirSync(path.join(ASSETS, dir), { recursive: true });
  for (const [type, bands] of Object.entries(drawings)) {
    const name = fileOf(Number(type), 1).replace(/-1\.png$/, '');
    if (wanted.size && !wanted.has(name)) continue;
    for (const { band } of ART_BANDS) fs.writeFileSync(path.join(ASSETS, dir, fileOf(Number(type), band)), bands[band]().png());
    console.log(`drew ${dir}/${name} (${ART_BANDS.length} bands)`);
  }
}

draw(BUILDINGS, 'buildings', buildingArtFile);
draw(TILE_DRAWINGS, 'tiles', tileArtFile);

if (!wanted.size || wanted.has('walls')) {
  fs.mkdirSync(path.join(ASSETS, 'walls'), { recursive: true });
  for (const { band } of ART_BANDS)
    for (const piece of WALL_PIECES) fs.writeFileSync(path.join(ASSETS, 'walls', wallArtFile(band, piece)), WALL_DRAWINGS[piece](band).png());
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
