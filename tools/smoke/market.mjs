#!/usr/bin/env node
// Marketplace scenarios: the computer merchant, instant settlement, limit orders resting and
// being filled by another lord, escrow refunds and trade history.
//   API=http://localhost:3000 node tools/smoke/market.mjs   (needs SMOKE_ADMIN as for smoke.mjs)

import { signUpProof } from './proof.mjs';

const A = `${process.env.API ?? 'http://localhost:3000'}/api/v1`;
const j = async (m, p, b, t) =>
  (
    await fetch(A + p, {
      method: m,
      headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) },
      body: b ? JSON.stringify(b) : undefined,
    })
  ).json();
const ok = async (...a) => {
  const r = await j(...a);
  if (r.ok !== 1) throw new Error(`${a[1]}: ${JSON.stringify(r.error)}`);
  return r.data;
};
let fails = 0;
const check = (c, m) => {
  console.log(c ? '  ok ' : '  FAIL', m);
  if (!c) fails++;
};
const adminUser = process.env.SMOKE_ADMIN ?? 'smoke_admin';
const login = await j('POST', '/auth/login', { username: adminUser, password: 'secret123' });
const gm =
  login.ok === 1
    ? login.data
    : (await j('POST', '/auth/register', { username: adminUser, email: `${adminUser}@example.test`, password: 'secret123', proof: await signUpProof(A) })).data;
if (!gm?.isAdmin) throw new Error(`${adminUser} is not an operator: add it to ADMIN_USERNAMES`);
const admin = gm.token;
async function lord(tag) {
  const u = tag + Date.now().toString(36).slice(-5);
  let t = (await ok('POST', '/auth/register', { username: u, password: 'password1', email: u + '@x.test', proof: await signUpProof(A) })).token;
  const c = await ok('POST', '/player', { userName: u, castleName: tag, flag: 'T', sex: 0 }, t);
  await ok('PUT', `/admin/cities/${c.castles[0].id}/buildings`, { playerId: c.playerInfo.id, positionId: 3, typeId: 23, level: 3 }, admin);
  return { t: c.token, city: c.castles[0].id };
}
const city = async (l) => (await ok('GET', `/cities/${l.city}`, null, l.t)).resource;
const a = await lord('mka'),
  b = await lord('mkb');
const book0 = await ok('GET', '/market/1', null, a.t);
// BALANCE.merchant.fixedPrice: the merchant trades everything at one price (no spread, no curve)
const fixed = book0.merchant.ask === book0.merchant.bid;
check(
  book0.merchant.ask >= book0.merchant.bid && book0.merchant.bid > 0,
  `merchant quotes lumber ${book0.merchant.bid.toFixed(3)} / ${book0.merchant.ask.toFixed(3)}${fixed ? ' (fixed)' : ''}`,
);
// market buy from merchant: instant
let r0 = await city(a);
const q = await ok('GET', `/market/1/quote?side=0&amount=10000&type=market`, null, a.t);
const buy = await ok('POST', `/cities/${a.city}/market/orders`, { resType: 1, side: 0, amount: 10000, type: 'market' }, a.t);
let r1 = await city(a);
check(buy.filled === 10000 && buy.merchantFilled === 10000 && buy.order === null, 'market buy filled by the merchant, nothing rests');
check(buy.gold === q.gold, `quote matched the trade (${q.gold} gold)`);
check(r1.wood.amount - r0.wood.amount === 10000 && r0.gold - r1.gold === buy.gold, 'goods and gold settled instantly');
const book1 = await ok('GET', '/market/1', null, a.t);
if (fixed) check(book1.merchant.reference === book0.merchant.reference, 'fixed merchant price unchanged by buying');
else check(book1.merchant.reference > book0.merchant.reference, 'buying raised the merchant price');
// market sell to merchant
r0 = r1;
const sell = await ok('POST', `/cities/${a.city}/market/orders`, { resType: 1, side: 1, amount: 10000, type: 'market' }, a.t);
r1 = await city(a);
check(
  sell.filled === 10000 && r1.gold - r0.gold === sell.gold && r0.wood.amount - r1.wood.amount === 10000,
  `market sell settled instantly (+${sell.gold} gold)`,
);
if (fixed)
  check(
    sell.gold === Math.round(10000 * book0.merchant.bid) && buy.gold > sell.gold,
    `sold at the fixed price; the round trip only cost the buyer's fee (${buy.gold - sell.gold} gold)`,
  );
else check(sell.gold < buy.gold, 'round trip lost the spread');
// limit order away from merchant rests; another lord fills it and is preferred over the merchant
const m = (await ok('GET', '/market/2', null, a.t)).merchant;
if (fixed) {
  // the merchant always pays its fixed price: a lower ask sells to it at that price straight away
  const floor = await ok('POST', `/cities/${b.city}/market/orders`, { resType: 2, side: 1, amount: 5000, price: Math.round(m.bid * 500) / 1000 }, b.t);
  check(floor.filled === 5000 && floor.merchantFilled === 5000 && floor.order === null, 'ask below the fixed price sold to the merchant');
  check(floor.gold === Math.round(5000 * m.bid), `seller got the fixed price, not their lower ask (${floor.gold} gold)`);
  // an offer above the fixed price rests, and buyers get the merchant's cheaper price instead
  const high = await ok('POST', `/cities/${b.city}/market/orders`, { resType: 2, side: 1, amount: 5000, price: Math.round(m.ask * 1500) / 1000 }, b.t);
  check(high.filled === 0 && high.order && high.rest === 5000, 'ask above the fixed price rests');
  const take = await ok('POST', `/cities/${a.city}/market/orders`, { resType: 2, side: 0, amount: 8000, type: 'market' }, a.t);
  check(take.playerFilled === 0 && take.merchantFilled === 8000, 'market buy filled by the cheaper merchant');
  await ok('DELETE', `/market/orders/${high.order.id}`, null, b.t);
  check((await ok('GET', '/market/orders/mine', null, b.t)).length === 0, "seller's offer cancelled");
} else {
  const offerPrice = Math.round(m.reference * 1000) / 1000; // inside the merchant's spread
  const rest = await ok('POST', `/cities/${b.city}/market/orders`, { resType: 2, side: 1, amount: 5000, price: offerPrice }, b.t);
  check(rest.filled === 0 && rest.order && rest.rest === 5000, `limit offer inside the spread rests (${offerPrice})`);
  const bGold0 = (await city(b)).gold;
  const take = await ok('POST', `/cities/${a.city}/market/orders`, { resType: 2, side: 0, amount: 8000, type: 'market' }, a.t);
  check(take.playerFilled === 5000 && take.merchantFilled === 3000, 'player offer taken first, merchant fills the rest');
  await new Promise((res) => setTimeout(res, 1500));
  check((await city(b)).gold - bGold0 === Math.floor(5000 * offerPrice), 'seller paid within a moment (zero-time shipment)');
  check((await ok('GET', '/market/orders/mine', null, b.t)).length === 0, "seller's filled order removed");
}
// limit buy below the bid rests and escrows
const lowBid = Math.round(m.bid * 0.5 * 1000) / 1000;
const g0 = (await city(a)).gold;
const lb = await ok('POST', `/cities/${a.city}/market/orders`, { resType: 2, side: 0, amount: 1000, price: lowBid }, a.t);
check(lb.filled === 0 && g0 - (await city(a)).gold === lb.escrow, 'limit bid below the merchant rests with escrow');
await ok('DELETE', `/market/orders/${lb.order.id}`, null, a.t);
check((await city(a)).gold === g0, 'cancel refunds escrow exactly');
const h = await ok('GET', '/market/2/history', null, a.t);
check(h.trades.length >= 2 && h.candles.length >= 1, `history: ${h.trades.length} trades, ${h.candles.length} candle(s)`);
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
