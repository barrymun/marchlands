#!/usr/bin/env node
// Abandoning a city as a player does it (docs/features/abandoning-a-city.md): move what's wanted out first, with the other
// city's Feasting Hall full and then with a slot free; start the hour, call it off, start it again; and see what's left once
// the hour is up. Makes a temporary fx_ player with two cities: delete it with npm run delete-player when done.
//
// The hour is a real one, so by default this brings it forward, on its own temporary city only, through the database of the
// stack in this folder. --real waits it out instead, so nothing is brought forward. --prepare stops before the hour starts and
// prints the account, to look at the warnings in the browser.
//
//   API=http://localhost:3100 node tools/smoke/abandon.mjs [--real | --prepare]
// Needs an operator account (SMOKE_ADMIN listed in ADMIN_USERNAMES).

import { execFileSync } from 'node:child_process';
import { BALANCE, BuildingType, HeroStatus, Mission, TechType, TileType, TroopType } from '@marchlands/core';
import { signUpProof } from './proof.mjs';

const API = process.env.API ?? 'http://localhost:3000';
const base = `${API}/api/v1`;
const REAL = process.argv.includes('--real');
const PREPARE = process.argv.includes('--prepare');
const PASSWORD = 'secret123';
/** Titles by the cities they allow: this one allows the two the player will have, so the limit can be seen. */
const TWO_CITIES = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}
async function ok(token, method, path, body) {
  const r = await call(token, method, path, body);
  if (r.ok !== 1) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r).slice(0, 400)}`);
  return r.data;
}
function check(cond, msg) {
  console.log(`  ${cond ? 'ok ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
}
async function until(fn, msg, timeout = 180_000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`timeout: ${msg}`);
}

async function admin() {
  const user = process.env.SMOKE_ADMIN ?? 'smoke_admin';
  let r = await call(null, 'POST', '/auth/login', { username: user, password: PASSWORD });
  if (r.ok !== 1)
    r = await call(null, 'POST', '/auth/register', { username: user, email: `${user}@example.test`, password: PASSWORD, proof: await signUpProof(base) });
  if (!r.data?.isAdmin) throw new Error(`${user} must be an operator (ADMIN_USERNAMES)`);
  return r.data.token;
}

/** The buildings a city needs here; only its Feasting Hall's level differs, as that's what decides where a hero can go. */
const layout = (hall) => [
  [-1, BuildingType.TOWN_HALL, 8],
  [-2, BuildingType.WALLS, 5],
  [0, BuildingType.RALLY_SPOT, 10],
  [1, BuildingType.BARRACKS, 10],
  [2, BuildingType.ACADEMY, 8],
  [3, BuildingType.INN, 5],
  [4, BuildingType.FEASTING_HALL, hall],
  [5, BuildingType.MARKETPLACE, 3],
  [6, BuildingType.FORGE, 5],
  [7, BuildingType.WORKSHOP, 5],
  [8, BuildingType.STABLE, 5],
  [9, BuildingType.WAREHOUSE, 5],
];

async function setUp(gm, player, cityId, hall, troops) {
  for (const [positionId, typeId, level] of layout(hall))
    await ok(gm, 'PUT', `/admin/cities/${cityId}/buildings`, { playerId: player.id, positionId, typeId, level });
  await ok(gm, 'PUT', `/admin/cities/${cityId}/resources`, { playerId: player.id, gold: 2e6, food: 2e6, wood: 2e6, stone: 2e6, iron: 2e6 });
  await ok(gm, 'PUT', `/admin/cities/${cityId}/stats`, { playerId: player.id, population: 3000, troops });
}

const cityOf = (p, id) => ok(p.token, 'GET', `/cities/${id}`);
const heroesOf = async (p, id) => (await ok(p.token, 'GET', `/cities/${id}/heroes`)).heroes;
const armies = async (p) => (await ok(p.token, 'GET', '/armies')).self;
const castles = async (p) => (await ok(p.token, 'GET', '/player')).castles;
const armyHome = (p, id) => until(async () => !(await armies(p)).some((a) => a.armyId === id), `army ${id} done`);
const latestReport = (p, code) =>
  until(async () => (await ok(p.token, 'GET', '/reports?pageSize=50')).reports.find((r) => r.title.code === code), `report ${code}`);
const send = (p, from, target, mission, troops, extra = {}) =>
  ok(p.token, 'POST', `/cities/${from}/armies`, { targetTileId: target, mission, troops, ...extra });

/** Bring the hour forward, on this temporary city alone, leaving the worker to end it as it would have. */
function bringForward(cityId) {
  const now = Date.now() - 1;
  const sql = `update cities set abandon_at = ${now} where id = ${Number(cityId)} and abandon_at > 0; update timed_events set due_at = ${now} where city_id = ${Number(cityId)} and type = 'city.abandon';`;
  execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', `psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "${sql}"`], { stdio: 'pipe' });
}

async function main() {
  console.log(`abandoning a city against ${API}${REAL ? ', waiting out the real hour' : ''}`);
  const gm = await admin();
  const suffix = Math.random().toString(36).slice(2, 7);
  const username = `fx_ab_${suffix}`;
  const reg = await ok(null, 'POST', '/auth/register', { username, email: `${username}@example.test`, password: PASSWORD, proof: await signUpProof(base) });
  const created = await ok(reg.token, 'POST', '/player', { userName: `fxab${suffix}`, castleName: 'Keeper', flag: 'FX', sex: 1, zone: 6 });
  const p = { token: created.token, id: created.playerInfo.id, name: created.playerInfo.userName };
  const keeper = created.castles[0];
  await ok(gm, 'PUT', '/admin/players/flags', { playerName: p.name, beginner: false, title: TWO_CITIES });

  // ---- two cities, the keeper's Feasting Hall full ----
  await setUp(gm, p, keeper.id, 1, { carriage: 200 });
  const tiles = await ok(p.token, 'GET', `/map/search?x=${keeper.x}&y=${keeper.y}&radius=8&type=${TileType.FLAT}`);
  const land = tiles.find((t) => t.cityId == null && t.ownerCityId == null && Math.abs(t.x - keeper.x) + Math.abs(t.y - keeper.y) >= 3);
  const settlers = {
    food: BALANCE.newCityMinResource,
    wood: BALANCE.newCityMinResource,
    stone: BALANCE.newCityMinResource,
    iron: BALANCE.newCityMinResource,
    gold: 0,
  };
  // a settler army needs a hero, who becomes the new city's mayor
  await ok(gm, 'POST', `/admin/cities/${keeper.id}/heroes`, { playerId: p.id });
  const [settlerHero] = await heroesOf(p, keeper.id);
  await send(p, keeper.id, land.id, Mission.BUILD_CITY, { carriage: 100 }, { resources: settlers, heroId: settlerHero.id });
  const goner = await until(async () => (await castles(p)).find((c) => c.id !== keeper.id), 'second city founded');
  check(land.id === goner.fieldId, `the second city stands at (${land.x},${land.y})`);
  const limited = await call(p.token, 'POST', `/cities/${keeper.id}/armies`, {
    targetTileId: tiles.find((t) => t.id !== land.id).id,
    mission: Mission.BUILD_CITY,
    troops: { carriage: 100 },
    resources: settlers,
  });
  check(limited.error?.code === 'army.cityLimit', 'at the city limit: no third city');

  await setUp(gm, p, goner.id, 5, { militia: 3000, archer: 2000, carriage: 300, scouter: 100, lightCavalry: 2000 });
  await ok(gm, 'POST', `/admin/cities/${keeper.id}/heroes`, { playerId: p.id });
  const [resident] = await heroesOf(p, keeper.id);
  for (let i = 0; i < 4; i++) await ok(gm, 'POST', `/admin/cities/${goner.id}/heroes`, { playerId: p.id });
  const gonerHeroes = await heroesOf(p, goner.id);
  const mayor = gonerHeroes.find((h) => h.status === HeroStatus.MAYOR);
  const [strongest, second, third, last] = gonerHeroes.filter((h) => h !== mayor);
  check(mayor?.id === settlerHero.id, "the settlers' hero is its mayor");
  check((await ok(p.token, 'GET', `/cities/${keeper.id}/heroes`)).slots === 1, "the keeper's Feasting Hall is full (1 of 1)");

  // ---- moving out with the Feasting Hall full: the goods and troops stay, the hero comes back ----
  console.log('moving out, the Feasting Hall full');
  const keeperStart = await cityOf(p, keeper.id);
  const load = { food: 100_000, wood: 100_000, stone: 100_000, iron: 100_000, gold: 100_000 };
  const moved = await send(p, goner.id, keeperStart.fieldId, Mission.REINFORCE, { militia: 2000, carriage: 200 }, { resources: load, heroId: strongest.id });
  const backRoad = await until(async () => (await armies(p)).find((a) => a.armyId === moved.armyId && a.direction === 2), "the hero's army turns back");
  check(backRoad.heroId === strongest.id, 'the hero is on the way back to the city being left');
  const landed = await cityOf(p, keeper.id);
  check(
    landed.troop.militia === (keeperStart.troop.militia ?? 0) + 2000 && landed.troop.carriage === keeperStart.troop.carriage + 200,
    'the troops and carriages moved in for good',
  );
  check(
    landed.resource.gold >= keeperStart.resource.gold + 100_000 && landed.resource.iron.amount >= keeperStart.resource.iron.amount + 100_000,
    'the goods all arrived',
  );
  const movement = await ok(p.token, 'GET', `/reports/${(await latestReport(p, 'report.title.reinforcementArrived')).id}`);
  check(movement.content.movement?.heroReturned === true, 'the report says the hero went back');
  await armyHome(p, moved.armyId);
  const backHome = (await heroesOf(p, goner.id)).find((h) => h.id === strongest.id);
  check(backHome?.status === HeroStatus.IDLE, 'the hero is back in the city being left, so would be lost with it');

  // ---- a transport's carriages go home again; a reinforcement's stay ----
  const before = (await cityOf(p, goner.id)).troop.carriage;
  const transport = await send(
    p,
    goner.id,
    keeperStart.fieldId,
    Mission.TRANSPORT,
    { carriage: 50 },
    { resources: { gold: 1000, food: 0, wood: 0, stone: 0, iron: 0 } },
  );
  await armyHome(p, transport.armyId);
  check((await cityOf(p, goner.id)).troop.carriage === before, "a transport's carriages come home to the city being left");

  // ---- a slot free: the hero moves ----
  console.log('moving out, a slot free');
  await ok(p.token, 'POST', `/heroes/${resident.id}/fire`);
  const level = backHome.level;
  const heroMove = await send(p, goner.id, keeperStart.fieldId, Mission.REINFORCE, { militia: 100 }, { heroId: strongest.id });
  await armyHome(p, heroMove.armyId);
  const moverNow = (await heroesOf(p, keeper.id)).find((h) => h.id === strongest.id);
  check(moverNow?.level === level && moverNow.status === HeroStatus.IDLE, 'with a slot free the hero moves in, as they were');
  check(!(await heroesOf(p, goner.id)).some((h) => h.id === strongest.id), 'and is no longer in the city being left');

  // a valley held from the city, a hero with its garrison
  const valleys = await ok(p.token, 'GET', `/map/search?x=${goner.x}&y=${goner.y}&radius=10&type=${TileType.GRASS}`);
  const valley = valleys.find((t) => t.level === 1 && t.ownerCityId == null);
  await send(p, goner.id, valley.id, Mission.ATTACK, { lightCavalry: 1000 }, { heroId: third.id });
  await until(async () => (await cityOf(p, goner.id)).fields.some((f) => f.id === valley.id), 'valley occupied');
  check(true, 'a valley occupied');

  // what the warning has to show: left in the city on purpose
  let tech = { ok: 0 };
  for (const t of [...Object.values(TechType)]) {
    tech = await call(p.token, 'POST', `/cities/${goner.id}/research`, { techId: t });
    if (tech.ok === 1) break;
  }
  const order = await call(p.token, 'POST', `/cities/${goner.id}/market/orders`, { resType: 1, side: 1, amount: 1000, price: 99 });
  const queue = await call(p.token, 'POST', `/cities/${goner.id}/troops/train`, { troopId: TroopType.WARRIOR, count: 500, positionId: 1 });
  check(tech.ok === 1 && order.ok === 1 && queue.ok === 1, 'research, a market order and a training queue left running');
  check((await ok(p.token, 'GET', `/cities/${goner.id}/research`)).researchingIds?.length === 1, 'the research is under way');
  check((await ok(p.token, 'GET', '/market/orders/mine')).length === 1, 'the order is on the book');

  if (PREPARE) {
    // a third city, to share between, with a slot for its hero
    await ok(gm, 'PUT', '/admin/players/flags', { playerName: p.name, title: TWO_CITIES + 1 });
    await ok(gm, 'PUT', `/admin/cities/${keeper.id}/buildings`, { playerId: p.id, positionId: 4, typeId: BuildingType.FEASTING_HALL, level: 2 });
    await ok(gm, 'POST', `/admin/cities/${keeper.id}/heroes`, { playerId: p.id });
    const founder = (await heroesOf(p, keeper.id)).find((h) => h.id !== strongest.id);
    await send(
      p,
      keeper.id,
      tiles.find((t) => t.id !== land.id && t.cityId == null).id,
      Mission.BUILD_CITY,
      { carriage: 100 },
      { resources: settlers, heroId: founder.id },
    );
    await until(async () => (await castles(p)).length === 3, 'third city founded');
    console.log(`\nprepared: account ${username}, keeper ${keeper.id}, leaving ${goner.id}. Delete it with npm run delete-player when done.`);
    return;
  }

  // ---- the hour: start, refusals, call off, start again ----
  console.log('the hour');
  const prestige = (await ok(p.token, 'GET', '/player')).playerInfo.prestige;
  const started = await ok(p.token, 'POST', `/cities/${goner.id}/abandon`);
  const inMinutes = (started.abandonAt - Date.now()) / 60_000;
  check(inMinutes > 59 && inMinutes <= 60, `it takes a real hour, whatever the game speed (${inMinutes.toFixed(1)} minutes)`);
  check((await cityOf(p, goner.id)).abandonAt === started.abandonAt, 'the city says so');
  check((await call(p.token, 'POST', `/cities/${goner.id}/abandon`)).error?.code === 'city.abandonAlready', 'starting it twice is refused');
  check((await call(p.token, 'POST', `/cities/${keeper.id}/abandon`)).error?.code === 'city.abandonKeepRegular', 'the only other regular city cannot go too');
  await ok(p.token, 'DELETE', `/cities/${goner.id}/abandon`);
  check((await cityOf(p, goner.id)).abandonAt === 0, 'it can be called off');
  check((await call(p.token, 'DELETE', `/cities/${goner.id}/abandon`)).error?.code === 'city.abandonNotRunning', 'calling off nothing is refused');
  // on its way when the hour starts: it turns home, whenever it lands, with everything it left with
  const keeperSends = await send(p, keeper.id, goner.fieldId, Mission.REINFORCE, { militia: 50 });
  const restarted = await ok(p.token, 'POST', `/cities/${goner.id}/abandon`);
  const refused = await call(p.token, 'POST', `/cities/${keeper.id}/armies`, {
    targetTileId: goner.fieldId,
    mission: Mission.REINFORCE,
    troops: { militia: 10 },
  });
  check(refused.error?.code === 'army.destinationAbandoning', 'no army can be sent to it during the hour');
  const refusedTransport = await call(p.token, 'POST', `/cities/${keeper.id}/armies`, {
    targetTileId: goner.fieldId,
    mission: Mission.TRANSPORT,
    troops: { carriage: 1 },
    resources: { gold: 1, food: 0, wood: 0, stone: 0, iron: 0 },
  });
  check(refusedTransport.error?.code === 'army.destinationAbandoning', 'nor a transport');

  const during = await call(p.token, 'POST', `/cities/${keeper.id}/armies`, {
    targetTileId: tiles.find((t) => t.id !== land.id).id,
    mission: Mission.BUILD_CITY,
    troops: { carriage: 100 },
    resources: settlers,
  });
  check(during.error?.code === 'army.cityLimit', 'it still counts against the city limit during the hour');

  // armies on the road when it ends: the leaving city's are lost, the keeper's are safe
  const homeNow = await cityOf(p, keeper.id);
  const homeHeroes = await heroesOf(p, keeper.id);
  const home = { gold: homeNow.resource.gold, iron: homeNow.resource.iron.amount, militia: homeNow.troop.militia, carriage: homeNow.troop.carriage };
  check(home.militia > 0, 'the keeper has what moved in');
  const onRoad = await send(p, goner.id, keeperStart.fieldId, Mission.REINFORCE, { archer: 100 }, { heroId: second.id });

  // ---- moving it all out at once ----
  const notRunning = await call(p.token, 'POST', `/cities/${keeper.id}/abandon/move-out`, { targetCityIds: [goner.id] });
  check(notRunning.error?.code === 'city.moveOutNotAbandoning', 'a city not being abandoned cannot be moved out');
  const toItself = await call(p.token, 'POST', `/cities/${goner.id}/abandon/move-out`, { targetCityIds: [goner.id] });
  check(toItself.error?.code === 'city.moveOutTarget', 'a city cannot move out to itself');
  // a hero chosen moves at once, the mayor too, given a free slot
  const noSlot = await call(p.token, 'POST', `/cities/${goner.id}/abandon/move-out`, { heroes: [{ heroId: mayor.id, cityId: keeper.id }] });
  check(noSlot.error?.code === 'hero.noVacancy', 'a hero cannot move out to a full Feasting Hall');
  await ok(gm, 'PUT', `/admin/cities/${keeper.id}/buildings`, { playerId: p.id, positionId: 4, typeId: BuildingType.FEASTING_HALL, level: 2 });
  await ok(p.token, 'POST', `/cities/${goner.id}/abandon/move-out`, { heroes: [{ heroId: mayor.id, cityId: keeper.id }] });
  check((await heroesOf(p, keeper.id)).find((h) => h.id === mayor.id)?.status === HeroStatus.IDLE, 'a hero chosen moves at once, even the mayor');
  check(!(await heroesOf(p, goner.id)).some((h) => h.id === mayor.id), 'and is no longer in the city');

  const full = await cityOf(p, goner.id);
  const keeperBefore = await cityOf(p, keeper.id);
  await ok(p.token, 'POST', `/cities/${goner.id}/abandon/move-out`, { targetCityIds: [keeper.id] });
  const emptied = await cityOf(p, goner.id);
  check(
    Object.values(emptied.troop).every((n) => n === 0),
    'moved out at once: no troops left',
  );
  check(emptied.resource.gold < 10 && emptied.resource.iron.amount < 10, 'and no resources');
  check(emptied.movedOut === true, 'the city says it was moved out');
  const keeperAfter = await cityOf(p, keeper.id);
  check(keeperAfter.troop.archer === (keeperBefore.troop.archer ?? 0) + full.troop.archer, 'the troops are in the keeper at once');
  check(keeperAfter.resource.gold >= keeperBefore.resource.gold + full.resource.gold - 1, 'and the resources');
  home.gold = keeperAfter.resource.gold;
  home.iron = keeperAfter.resource.iron.amount;
  home.militia = keeperAfter.troop.militia;
  home.carriage = keeperAfter.troop.carriage;

  if (REAL) {
    console.log(`  waiting out the hour, until ${new Date(restarted.abandonAt).toISOString()}`);
    await sleep(Math.max(0, restarted.abandonAt - Date.now()));
  } else bringForward(goner.id);

  // ---- the hour is up ----
  console.log('the hour is up');
  await until(async () => !(await castles(p)).some((c) => c.id === goner.id), 'the city gone', REAL ? 600_000 : 60_000);
  check(Date.now() >= restarted.abandonAt || !REAL, REAL ? 'not a moment before the hour' : 'gone once the hour was brought forward');
  const gone = await call(p.token, 'GET', `/cities/${goner.id}`);
  check(gone.ok !== 1, 'the city no longer answers');
  const tile = await ok(p.token, 'GET', `/map/tiles/${goner.fieldId}`);
  check(tile.type === TileType.FLAT && !tile.cityId, 'the tile is flat land');
  const freed = await ok(p.token, 'GET', `/map/tiles/${valley.id}`);
  check(!freed.ownerCityId && !freed.ownerPlayerId, 'the valley is free again');
  const afterHeroes = await heroesOf(p, keeper.id);
  check(
    afterHeroes.some((h) => h.id === strongest.id),
    'the hero moved out is safe',
  );
  check(
    afterHeroes.some((h) => h.id === mayor.id),
    'and so is the mayor moved out',
  );
  check(afterHeroes.length === homeHeroes.length + 1, 'and the keeper lost no hero');
  const report = await ok(p.token, 'GET', `/reports/${(await latestReport(p, 'report.title.cityAbandoned')).id}`);
  check(report.content.text?.code === 'report.cityAbandoned', 'a report says the city is gone');
  for (const h of [second, third, last]) {
    const asked = await call(p.token, 'POST', `/heroes/${h.id}/fire`);
    check(asked.ok !== 1 && asked.error?.code === 'common.heroNotFound', `hero ${h.name}, left behind, is gone (${asked.error?.code})`);
  }
  const rest = await armies(p);
  // brought forward, both armies are still on the road when it ends; after a real hour they have long since arrived
  if (!REAL) check(!rest.some((a) => a.armyId === onRoad.armyId), "the leaving city's army on the road is lost with it");
  const keeperArmy = rest.find((a) => a.armyId === keeperSends.armyId);
  if (!REAL) check(keeperArmy?.direction === 2, "the keeper's army heading there turns home");
  if (keeperArmy) await armyHome(p, keeperArmy.armyId);

  const finalCity = await cityOf(p, keeper.id);
  check(finalCity.troop.militia === home.militia + 50, 'the keeper has every militia it had, the army it sent there back home');
  check(finalCity.troop.carriage === home.carriage, 'and every carriage');
  check(finalCity.resource.gold >= home.gold && finalCity.resource.iron.amount >= home.iron, 'and its goods');
  check(!(await ok(p.token, 'GET', '/market/orders/mine')).length, 'the market order is gone');
  const info = (await ok(p.token, 'GET', '/player')).playerInfo;
  // what finished during the hour earns its prestige as usual: nothing is taken back, the city never having been captured
  check(info.prestige >= prestige, `no prestige taken back (${prestige} to ${info.prestige}), the city never having been captured`);
  check(info.titleId === TWO_CITIES, 'the title unchanged');
  check((await castles(p)).length === 1, 'one city left');
  check((await ok(p.token, 'GET', `/cities/${keeper.id}/research`)).researchingIds?.length === 0, 'the research running there was cancelled');
  const settled = await send(
    p,
    keeper.id,
    tiles.find((t) => t.id !== land.id && t.cityId == null).id,
    Mission.BUILD_CITY,
    { carriage: 100 },
    { resources: settlers, heroId: strongest.id },
  );
  check(settled.armyId > 0, 'the slot is free: a new city can be settled');
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  console.log(`account ${username}: delete it with npm run delete-player -- ${username} --yes`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
