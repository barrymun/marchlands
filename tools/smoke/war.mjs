#!/usr/bin/env node
// Two-lord scenario: scouting, attacking a city (plunder; lords' cities have no loyalty), valley occupation,
// recall, alliance transport and a market fill (see market.mjs for the merchant). Needs an operator account (SMOKE_ADMIN listed
// in ADMIN_USERNAMES) and a fast GAME_SPEED (>= 200 recommended).
//   API=http://localhost:3100 node tools/smoke/war.mjs

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
async function until(fn, msg, timeout = 60_000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(500);
  }
  throw new Error(`timeout: ${msg}`);
}

const suffix = Math.random().toString(36).slice(2, 7);
async function admin() {
  const user = process.env.SMOKE_ADMIN ?? 'smoke_admin';
  let r = await call(null, 'POST', '/auth/login', { username: user, password: 'secret123' });
  if (r.ok !== 1) r = await call(null, 'POST', '/auth/register', { username: user, email: `${user}@example.test`, password: 'secret123' });
  if (!r.data?.isAdmin) throw new Error(`${user} must be an operator (ADMIN_USERNAMES)`);
  return r.data.token;
}
async function lord(name, zone) {
  const reg = await ok(null, 'POST', '/auth/register', { username: `${name}_${suffix}`, email: `${name}_${suffix}@example.test`, password: 'secret123' });
  const c = await ok(reg.token, 'POST', '/player', { userName: `${name}${suffix}`, castleName: `${name} Keep`, flag: name.slice(0, 3), sex: 1, zone });
  return { token: c.token, id: c.playerInfo.id, name: c.playerInfo.userName, city: c.castles[0] };
}

async function setup(gm, l, troops) {
  const cid = l.city.id;
  const layout = [
    [-1, 31, 8],
    [-2, 32, 5],
    [0, 29, 10],
    [1, 2, 10],
    [2, 25, 8],
    [3, 21, 5],
    [4, 27, 5],
    [5, 28, 3],
    [6, 23, 5],
    [7, 30, 5],
    [8, 22, 5],
    [9, 3, 5],
  ];
  for (const [pos, type, lvl] of layout) await ok(gm, 'PUT', `/admin/cities/${cid}/buildings`, { playerId: l.id, positionId: pos, typeId: type, level: lvl });
  await ok(gm, 'PUT', `/admin/cities/${cid}/resources`, { playerId: l.id, gold: 2e6, food: 2e6, wood: 2e6, stone: 2e6, iron: 2e6 });
  await ok(gm, 'PUT', `/admin/cities/${cid}/stats`, { playerId: l.id, population: 3000, troops });
  await ok(gm, 'PUT', '/admin/players/flags', { playerName: l.name, beginner: false, title: 3 });
}

async function main() {
  const gm = await admin();
  const a = await lord('atk', 6);
  const b = await lord('def', 6);
  // move B next to A with an Adv City Teleporter
  const near = await ok(a.token, 'GET', `/map/search?x=${a.city.x}&y=${a.city.y}&radius=6&type=10`);
  const spot = near.find((t) => t.cityId == null && t.ownerCityId == null && Math.abs(t.x - a.city.x) + Math.abs(t.y - a.city.y) > 1);
  await ok(gm, 'POST', '/admin/items', { playerName: b.name, items: { 'consume.move.1': 1 } });
  const moved = await ok(b.token, 'POST', `/cities/${b.city.id}/move`, { targetTileId: spot.id });
  const again = await call(b.token, 'POST', `/cities/${b.city.id}/move`, { targetTileId: spot.id });
  check(again.ok !== 1 && again.error?.code === 'city.teleportCooldown', 'City Teleporter cools down after a move');
  b.city = { ...b.city, ...moved };
  check(moved.fieldId === spot.id, `defender teleported next door (${moved.x},${moved.y})`);

  await setup(gm, a, { lightCavalry: 3000, scouter: 200, carriage: 50 });
  await setup(gm, b, { militia: 300, scouter: 20 });
  const tav = await ok(a.token, 'GET', `/cities/${a.city.id}/tavern`);
  const hero = await ok(a.token, 'POST', `/cities/${a.city.id}/tavern/${tav.heros[0].id}/hire`);

  // ---- scouting ----
  await ok(a.token, 'POST', `/cities/${a.city.id}/armies`, { targetTileId: b.city.fieldId, mission: 3, troops: { scouter: 200 } });
  const scout = await until(
    async () => (await ok(a.token, 'GET', '/reports?type=1')).reports.find((r) => r.title.code === 'report.title.scoutReport'),
    'scout report',
  );
  const scoutFull = await ok(a.token, 'GET', `/reports/${scout.id}`);
  check(scoutFull.content.scout.success === true && scoutFull.content.scout.intel.troops.militia === 300, 'scouts saw 300 warriors');
  const defRep = await until(
    async () => (await ok(b.token, 'GET', '/reports?type=1')).reports.find((r) => r.title.code === 'report.title.enemyScouts'),
    'defender notified',
  );
  check(!!defRep, 'defender got an "Enemy Scouts" report');
  await until(async () => (await ok(a.token, 'GET', '/armies')).self.length === 0, 'scouts back home');

  // ---- attack the city ----
  const before = await ok(a.token, 'GET', `/cities/${a.city.id}`);
  const army = await ok(a.token, 'POST', `/cities/${a.city.id}/armies`, {
    targetTileId: b.city.fieldId,
    mission: 5,
    troops: { lightCavalry: 3000 },
    heroId: hero.id,
  });
  check(army.missionType === 5, 'attack sent');
  const enemyView = await ok(b.token, 'GET', '/armies');
  check(enemyView.enemy.length === 1, 'defender sees the incoming army (beacon tower)');
  const attackRep = await until(
    async () =>
      (await ok(a.token, 'GET', '/reports?type=1')).reports.find(
        (r) => r.attack && ['report.title.attackSucceeded', 'report.title.attackFailed'].includes(r.title.code),
      ),
    'attack report',
  );
  const full = await ok(a.token, 'GET', `/reports/${attackRep.id}`);
  const battle = full.content.battle;
  check(battle.result === 'attackerWon', `attack won in ${battle.rounds} rounds, lost ${JSON.stringify(battle.attacker.troops.lost)}`);
  check(!('loyaltyDamage' in battle) && !('captured' in battle), "no loyalty damage: lords' cities cannot be captured");
  const loot = Object.values(battle.plunder).reduce((s, v) => s + v, 0);
  check(loot > 0, `plundered ${loot} resources`);
  const bAfter = await ok(b.token, 'GET', `/cities/${b.city.id}`);
  check(!('support' in bAfter.resource), 'cities report no loyalty');
  check((bAfter.troop.militia ?? 0) < 300, 'defender lost warriors');
  await until(async () => (await ok(a.token, 'GET', '/reports?type=1')).reports.some((r) => r.title.code === 'report.title.attackReturned'), 'army returned');
  const after = await ok(a.token, 'GET', `/cities/${a.city.id}`);
  check(after.resource.food.amount > before.resource.food.amount - 1, 'loot delivered home');
  const heroAfter = after.heros.find((h) => h.id === hero.id);
  check(heroAfter.status === 0 && heroAfter.experience > 0, `hero idle again with ${heroAfter.experience} exp`);

  // ---- valley ----
  const valleys = await ok(a.token, 'GET', `/map/search?x=${a.city.x}&y=${a.city.y}&radius=8&type=5`);
  const v = valleys.find((t) => t.level === 1 && t.ownerCityId == null);
  if (v) {
    await ok(a.token, 'POST', `/cities/${a.city.id}/armies`, { targetTileId: v.id, mission: 5, troops: { lightCavalry: 1000 }, heroId: hero.id });
    const vr = await until(
      async () =>
        (await ok(a.token, 'GET', '/reports?type=1')).reports.find(
          (r) => r.title.code.startsWith('report.title.valley') || (r.attack && r.targetPos?.params?.tile?.id === 5) /* a grassland tile */,
        ),
      'valley report',
    );
    check(vr.title.code === 'report.title.valleyOccupied', `valley attack: ${vr.title.code}`);
    const c = await ok(a.token, 'GET', `/cities/${a.city.id}`);
    check(
      c.fields.some((f) => f.id === v.id),
      'valley listed under city fields',
    );
    check(c.resource.food.bonus >= 0.03, `food bonus ${c.resource.food.bonus}`);
  } else console.log('  (no level-1 grassland nearby; valley step skipped)');

  // ---- recall ----
  await until(async () => (await ok(a.token, 'GET', '/armies')).self.length === 0, 'all armies home');
  const far = await ok(a.token, 'POST', `/cities/${a.city.id}/armies`, {
    targetTileId: (a.city.fieldId + 300 * 800) % 640000,
    mission: 3,
    troops: { scouter: 10 },
  }).catch(() => null);
  if (far) {
    const rec = await ok(a.token, 'POST', `/armies/${far.armyId}/recall`);
    check(rec.direction === 2, 'army recalled (returning)');
  }

  // ---- alliance + transport ----
  const allianceName = `Pact${suffix}`;
  await ok(a.token, 'POST', '/alliance', { cityId: a.city.id, allianceName });
  await ok(b.token, 'POST', '/alliance/apply', { allianceName });
  await ok(a.token, 'POST', '/alliance/applications/accept', { userName: b.name });
  const members = await ok(a.token, 'GET', '/alliance/members');
  check(members.length === 2, 'defender joined the alliance');
  const bGold = (await ok(b.token, 'GET', `/cities/${b.city.id}`)).resource.gold;
  await ok(a.token, 'POST', `/cities/${a.city.id}/armies`, { targetTileId: b.city.fieldId, mission: 1, troops: { carriage: 10 }, resources: { gold: 20000 } });
  await until(async () => (await ok(b.token, 'GET', `/cities/${b.city.id}`)).resource.gold >= bGold + 19000, 'transport delivered', 180_000);
  check(true, 'transport of 20,000 gold delivered to ally');
  const blocked = await call(a.token, 'POST', `/cities/${a.city.id}/armies`, {
    targetTileId: b.city.fieldId,
    mission: 5,
    troops: { lightCavalry: 10 },
    heroId: hero.id,
  });
  check(blocked.ok === -13, 'cannot attack an alliance member');

  // ---- market ----
  // an offer inside the computer merchant's spread beats the merchant, so the bid fills against it;
  // with a fixed merchant price (no spread) the merchant takes the offer and fills the bid itself
  const merchant = (await ok(a.token, 'GET', '/market/1')).merchant;
  const fixed = merchant.ask === merchant.bid;
  const ref = Math.round(merchant.reference * 1000) / 1000;
  const offer = await ok(b.token, 'POST', `/cities/${b.city.id}/market/orders`, { resType: 1, side: 1, amount: 5000, price: ref });
  const fill = await ok(a.token, 'POST', `/cities/${a.city.id}/market/orders`, { resType: 1, side: 0, amount: 5000, price: ref });
  if (fixed)
    check(offer.merchantFilled === 5000 && fill.filled === 5000 && fill.merchantFilled === 5000, 'fixed-price merchant took the offer and filled the bid');
  else check(fill.filled === 5000 && fill.playerFilled === 5000, 'buy order filled against the offer');
  const left = await ok(a.token, 'GET', '/market/orders/mine');
  check(fill.order === null && left.length === 0, 'fully filled order not left on the book (no refundable escrow left behind)');
  check(!(await ok(b.token, 'GET', '/market/orders/mine')).length, "seller's filled offer removed too");
  // trades settle instantly (BALANCE.marketShipmentBaseMs = 0): the buyer already has the lumber
  check((await ok(a.token, 'GET', '/market/shipments')).length === 0, 'purchase settled instantly (no shipment)');

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
