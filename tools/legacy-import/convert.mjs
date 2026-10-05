#!/usr/bin/env node
// Converts the legacy Spitfire MySQL dumps into data files used by evony-re.
//
//   node tools/legacy-import/convert.mjs <path-to-evony-private-server/DB>
//
// Outputs:
//   shared/core/src/data/legacy/{buildings,research,troops,items,quests}.json
//   db/seed/legacy-map-800.bin.gz   (640000 * [type:u8, level:u8], index = tile id)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readInserts, toObjects } from './mysql-dump.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dbDir = path.resolve(process.argv[2] ?? path.join(root, '../evony-private-server/DB'));
const configDump = path.join(dbDir, 'evony (3).sql');
const worldDump = path.join(dbDir, 's2 (1).sql');

const outData = path.join(root, 'shared/core/src/data/legacy');
const outSeed = path.join(root, 'db/seed');
fs.mkdirSync(outData, { recursive: true });
fs.mkdirSync(outSeed, { recursive: true });

/** "31,2|7,1" -> [{id:31, level:2}, {id:7, level:1}] ; "0,0" / "" -> [] */
function prereqs(s) {
  if (!s) return [];
  return s
    .split('|')
    .map((p) => p.split(',').map(Number))
    .filter(([id]) => id > 0)
    .map(([id, level]) => ({ id, level: level ?? 1 }));
}

/** "4,5,6,7" -> [4,5,6,7] ; "0" / "" -> [] */
function idList(s) {
  if (!s) return [];
  return String(s)
    .split(',')
    .map(Number)
    .filter((n) => n > 0);
}

const cost = (r) => ({ food: r.food, wood: r.wood, stone: r.stone, iron: r.iron, gold: r.gold });

const tables = {};
await readInserts(
  configDump,
  ['config_building', 'config_research', 'config_troops', 'config_items', 'config_quests'],
  (table, cols, rows) => {
    (tables[table] ??= []).push(...toObjects(cols, rows));
  },
);

const buildings = tables.config_building
  .map((r) => ({
    typeId: r.buildingid,
    level: r.level,
    buildTime: r.buildtime,
    cost: cost(r),
    requires: { buildings: prereqs(r.prereqbuilding), items: prereqs(r.prereqitem), techs: prereqs(r.prereqtech) },
    inside: r.inside,
    limit: r.blimit,
  }))
  .sort((a, b) => a.typeId - b.typeId || a.level - b.level);

const research = tables.config_research
  .map((r) => ({
    techId: r.researchid,
    level: r.level,
    buildTime: r.buildtime,
    cost: cost(r),
    requires: { buildings: prereqs(r.prereqbuilding), items: prereqs(r.prereqitem), techs: prereqs(r.prereqtech) },
  }))
  .sort((a, b) => a.techId - b.techId || a.level - b.level);

const troops = tables.config_troops
  .map((r) => ({
    troopId: r.troopid,
    buildTime: r.buildtime,
    population: r.population,
    cost: cost(r),
    inside: r.inside,
    requires: { buildings: prereqs(r.prereqbuilding), items: prereqs(r.prereqitem), techs: prereqs(r.prereqtech) },
    life: r.life,
    attack: r.attack,
    defense: r.defense,
    load: r.load,
    upkeep: r.movecost,
    speed: r.speed,
    range: r.range,
  }))
  .sort((a, b) => a.troopId - b.troopId);

// In the dump the combat/logistics columns (life..range) of ids 8, 9, 10 are rotated: they were
// entered in the order cavalry, cataphract, transporter while the ids (and the cost/prerequisite
// columns) follow defines.h: 8 transporter, 9 cavalry, 10 cataphract. Evidence: row 8 has load
// 100 / upkeep 18 (cavalry), row 10 has load 5000 / attack 10 (transporter). Rotate them back.
{
  const statKeys = ['life', 'attack', 'defense', 'load', 'upkeep', 'speed', 'range'];
  const byId = Object.fromEntries(troops.map((t) => [t.troopId, t]));
  const pick = (t) => Object.fromEntries(statKeys.map((k) => [k, t[k]]));
  const [s8, s9, s10] = [pick(byId[8]), pick(byId[9]), pick(byId[10])];
  if (s10.load === 5000) {
    Object.assign(byId[8], s10); // transporter
    Object.assign(byId[9], s8); // cavalry
    Object.assign(byId[10], s9); // cataphract
  }
}

// Some descriptions were double-encoded (UTF-8 read as latin1) in the dump.
const fixMojibake = (s) => (/[\u00c2-\u00e2][\u0080-\u00bf\u20ac\u2122]/.test(s) ? s.replace(/â€™/g, '\u2019').replace(/â€œ|â€\u009d/g, '"') : s);

const items = tables.config_items
  .map((r) => ({
    legacyId: r.id,
    id: r.name,
    name: fixMojibake(r.description),
    cost: r.cost,
    buyable: r.buyable === 1,
    canGamble: r.cangamble === 1,
    type: r.itemtype,
    dayLimit: r.daylimit,
    rarity: r.rarity,
  }))
  .sort((a, b) => a.legacyId - b.legacyId);

const quests = tables.config_quests
  .map((r) => ({
    id: r.id,
    mainId: r.mainId,
    isFinish: r.isFinish === 1,
    description: r.description,
    name: r.name,
    typeId: r.typeId,
    requires: {
      buildings: idList(r.prereqbuilding),
      items: idList(r.prereqitem),
      techs: idList(r.prereqtech),
      quests: idList(r.prereqquest),
    },
  }))
  .sort((a, b) => a.id - b.id);

const write = (name, data) => {
  fs.writeFileSync(path.join(outData, `${name}.json`), JSON.stringify(data, null, 1) + '\n');
  console.log(`${name}.json: ${data.length} rows`);
};
write('buildings', buildings);
write('research', research);
write('troops', troops);
write('items', items);
write('quests', quests);

// ---- world map ----
if (fs.existsSync(worldDump)) {
  const MAP = 800;
  const buf = Buffer.alloc(MAP * MAP * 2);
  // default: flat level 1 for any tile missing from the dump
  for (let i = 0; i < MAP * MAP; i++) {
    buf[i * 2] = 10;
    buf[i * 2 + 1] = 1;
  }
  let count = 0;
  await readInserts(worldDump, ['tiles'], (_t, cols, rows) => {
    const iId = cols.indexOf('id');
    const iType = cols.indexOf('type');
    const iLevel = cols.indexOf('level');
    for (const r of rows) {
      const id = r[iId];
      if (id < 0 || id >= MAP * MAP) continue;
      let type = r[iType];
      // castles in a dump belong to players we are not importing -> flat land
      if (type === 11) type = 10;
      buf[id * 2] = type;
      buf[id * 2 + 1] = Math.max(1, Math.min(10, r[iLevel]));
      count++;
    }
  });
  fs.writeFileSync(path.join(outSeed, 'legacy-map-800.bin.gz'), zlib.gzipSync(buf, { level: 9 }));
  console.log(`legacy-map-800.bin.gz: ${count} tiles`);
}
