#!/usr/bin/env node
// PvP switched off, end to end, played as players do against a stack with FEATURE_PVP=false: what another player holds
// can't be attacked or scouted by any route, and the map's own cities and free valleys still can. Needs an operator
// account (SMOKE_ADMIN listed in ADMIN_USERNAMES) and a fast GAME_SPEED (60 or more). It makes fx_pvp_… accounts and
// deletes nothing: npm run delete-player afterwards.
//   API=http://localhost:3100 SMOKE_ADMIN=fx_smoke_op node tools/smoke/pvp-off.mjs

import { signUpProof } from './proof.mjs';

const API = process.env.API ?? 'http://localhost:3000';
const base = `${API}/api/v1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FOREST = 1;
const GRASS = 5;
const NPC = 12;
const ATTACK = 5;
const SCOUT = 3;
const TRANSPORT = 1;
const TRUCE = 'player.peace.1';
const PVP_DISABLED = 'army.pvpDisabled';
const suffix = Math.random().toString(36).slice(2, 7);
let failures = 0;

async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
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

async function operator() {
  const user = process.env.SMOKE_ADMIN ?? 'fx_smoke_op';
  let r = await call(null, 'POST', '/auth/login', { username: user, password: 'secret123' });
  if (r.ok !== 1)
    r = await call(null, 'POST', '/auth/register', { username: user, email: `${user}@example.test`, password: 'secret123', proof: await signUpProof(base) });
  if (!r.data?.isAdmin) throw new Error(`${user} must be an operator (ADMIN_USERNAMES)`);
  return r.data.token;
}

async function newPlayer(name) {
  const username = `fx_pvp_${name}_${suffix}`;
  const reg = await ok(null, 'POST', '/auth/register', { username, email: `${username}@example.test`, password: 'secret123', proof: await signUpProof(base) });
  const c = await ok(reg.token, 'POST', '/player', { userName: `Fxpvp${name}${suffix}`, castleName: `Fen ${name}`, flag: 'FX', sex: 0, zone: 6 });
  return { token: c.token, id: c.playerInfo.id, name: c.playerInfo.userName, city: c.castles[0] };
}

/** A city ready for war, by the operator's tools: buildings, resources, troops, no beginner protection, and a hero. */
async function ready(gm, p, troops) {
  const cid = p.city.id;
  for (const [pos, type, lvl] of [
    [-1, 31, 8],
    [0, 29, 10],
    [1, 2, 10],
    [2, 25, 8],
    [3, 21, 5],
    [4, 27, 5],
    [5, 28, 3],
  ])
    await ok(gm, 'PUT', `/admin/cities/${cid}/buildings`, { playerId: p.id, positionId: pos, typeId: type, level: lvl });
  await ok(gm, 'PUT', `/admin/cities/${cid}/resources`, { playerId: p.id, gold: 2e6, food: 2e6, wood: 2e6, stone: 2e6, iron: 2e6 });
  await ok(gm, 'PUT', `/admin/cities/${cid}/stats`, { playerId: p.id, population: 3000, troops });
  await ok(gm, 'PUT', '/admin/players/flags', { playerName: p.name, beginner: false, title: 3 });
  const inn = await ok(p.token, 'GET', `/cities/${cid}/tavern`);
  p.hero = await ok(p.token, 'POST', `/cities/${cid}/tavern/${inn.heros[0].id}/hire`);
}

const near = async (p, type, level) => {
  const found = await ok(p.token, 'GET', `/map/search?x=${p.city.x}&y=${p.city.y}&radius=20&type=${type}`);
  const free = found.filter((t) => t.cityId == null && t.ownerCityId == null && (level == null || t.level === level));
  free.sort((a, b) => Math.hypot(a.x - p.city.x, a.y - p.city.y) - Math.hypot(b.x - p.city.x, b.y - p.city.y));
  if (!free[0]) throw new Error(`no free tile of type ${type} near ${p.name}`);
  return free[0];
};
const refusedForPvp = (r) => r.ok !== 1 && r.error?.code === PVP_DISABLED;
const noOffer = (t) => !t.canLoot && !t.canOccupy && !t.canScout;
const send = (p, body) => call(p.token, 'POST', `/cities/${p.city.id}/armies`, body);
const armyReport = async (p, code) => (await ok(p.token, 'GET', '/reports?type=1')).reports.find((r) => r.title.code === code);

async function main() {
  const config = await ok(null, 'GET', '/config/static');
  if (config.features.pvp) {
    console.log('stopped: this scenario needs PvP off, and this stack has it on (FEATURE_PVP=false; war.mjs checks it on)');
    process.exit(1);
  }
  console.log(`PvP off against ${API}`);
  check(config.features.pvp === false, 'GET /config/static says PvP is off, without a token');

  const gm = await operator();
  const p = await newPlayer('a');
  const q = await newPlayer('b');
  await ready(gm, p, { lightCavalry: 3000, scouter: 200, carriage: 50 });
  await ready(gm, q, { lightCavalry: 40_000 });
  check((await ok(p.token, 'GET', '/player')).features.pvp === false, 'the player state says PvP is off');

  // ---- what no player holds still works ----
  const free = await near(q, FOREST, 1).catch(() => near(q, GRASS, 1));
  await ok(q.token, 'POST', `/cities/${q.city.id}/armies`, { targetTileId: free.id, mission: ATTACK, troops: { lightCavalry: 40_000 }, heroId: q.hero.id });
  const valley = await until(async () => {
    const t = await ok(q.token, 'GET', `/map/tiles/${free.id}`);
    return t.owner?.playerId === q.id ? t : null;
  }, 'a player taking a free valley');
  check(true, `a player took a free valley (${valley.x},${valley.y}) from the map`);

  const npc = await near(p, NPC, 1);
  check(!noOffer(await ok(p.token, 'GET', `/map/tiles/${npc.id}`)), 'the map offers an attack on a barbarian city');
  const toNpc = await send(p, { targetTileId: npc.id, mission: ATTACK, troops: { lightCavalry: 500 }, heroId: p.hero.id });
  check(toNpc.ok === 1, 'an army sets out for a barbarian city');
  const report = await until(
    () => armyReport(p, 'report.title.attackSucceeded').then(async (r) => r ?? (await armyReport(p, 'report.title.attackFailed'))),
    'a battle report',
    240_000,
  );
  check(!!report, 'it fights there and reports the battle');

  // ---- what a player holds can't be touched ----
  for (const [what, tile] of [
    ['city', q.city.fieldId],
    ['valley', valley.id],
  ]) {
    check(noOffer(await ok(p.token, 'GET', `/map/tiles/${tile}`)), `the map offers nothing against another player's ${what}`);
    check(
      refusedForPvp(await send(p, { targetTileId: tile, mission: ATTACK, troops: { lightCavalry: 10 }, heroId: p.hero.id })),
      `attacking another player's ${what} is refused`,
    );
    check(refusedForPvp(await send(p, { targetTileId: tile, mission: SCOUT, troops: { scouter: 10 } })), `scouting another player's ${what} is refused`);
  }

  const landAt = Math.floor((Date.now() + 3_600_000) / 1000) * 1000;
  check(
    refusedForPvp(await call(p.token, 'POST', '/plans', { name: 'Raid', targetTileId: q.city.fieldId, landAt, shared: false })),
    "a wave plan on another player's city is refused",
  );
  const plan = await call(p.token, 'POST', '/plans', { name: 'Break it', targetTileId: npc.id, landAt, shared: false });
  check(plan.ok === 1, 'a wave plan on a barbarian city is fine');

  // a farming flow skips the other player's city, saying why (its hero stays free for the next target)
  await until(async () => (await ok(p.token, 'GET', `/cities/${p.city.id}`)).heros.some((h) => h.id === p.hero.id && h.status === 0), 'the hero home', 240_000);
  const preset = (await ok(p.token, 'POST', '/player/army-presets', { name: 'Fx farm', troops: { lightCavalry: 10 } })).find((x) => x.name === 'Fx farm');
  const flow = (
    await ok(p.token, 'POST', '/player/flows', {
      name: 'Fx farm',
      actions: [{ type: 'attackTargets', presetId: preset.id, targets: { [p.city.id]: [q.city.fieldId, npc.id] } }],
    })
  ).find((f) => f.name === 'Fx farm');
  const [skipped, sent] = (await ok(p.token, 'POST', `/player/flows/${flow.id}/run`, { preview: true })).cities[0].steps[0].items;
  check(
    skipped.ok === false && skipped.detail.code === 'flow.target.refused' && skipped.detail.params.reason.code === PVP_DISABLED,
    "a flow skips another player's city and says why",
  );
  check(sent.ok === true, 'and goes on to the barbarian city');

  // ---- truces ----
  const sold = (await ok(p.token, 'GET', '/shop')).flatMap((c) => c.items.map((i) => i.id));
  check(!sold.includes(TRUCE), 'the shop sells no Truce Agreement');
  const bought = await call(p.token, 'POST', `/cities/${p.city.id}/shop/gold`, { itemId: TRUCE, amount: 1 });
  check(bought.ok !== 1 && bought.error?.code === 'item.notForSale', 'buying one is refused');
  const truce = await call(p.token, 'POST', '/player/truce', { itemId: TRUCE, cityId: p.city.id });
  check(truce.ok !== 1 && truce.error?.code === 'player.truce.pvpDisabled', 'starting one is refused');

  // ---- allies ----
  const allianceName = `Fx${suffix}`;
  await ok(p.token, 'POST', '/alliance', { cityId: p.city.id, allianceName });
  await ok(q.token, 'POST', '/alliance/apply', { allianceName });
  await ok(p.token, 'POST', '/alliance/applications/accept', { userName: q.name });
  const friend = await ok(p.token, 'GET', `/map/tiles/${q.city.fieldId}`);
  check(friend.canTrans === true, 'the map still offers supplying an ally');
  check(
    (await send(p, { targetTileId: q.city.fieldId, mission: TRANSPORT, troops: { carriage: 1 }, resources: { food: 10 } })).ok === 1,
    'allies can still supply each other',
  );

  console.log(failures ? `${failures} FAILED` : 'all ok');
  console.log(`accounts: fx_pvp_a_${suffix} fx_pvp_b_${suffix}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
