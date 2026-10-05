#!/usr/bin/env node
// End-to-end smoke test against a running stack (run the worker with GAME_SPEED=50 or more).
//   API=http://localhost:3100 node tools/smoke/smoke.mjs

const API = process.env.API ?? 'http://localhost:3000';
const base = `${API}/api/v1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

async function call(token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
async function ok(token, method, path, body) {
  const r = await call(token, method, path, body);
  if (r.ok !== 1) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r).slice(0, 400)}`);
  return r.data;
}
function check(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
async function until(fn, msg, timeout = 30_000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`timeout: ${msg}`);
}

function socket(token) {
  const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws?token=${token}`);
  const frames = [];
  ws.addEventListener('message', (e) => frames.push(JSON.parse(e.data)));
  return { ws, frames, has: (cmd) => frames.some((f) => f.cmd === cmd) };
}

const suffix = Math.random().toString(36).slice(2, 7);

async function newLord(name) {
  const reg = await ok(null, 'POST', '/auth/register', { username: `${name}_${suffix}`, email: `${name}_${suffix}@example.test`, password: 'secret123' });
  const created = await ok(reg.token, 'POST', '/player', { userName: `${name}${suffix}`, castleName: `${name} Hold`, flag: name.slice(0, 3), sex: 0, zone: 5 });
  return { token: created.token, state: created, city: created.castles[0], isAdmin: reg.isAdmin };
}

async function main() {
  console.log(`smoke test against ${API}`);
  const health = await fetch(`${API}/health`).then((r) => r.json());
  check(health.ok === 1, 'health');

  const a = await newLord('alpha');
  const b = await newLord('bravo');
  check(a.city.buildings.some((x) => x.typeId === 31 && x.level === 1), 'new city has Town Hall 1');
  check(a.city.resource.gold === 100000, 'starting gold 100k');
  const sock = socket(a.token);
  await until(() => sock.has('server.Connected'), 'websocket connected');
  check(true, 'websocket connected');

  // ---- construction ----
  const cid = a.city.id;
  await ok(a.token, 'POST', `/cities/${cid}/buildings`, { typeId: 1, positionId: 0 });
  // two construction queues (BALANCE.buildQueues): the second build starts, a third is refused
  const r2 = await call(a.token, 'POST', `/cities/${cid}/buildings`, { typeId: 1, positionId: 10 });
  check(r2.ok === 1, 'second concurrent build accepted');
  const r3 = await call(a.token, 'POST', `/cities/${cid}/buildings`, { typeId: 1, positionId: 11 });
  check(r3.ok === -48, 'third concurrent build rejected (-48)');
  await until(async () => (await ok(a.token, 'GET', `/cities/${cid}`)).buildings.some((x) => x.typeId === 1 && x.level === 1), 'cottage completes');
  check(true, 'cottage level 1 completed by worker');
  check(sock.has('server.BuildComplate'), 'BuildComplate push received');

  // fast-forward with operator tools: SMOKE_ADMIN (default "smoke_admin") must be listed in
  // ADMIN_USERNAMES, or be the first account on the server
  const adminUser = process.env.SMOKE_ADMIN ?? 'smoke_admin';
  let gm = null;
  const login = await call(null, 'POST', '/auth/login', { username: adminUser, password: 'secret123' });
  if (login.ok === 1) gm = login.data;
  else {
    const reg = await call(null, 'POST', '/auth/register', { username: adminUser, email: `${adminUser}@example.test`, password: 'secret123' });
    if (reg.ok === 1) gm = reg.data;
  }
  if (!gm?.isAdmin) throw new Error(`${adminUser} is not an operator: add it to ADMIN_USERNAMES`);
  {
    const pid = a.state.playerInfo.id;
    for (const [pos, type, lvl] of [[-1, 31, 5], [1, 29, 5], [2, 2, 10], [3, 25, 5], [4, 21, 5], [5, 27, 5], [6, 28, 1], [-2, 32, 3], [7, 23, 3], [8, 30, 2], [9, 22, 3]]) {
      await ok(gm.token, 'PUT', `/admin/cities/${cid}/buildings`, { playerId: pid, positionId: pos, typeId: type, level: lvl });
    }
    await ok(gm.token, 'PUT', `/admin/cities/${cid}/resources`, { playerId: pid, gold: 5e6, food: 5e6, wood: 5e6, stone: 5e6, iron: 5e6 });
    await ok(gm.token, 'POST', '/admin/cents', { playerName: a.state.playerInfo.userName, cents: 5000 });
    check(true, 'admin fast-forward (buildings, resources, cents)');
  }

  // ---- research ----
  const rl = await ok(a.token, 'GET', `/cities/${cid}/research`);
  check(rl.techs.length >= 19, 'research list');
  await ok(a.token, 'POST', `/cities/${cid}/research`, { techId: 8 });
  await ok(a.token, 'POST', `/cities/${cid}/research/speedup`, { itemId: 'coins.speed' });
  await until(async () => (await ok(a.token, 'GET', '/player')).research['8']?.level === 1, 'military science completes');
  check(true, 'research completes after coin speed-up');

  // ---- heroes ----
  const tav = await ok(a.token, 'GET', `/cities/${cid}/tavern`);
  check(tav.heros.length === 5, 'tavern offers = inn level');
  const hero = await ok(a.token, 'POST', `/cities/${cid}/tavern/${tav.heros[0].id}/hire`);
  await ok(a.token, 'POST', `/heroes/${hero.id}/mayor`);
  const h2 = await ok(a.token, 'POST', `/cities/${cid}/tavern/${tav.heros[1].id}/hire`);
  check(!!h2.id, 'hired two heroes, one mayor');

  // ---- troops ----
  await ok(a.token, 'POST', `/cities/${cid}/troops/train`, { troopId: 3, count: 40, positionId: 2 });
  await until(async () => ((await ok(a.token, 'GET', `/cities/${cid}`)).troop.militia ?? 0) >= 40, 'warriors trained', 90_000);
  check(true, 'troops trained by worker');
  await ok(a.token, 'POST', `/cities/${cid}/fortifications/train`, { troopId: 14, count: 5 });

  // ---- map ----
  const city = await ok(a.token, 'GET', `/cities/${cid}`);
  const map = await ok(a.token, 'GET', `/map?x1=${city.x - 10}&y1=${city.y - 10}&x2=${city.x + 10}&y2=${city.y + 10}`);
  check(map.mapStr.length === 21 * 21 * 2, 'map view 21x21');
  const npc = map.castles.find((c) => c.npc && c.level <= 2);
  const own = map.castles.find((c) => c.cityId === cid);
  check(!!own, 'own castle on map');

  // ---- scout + attack a barbarian city ----
  if (npc) {
    await ok(a.token, 'POST', `/cities/${cid}/armies`, { targetTileId: npc.id, mission: 5, troops: { militia: 40 }, heroId: h2.id });
    const armies = await ok(a.token, 'GET', '/armies');
    check(armies.self.length === 1, 'attack army marching');
    await until(async () => (await ok(a.token, 'GET', '/reports?type=1')).reports.some((r) => r.attack), 'battle report', 120_000);
    const rep = (await ok(a.token, 'GET', '/reports?type=1')).reports.find((r) => r.attack);
    const full = await ok(a.token, 'GET', `/reports/${rep.id}`);
    check(full.content.kind === 'battle', `battle report: ${full.title}, rounds ${full.content.battle.rounds}`);
  } else console.log('  (no low-level NPC near the city; attack skipped)');

  // ---- social ----
  await ok(a.token, 'POST', '/mail', { to: b.state.playerInfo.userName, title: 'Hello', content: 'Greetings neighbour' });
  const inbox = await ok(b.token, 'GET', '/mail?type=1');
  check(inbox.mails.length === 1 && inbox.mails[0].sender === a.state.playerInfo.userName, 'mail delivered');
  const sent = await ok(a.token, 'GET', '/mail?type=3');
  check(sent.mails.length === 1, 'sent copy kept');
  await ok(a.token, 'POST', '/alliance', { cityId: cid, allianceName: `Order${suffix}` });
  const al = await ok(a.token, 'GET', '/alliance');
  check(al.alliance.allianceName === `Order${suffix}` && al.myRank === 4, 'alliance created, host');
  await ok(a.token, 'POST', '/chat/alliance', { msg: 'hello alliance' });
  await until(() => sock.has('server.AllianceChatMsg'), 'alliance chat push');
  check(true, 'alliance chat push received');

  // ---- shop / items ----
  await ok(a.token, 'POST', '/shop/buy', { itemId: 'player.box.gambling.3', amount: 2 });
  const amulet = await ok(a.token, 'POST', '/player/items/player.box.gambling.3/use', { cityId: cid });
  check(amulet.amulet?.slots.length === 24, `amulet won ${amulet.amulet?.prize.count} x ${amulet.amulet?.prize.id}`);
  await ok(a.token, 'POST', '/shop/buy', { itemId: 'player.resinc.1', amount: 1 });
  await ok(a.token, 'POST', '/player/items/player.resinc.1/use', {});
  const ps = await ok(a.token, 'GET', '/player');
  check(ps.buffs.some((x) => x.id === 'FoodProductionBuff'), 'production buff active');

  // ---- market ----
  await ok(a.token, 'POST', `/cities/${cid}/market/orders`, { resType: 0, side: 1, amount: 1000, price: 0.5 });
  const book = await ok(a.token, 'GET', '/market/0');
  check(book.sellers.length >= 1, 'market order on the book');

  // ---- rankings / quests ----
  const quests = await ok(a.token, 'GET', '/quests');
  check(quests.length > 10, `quest list (${quests.filter((q) => q.isFinish).length} finished)`);
  const rank = await ok(a.token, 'GET', '/rankings/players?sortType=2');
  check(Array.isArray(rank.beans), 'player ranking');

  sock.ws.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
