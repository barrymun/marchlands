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
  check(
    a.city.buildings.some((x) => x.typeId === 31 && x.level === 1),
    'new city has Town Hall 1',
  );
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
    for (const [pos, type, lvl] of [
      [-1, 31, 5],
      [1, 29, 5],
      [2, 2, 10],
      [3, 25, 5],
      [4, 21, 5],
      [5, 27, 5],
      [6, 28, 1],
      [-2, 32, 3],
      [7, 23, 3],
      [8, 30, 2],
      [9, 22, 3],
    ]) {
      await ok(gm.token, 'PUT', `/admin/cities/${cid}/buildings`, { playerId: pid, positionId: pos, typeId: type, level: lvl });
    }
    await ok(gm.token, 'PUT', `/admin/cities/${cid}/resources`, { playerId: pid, gold: 5e6, food: 5e6, wood: 5e6, stone: 5e6, iron: 5e6 });
    await ok(gm.token, 'POST', '/admin/cents', { playerName: a.state.playerInfo.userName, cents: 5000 });
    check(true, 'admin fast-forward (buildings, resources, cents)');
    // demolition is instant and removes the whole building (BALANCE.instantDemolish)
    await ok(gm.token, 'PUT', `/admin/cities/${cid}/buildings`, { playerId: pid, positionId: 20, typeId: 1, level: 3 });
    const before = await ok(a.token, 'GET', `/cities/${cid}`);
    await ok(a.token, 'POST', `/cities/${cid}/buildings/20/demolish`);
    const after = await ok(a.token, 'GET', `/cities/${cid}`);
    check(!after.buildings.some((x) => x.positionId === 20), 'cottage Lv 3 demolished at once');
    check(after.resource.wood.amount > before.resource.wood.amount, 'demolition refunds resources');
    check((await call(a.token, 'POST', `/cities/${cid}/buildings/-1/demolish`)).ok !== 1, 'Town Hall cannot be demolished');
  }

  // ---- research ----
  const rl = await ok(a.token, 'GET', `/cities/${cid}/research`);
  check(rl.techs.length >= 19, 'research list');
  // two researches at once per city (BALANCE.researchQueues); a third is rejected
  const others = rl.techs.filter((t) => t.permission && t.typeId !== 8).map((t) => t.typeId);
  await ok(a.token, 'POST', `/cities/${cid}/research`, { techId: 8 });
  await ok(a.token, 'POST', `/cities/${cid}/research`, { techId: others[0] });
  const rl2 = await ok(a.token, 'GET', `/cities/${cid}/research`);
  check(rl2.researchingIds.length === 2 && rl2.slots === 2, `two researches running (${rl2.researchingIds.join(', ')})`);
  if (others[1] != null) {
    const r3 = await call(a.token, 'POST', `/cities/${cid}/research`, { techId: others[1] });
    check(r3.ok !== 1, 'third concurrent research rejected');
  }
  const ambiguous = await call(a.token, 'POST', `/cities/${cid}/research/speedup`, { itemId: 'coins.speed' });
  check(ambiguous.ok !== 1, 'speed-up without techId rejected while two run');
  await ok(a.token, 'POST', `/cities/${cid}/research/speedup`, { itemId: 'coins.speed', techId: 8 });
  await until(async () => (await ok(a.token, 'GET', '/player')).research['8']?.level === 1, 'military science completes');
  check(true, 'research completes after coin speed-up');
  await ok(a.token, 'DELETE', `/cities/${cid}/research?techId=${others[0]}`);
  check((await ok(a.token, 'GET', `/cities/${cid}/research`)).researchingIds.length === 0, 'second research cancelled by techId');

  // ---- heroes ----
  const tav = await ok(a.token, 'GET', `/cities/${cid}/tavern`);
  check(tav.heros.length === 5, 'tavern offers = inn level');
  const hero = await ok(a.token, 'POST', `/cities/${cid}/tavern/${tav.heros[0].id}/hire`);
  await ok(a.token, 'POST', `/heroes/${hero.id}/mayor`);
  const h2 = await ok(a.token, 'POST', `/cities/${cid}/tavern/${tav.heros[1].id}/hire`);
  check(!!h2.id, 'hired two heroes, one mayor');
  const reordered = await ok(a.token, 'PUT', `/cities/${cid}/heroes/order`, { heroIds: [h2.id, hero.id] });
  const listed = (await ok(a.token, 'GET', `/cities/${cid}`)).heros.map((h) => h.id);
  check(reordered.heroes[0].id === h2.id && listed[0] === h2.id && listed[1] === hero.id, 'heroes keep the order the lord set');

  // ---- flows: a series of actions run on cities, each city all-or-nothing ----
  {
    const saved = await ok(a.token, 'POST', '/player/flows', {
      name: 'Smoke flow',
      actions: [
        { type: 'setMayor', stat: 'power' },
        { type: 'trainTroops', troopId: 3, amount: 5 },
        { type: 'setMayor', stat: 'management' },
        { type: 'healTroops', payWith: 'resources' },
      ],
    });
    const fid = saved.find((f) => f.name === 'Smoke flow').id;
    const before = await ok(a.token, 'GET', `/cities/${cid}`);
    const preview = await ok(a.token, 'POST', `/player/flows/${fid}/run`, { cityIds: [cid], preview: true });
    check(preview.cities[0].ok && preview.cities[0].steps.length === 4, 'flow preview runs every action');
    check(preview.cities[0].steps[3].detail === 'No injured troops', 'heal action passes when nothing is injured');
    const saved1 = (await ok(a.token, 'GET', '/player/flows')).find((f) => f.id === fid);
    check(saved1.cities === 'all', 'a flow runs on all cities unless cities are chosen');
    const viaSaved = await ok(a.token, 'POST', `/player/flows/${fid}/run`, { preview: true });
    check(viaSaved.cities.length === 1 && viaSaved.cities[0].cityId === cid, "without cityIds a run uses the flow's saved cities");
    const still = await ok(a.token, 'GET', `/cities/${cid}`);
    check(Math.abs(still.resource.food.amount - before.resource.food.amount) < 100, 'flow preview changes nothing');
    const run = await ok(a.token, 'POST', `/player/flows/${fid}/run`, { cityIds: [cid] });
    check(run.cities[0].ok && run.cities[0].steps.every((s) => s.ok), 'flow runs');
    // a flow that fails half way is rolled back in that city (catapults need research)
    const bad = (
      await ok(a.token, 'POST', '/player/flows', {
        name: 'Smoke bad',
        actions: [
          { type: 'setMayor', stat: 'stratagem' },
          { type: 'trainTroops', troopId: 13, amount: 1 },
        ],
      })
    ).find((f) => f.name === 'Smoke bad');
    const mayorsBefore = (await ok(a.token, 'GET', `/cities/${cid}`)).heros.map((h) => `${h.id}:${h.status}`).join();
    const failed = await ok(a.token, 'POST', `/player/flows/${bad.id}/run`, { cityIds: [cid] });
    const mayorsAfter = (await ok(a.token, 'GET', `/cities/${cid}`)).heros.map((h) => `${h.id}:${h.status}`).join();
    check(!failed.cities[0].ok && mayorsBefore === mayorsAfter, 'failed flow rolled back');
    // attack targets: a target the city cannot satisfy is skipped, the flow still succeeds
    const huge = (await ok(a.token, 'POST', '/player/army-presets', { name: 'Smoke huge', troops: { militia: 10_000_000 } })).find(
      (x) => x.name === 'Smoke huge',
    );
    const farm = (
      await ok(a.token, 'POST', '/player/flows', {
        name: 'Smoke farm',
        actions: [{ type: 'attackTargets', presetId: huge.id, targets: { [cid]: [a.city.fieldId + 1] } }],
      })
    ).find((f) => f.name === 'Smoke farm');
    const farmed = await ok(a.token, 'POST', `/player/flows/${farm.id}/run`, { preview: true });
    check(
      farmed.cities[0].ok && farmed.cities[0].steps[0].items?.[0]?.ok === false && /skipped/.test(farmed.cities[0].steps[0].items[0].detail),
      'attack target without enough troops is skipped, not failed',
    );
    // train steps the city cannot afford in full train what it can, or are skipped: the run carries on
    const lots = (await ok(a.token, 'POST', '/player/flows', { name: 'Smoke lots', actions: [{ type: 'trainTroops', troopId: 3, amount: 50_000_000 }] })).find(
      (f) => f.name === 'Smoke lots',
    );
    const lotsRun = await ok(a.token, 'POST', `/player/flows/${lots.id}/run`, { cityIds: [cid], preview: true });
    const lotsStep = lotsRun.cities[0].steps[0];
    check(
      lotsRun.cities[0].ok && (lotsStep.skipped || /only .* of 50,000,000/.test(lotsStep.detail)),
      'unaffordable training is trimmed or skipped, not failed',
    );
    // waits pause the whole flow; one flow runs at a time; repeat runs again until a run fails
    const waitActions = [
      { type: 'setMayor', stat: 'power' },
      { type: 'wait', until: 'armiesHome' },
      { type: 'wait', until: 'time', minutes: 5 },
      { type: 'setMayor', stat: 'management' },
    ];
    const paused = (await ok(a.token, 'POST', '/player/flows', { name: 'Smoke wait', actions: waitActions })).find((f) => f.name === 'Smoke wait');
    const pv = await ok(a.token, 'POST', `/player/flows/${paused.id}/run`, { cityIds: [cid], preview: true });
    check(pv.cities[0].steps.length === 2 && /not previewed/.test(pv.cities[0].steps[1].detail), 'flow preview stops at the first wait');
    const started = await ok(a.token, 'POST', `/player/flows/${paused.id}/run`, { cityIds: [cid] });
    check(
      started.flow.status === 'waiting' && started.cities[0].steps.length === 3 && /No armies out/.test(started.cities[0].steps[1].detail),
      'flow runs up to a wait and waits (an armies-home wait with none out carries on)',
    );
    const reordered = await call(a.token, 'POST', '/player/flows', { id: paused.id, name: 'Smoke wait', actions: waitActions.slice(0, 3) });
    check(reordered.ok !== 1, 'a running flow keeps its actions in order');
    const second = (await ok(a.token, 'POST', '/player/flows', { name: 'Smoke second', actions: [{ type: 'setMayor', stat: 'power' }] })).find(
      (f) => f.name === 'Smoke second',
    );
    const alongside = await ok(a.token, 'POST', `/player/flows/${second.id}/run`, {});
    check(alongside.flow.status === 'idle' && alongside.cities[0]?.ok, 'another flow runs while one waits');
    check((await call(a.token, 'POST', `/player/flows/${paused.id}/run`, {})).ok !== 1, 'a running flow cannot be run again');
    const stopped = (await ok(a.token, 'POST', `/player/flows/${paused.id}/stop`)).find((f) => f.id === paused.id);
    check(stopped.status === 'idle' && stopped.lastRun.finishedAt > 0, 'stop ends a waiting flow');
    const rep = (await ok(a.token, 'POST', `/player/flows/${second.id}/repeat`, { repeat: true })).find((f) => f.id === second.id);
    check(rep.repeat && rep.status === 'queued' && rep.runs === 2 && rep.notBefore > rep.lastRun.startedAt, 'repeat runs the flow now and queues the next run');
    const off = (await ok(a.token, 'POST', `/player/flows/${second.id}/repeat`, { repeat: false })).find((f) => f.id === second.id);
    check(!off.repeat && off.status === 'idle', 'repeat off: no next run');
    const badRep = (await ok(a.token, 'POST', `/player/flows/${bad.id}/repeat`, { repeat: true })).find((f) => f.id === bad.id);
    check(!badRep.repeat && badRep.status === 'idle' && /failed/.test(badRep.stopReason ?? ''), 'a failed run switches repeat off');
    // put the original mayor back for the rest of the run
    await ok(a.token, 'POST', `/heroes/${hero.id}/mayor`);
  }

  // ---- hero gear (Hero Enhancement research + medal stars, for every hero) ----
  {
    const playerName = a.state.playerInfo.userName;
    await ok(gm.token, 'PUT', '/admin/research', { playerName, techId: 21, level: 3 });
    check((await ok(a.token, 'GET', '/gear')).level === 3, 'Hero Enhancement 3 = gear level 3');
    const g1 = (await ok(a.token, 'GET', `/cities/${cid}`)).heros.find((x) => x.id === h2.id);
    // gear tier: hero level ÷ 10 (none below 10, 10 at 100); each piece at level L adds 1 + … + L
    const tier = Math.min(10, Math.floor(g1.level / 10));
    const L = Math.min(3, tier);
    const pts = (14 * L * (L + 1)) / 2;
    check(g1[`${g1.gearStat}Added`] === pts, `level ${g1.level} hero (tier ${tier}) gets +${pts} on ${g1.gearStat}`);
    const sw = await ok(a.token, 'PUT', `/heroes/${h2.id}/gear-stat`, { stat: 'stratagem' });
    check(sw.gearStat === 'stratagem' && sw.stratagemAdded === pts && sw.powerAdded === 0 && sw.managementAdded === 0, 'gear moved to intelligence');
    check((await call(a.token, 'POST', '/gear/weapon/star')).ok !== 1, 'star needs a medal');
    await ok(gm.token, 'POST', '/admin/items', { playerName, items: { 'hero.loyalty.1': 1 } });
    check((await ok(a.token, 'POST', '/gear/weapon/star')).stars.weapon === 1, 'weapon star 1 for a Cross Medal');
    const g2 = (await ok(a.token, 'GET', `/cities/${cid}`)).heros.find((x) => x.id === h2.id);
    check(g2.stratagemAdded === pts + (tier >= 1 ? 3 : 0), 'star adds +3 to every hero with gear');
  }

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

  // ---- upgrade an unowned valley for gold ----
  let wild;
  for (let type = 1; type <= 6 && !wild; type++) {
    const found = await ok(a.token, 'GET', `/map/search?x=${city.x}&y=${city.y}&radius=10&type=${type}`);
    wild = found.find((t) => t.ownerCityId == null && t.level < 10);
  }
  if (wild) {
    const info0 = await ok(a.token, 'GET', `/map/tiles/${wild.id}`);
    const gold0 = (await ok(a.token, 'GET', `/cities/${cid}`)).resource.gold;
    const up = await ok(a.token, 'POST', `/valleys/${wild.id}/upgrade`, { cityId: cid });
    check(up.level === info0.level + 1 && up.gold === info0.upgradeCost, `valley Lv ${info0.level} → ${up.level} for ${up.gold} gold`);
    check(gold0 - (await ok(a.token, 'GET', `/cities/${cid}`)).resource.gold >= up.gold - 1, 'gold paid by the city');
    check((await ok(a.token, 'GET', `/map/tiles/${wild.id}`)).level === up.level, 'map shows the new level');
    const ownValley = await call(a.token, 'POST', `/valleys/${own.id}/upgrade`, { cityId: cid });
    check(ownValley.ok !== 1, 'a city tile cannot be upgraded');
  } else console.log('  (no unowned valley nearby; valley upgrade skipped)');

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
  check(
    ps.buffs.some((x) => x.id === 'FoodProductionBuff'),
    'production buff active',
  );

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
