// (marchlands) Flows: a lord's saved series of actions (core FlowSchema, table `flows`), run on any of
// their cities.
//
// A run goes action by action in every city; "wait" actions pause the whole flow (timed event
// 'flow.resume') and split it into parts. Each city runs a part in its own savepoint: if an action
// fails there, what the flow did in that city since the last wait is rolled back, the other cities
// finish the part, and the flow stops (repeat switched off). A repeating flow joins the queue again
// after each run (at most once a minute). Every flow operation locks all of the lord's flows first, so
// flows take turns a part at a time: a part (e.g. Attack mayor, train, Politics mayor) is one
// transaction nobody else sees half done, and other flows run during its waits. Before each part a flow
// is held until every hero of its cities is home (no army with a hero marching out or coming back);
// flows held earlier go first. A preview runs up to the first wait and rolls everything back; only its
// report is kept on the flow (until it runs, is edited or repeat is switched).

import { and, asc, eq, gt, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  ArmyDirection,
  BALANCE,
  buildingLevel,
  BuildingType,
  checkRequirements,
  dur,
  type FlowAction,
  flowActionMessage,
  type FlowCityResult,
  type FlowSkippedCity,
  type FlowStepResult,
  GameError,
  hasTroops,
  healCost,
  healHonorCost,
  heroHireCost,
  heroManagement,
  heroPower,
  HeroStatus,
  heroStratagem,
  hiredHeroName,
  maxTrainableCount,
  type Message,
  Mission,
  msg,
  ref,
  requirementsMet,
  tavernRefreshCost,
  tileXY,
  troopConfig,
  troopCostShare,
} from '@marchlands/core';
import { armies, flows as flowsTable, heroes as heroesTable, timedEvents } from '@marchlands/db';

import { cityStats, openOwnCity } from '#/city.ts';
import { type Ctx, isRetryable, savepoint } from '#/context.ts';
import { fillTavern, heroSlots, hireOffer, rerollTavern } from '#/engine/heroes.ts';
import { hasTrainingRoom } from '#/engine/training.ts';
import { pushResources } from '#/helpers.ts';
import { citiesOf, getPlayer, type HeroRow, saveCity } from '#/repo.ts';
import { sendArmy } from '#/services/armies.ts';
import { appointMayor } from '#/services/heroes.ts';
import { cureInjured, trainSplit } from '#/services/training.ts';

/** A repeating flow starts again no sooner than this after its last run started (real time). */
const REPEAT_MIN_GAP_MS = 60_000;

export type FlowRow = typeof flowsTable.$inferSelect;
export const resumeRef = (flowId: string) => `flow:${flowId}`;
const queueRef = (playerId: number) => `flowqueue:${playerId}`;

/** The lord's flows, oldest first. With `lock`, every one of them is locked (always in this order). */
export async function flowsOf(ctx: Ctx, playerId: number, lock = false): Promise<FlowRow[]> {
  const q = ctx.tx.select().from(flowsTable).where(eq(flowsTable.playerId, playerId)).orderBy(asc(flowsTable.createdAt), asc(flowsTable.id));
  return lock ? q.for('update') : q;
}

export async function saveRow(ctx: Ctx, f: FlowRow) {
  const { id, playerId, createdAt: _c, ...rest } = f;
  await ctx.tx.update(flowsTable).set(rest).where(eq(flowsTable.id, id));
  ctx.push(playerId, PushCmd.FLOW_UPDATE, { flowId: id, status: f.status });
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

/** What an action did: a line, plus per-item outcomes for actions over several targets. */
type ActionOutcome = Message | { detail: Message; items: NonNullable<FlowStepResult['items']> } | { detail: Message; skipped: true };

const STAT_VALUE = { power: heroPower, management: heroManagement, stratagem: heroStratagem } as const;

/** What one city's run has done so far that later actions need: the armies it sent. */
interface CityRun {
  armyIds: number[];
}

/**
 * Attack this city's targets in order with the saved army, the idle heroes leading by Attack (strongest
 * first). A target is skipped, never failed, when the city lacks the troops, a hero or Rally Spot room,
 * or the target cannot be attacked now; its hero then leads the next target.
 */
async function attackTargets(
  ctx: Ctx,
  playerId: number,
  cityId: number,
  a: Extract<FlowAction, { type: 'attackTargets' }>,
  run: CityRun,
): Promise<ActionOutcome> {
  const targets = a.targets[String(cityId)] ?? [];
  if (!targets.length) return msg('flow.step.noTargets');
  const preset = ((await getPlayer(ctx, playerId)).misc.armyPresets ?? []).find((x) => x.id === a.presetId);
  if (!preset) return msg(a.presetId ? 'flow.step.armyGone' : 'flow.step.noArmy');
  const start = await openOwnCity(ctx, playerId, cityId);
  const heroes = start.heroes.filter((h) => h.status === HeroStatus.IDLE).sort((x, y) => heroPower(y) - heroPower(x));
  const items: NonNullable<FlowStepResult['items']> = [];
  let next = 0;
  for (const tileId of targets) {
    const { x, y } = tileXY(tileId);
    const at = `(${x},${y})`;
    const hero = heroes[next];
    if (!hero) {
      items.push({ label: at, ok: false, detail: msg('flow.target.noIdleHero') });
      continue;
    }
    const b = await openOwnCity(ctx, playerId, cityId);
    if (!hasTroops(b.city.troops, preset.troops)) {
      items.push({ label: at, ok: false, detail: msg('flow.target.notEnoughTroops', { army: preset.name }) });
      continue;
    }
    try {
      // sendArmy checks everything before it changes anything, so a refusal leaves the city as it was
      const sent = await sendArmy(ctx, playerId, cityId, { targetTileId: tileId, mission: Mission.ATTACK, troops: preset.troops, heroId: hero.id });
      run.armyIds.push(sent.armyId);
      next++;
      items.push({ label: at, ok: true, detail: msg('flow.target.sent', { hero: hero.name }) });
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      items.push({ label: at, ok: false, detail: msg('flow.target.refused', { reason: err.msg }) });
    }
  }
  return { detail: msg('flow.step.sent', { sent: next, total: targets.length, army: preset.name }), items };
}

/** Heal every injured troop in the city (resources or honor); fails, rolling the city back, if it cannot pay for all of them. */
async function healAll(ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor'): Promise<Message> {
  const b = await openOwnCity(ctx, playerId, cityId);
  const injured = Object.fromEntries(Object.entries(b.city.injuredTroops).filter(([, n]) => n > 0)) as Record<string, number>;
  const total = Object.values(injured).reduce((s, n) => s + n, 0);
  if (!total) return msg('flow.step.noInjured');
  await cureInjured(ctx, playerId, cityId, injured, payWith);
  if (payWith === 'honor') return msg('flow.step.healedHonour', { count: total, honour: healHonorCost(injured) });
  const cost = (Object.entries(healCost(injured)) as [Parameters<typeof ref.resource>[0], number][])
    .filter(([, v]) => v > 0)
    .map(([k, v]) => msg('flow.resourceAmount', { amount: Math.ceil(v), resource: ref.resource(k) }));
  return msg('flow.step.healed', { count: total, cost });
}

/** Which of `armyIds` are still out (marching or coming home), and when the last is expected back. */
async function armiesAway(ctx: Ctx, armyIds: number[]): Promise<{ count: number; homeBy: number }> {
  if (!armyIds.length) return { count: 0, homeBy: 0 };
  const rows = await ctx.tx
    .select({ direction: armies.direction, startTime: armies.startTime, reachTime: armies.reachTime })
    .from(armies)
    .where(and(inArray(armies.id, armyIds), inArray(armies.direction, [ArmyDirection.FORWARD, ArmyDirection.BACKWARD])));
  return { count: rows.length, homeBy: homeByOf(rows) };
}

/** When the last of these moving armies is expected home: one still marching out needs about as long again to come back. */
const homeByOf = (rows: { direction: number; startTime: number; reachTime: number }[]) =>
  rows.reduce((t, r) => Math.max(t, r.direction === ArmyDirection.BACKWARD ? r.reachTime : r.reachTime + (r.reachTime - r.startTime)), 0);

/** Heroes of these cities leading an army that is marching out or coming home (stationed armies do not count), and when the last is expected back. */
async function heroesAway(ctx: Ctx, cityIds: number[]): Promise<{ count: number; homeBy: number }> {
  if (!cityIds.length) return { count: 0, homeBy: 0 };
  const rows = await ctx.tx
    .select({ direction: armies.direction, startTime: armies.startTime, reachTime: armies.reachTime })
    .from(armies)
    .where(and(inArray(armies.cityId, cityIds), isNotNull(armies.heroId), inArray(armies.direction, [ArmyDirection.FORWARD, ArmyDirection.BACKWARD])));
  return { count: rows.length, homeBy: homeByOf(rows) };
}

/**
 * Until when a flow must hold before its next actions (null: it may go now): while any hero of its
 * cities is away, or while another flow has been held longer (first held, first to go).
 */
async function holdUntil(ctx: Ctx, playerId: number, f: FlowRow): Promise<number | null> {
  const away = await heroesAway(ctx, f.runCities);
  if (away.count) return Math.max(away.homeBy, ctx.now + 5_000);
  const [ahead] = await ctx.tx
    .select({ id: flowsTable.id })
    .from(flowsTable)
    .where(and(eq(flowsTable.playerId, playerId), ne(flowsTable.id, f.id), gt(flowsTable.heldSince, 0), lt(flowsTable.heldSince, f.heldSince || ctx.now + 1)))
    .limit(1);
  return ahead ? ctx.now + 5_000 : null;
}

const healRef = (cityId: number) => `flowheal:${cityId}`;
const scheduleHeal = (ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor', armyIds: number[], dueAt: number) =>
  ctx.schedule({ type: 'flow.heal', dueAt, playerId, cityId, refKey: healRef(cityId), payload: { payWith, armyIds } });

/**
 * Heal once the armies this flow sent from the city are home (event 'flow.heal'), or now if it sent
 * none. A heal still waiting from an earlier run keeps waiting for that run's armies as well.
 */
async function healWhenHome(ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor', run: CityRun): Promise<Message> {
  const [pending] = await ctx.tx
    .select({ payload: timedEvents.payload })
    .from(timedEvents)
    .where(eq(timedEvents.refKey, healRef(cityId)));
  const earlier = ((pending?.payload as { armyIds?: unknown } | undefined)?.armyIds ?? []) as number[];
  const ids = [...new Set([...earlier.filter(Number.isInteger), ...run.armyIds])];
  const away = await armiesAway(ctx, ids);
  if (!away.count) {
    if (pending) ctx.unschedule(healRef(cityId));
    return healAll(ctx, playerId, cityId, payWith);
  }
  scheduleHeal(ctx, playerId, cityId, payWith, ids, away.homeBy);
  return msg('flow.step.healScheduled', { count: away.count, time: aboutFrom(ctx, away.homeBy) });
}

/** Timed event 'flow.heal': heal once the flow's armies are all home (waiting longer if some are still out). */
export async function runScheduledHeal(ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor', armyIds: number[]) {
  let name: string;
  try {
    name = (await openOwnCity(ctx, playerId, cityId)).city.name;
  } catch {
    return; // the city changed hands
  }
  const away = await armiesAway(ctx, armyIds);
  if (away.count) {
    scheduleHeal(ctx, playerId, cityId, payWith, armyIds, Math.max(away.homeBy, ctx.now + 5_000));
    return;
  }
  let told: Message;
  try {
    told = msg('flow.healDone', { city: name, result: await healAll(ctx, playerId, cityId, payWith) });
  } catch (err) {
    if (!(err instanceof GameError)) throw err;
    told = msg('flow.healFailed', { city: name, error: err.msg });
  }
  ctx.push(playerId, PushCmd.SYSTEM_INFO_MESSAGE, { alliance: false, tV: false, noSenderSystemInfo: false, msg: told });
}

const BASE_VALUE = { power: (h: HeroRow) => h.basePower, management: (h: HeroRow) => h.baseManagement, stratagem: (h: HeroRow) => h.baseStratagem } as const;

/**
 * Hire heroes born with at least `min` of an attribute from the city's Inn until the city has `count` of the player's
 * own heroes that good (the ones already there count): the best of its offers first, re-rolling it for gold until
 * enough are hired (or the Feasting Hall is full), the run's `maxGold` would be passed, the city is out of gold or it
 * has re-rolled BALANCE.flowHireMaxRerolls times. Each is named after what it was hired for (ATK - 76). Stopping short
 * isn't a failure: the step says why and the flow carries on, so a repeating flow goes on until every city has its count.
 */
async function hireHeroes(ctx: Ctx, playerId: number, cityId: number, a: Extract<FlowAction, { type: 'hireHeroes' }>): Promise<ActionOutcome> {
  const b = await openOwnCity(ctx, playerId, cityId);
  const inn = buildingLevel(b.city.buildings, BuildingType.INN);
  if (inn < 1) return { detail: msg('hero.needInn', { building: ref.building(BuildingType.INN) }), skipped: true };
  const base = BASE_VALUE[a.stat];
  const have = b.heroes.filter((h) => base(h) >= a.min).length;
  if (have >= a.count) return { detail: msg('flow.step.hireTargetMet', { count: have, stat: ref.stat(a.stat), min: a.min }), skipped: true };
  const want = Math.min(a.count - have, heroSlots(b) - b.heroes.length);
  if (want < 1) return { detail: msg('flow.step.hallFull', { building: ref.building(BuildingType.FEASTING_HALL) }), skipped: true };
  let offers = await fillTavern(ctx, b, false);
  let spent = 0;
  let rerolls = 0;
  let hired = 0;
  let stop: Message | null = null;
  for (;;) {
    for (const h of offers.filter((o) => base(o) >= a.min).sort((x, y) => base(y) - base(x))) {
      if (hired >= want) break;
      const cost = heroHireCost(h.level);
      if (spent + cost > a.maxGold) stop = msg('flow.hireStop.cap', { gold: a.maxGold });
      else if (b.city.gold < cost) stop = msg('flow.hireStop.gold');
      else {
        await hireOffer(ctx, b, h, hiredHeroName(a.stat, base(h)));
        spent += cost;
        hired++;
      }
    }
    // a good offer it couldn't pay for stays at the Inn rather than being re-rolled away
    if (hired >= want || stop) break;
    const cost = tavernRefreshCost(inn);
    if (rerolls >= BALANCE.flowHireMaxRerolls) stop = msg('flow.hireStop.rerolls', { count: rerolls });
    else if (spent + cost > a.maxGold) stop = msg('flow.hireStop.cap', { gold: a.maxGold });
    else if (b.city.gold < cost) stop = msg('flow.hireStop.gold');
    if (stop) break;
    offers = await rerollTavern(ctx, b);
    spent += cost;
    rerolls++;
  }
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  const said = { count: hired, stat: ref.stat(a.stat), min: a.min, gold: spent, rerolls: msg('flow.rerolls', { count: rerolls }) };
  if (hired >= want) return msg('flow.step.hired', said);
  const detail = msg('flow.step.hiredSome', { ...said, requested: want, reason: stop ?? msg('flow.hireStop.gold') });
  return hired ? detail : { detail, skipped: true };
}

async function runAction(ctx: Ctx, playerId: number, cityId: number, a: Exclude<FlowAction, { type: 'wait' }>, run: CityRun): Promise<ActionOutcome> {
  if (a.type === 'attackTargets') return attackTargets(ctx, playerId, cityId, a, run);
  if (a.type === 'hireHeroes') return hireHeroes(ctx, playerId, cityId, a);
  if (a.type === 'healTroops') return a.when === 'armiesHome' ? healWhenHome(ctx, playerId, cityId, a.payWith, run) : healAll(ctx, playerId, cityId, a.payWith);
  if (a.type === 'setMayor') {
    const b = await openOwnCity(ctx, playerId, cityId);
    const value = STAT_VALUE[a.stat];
    const stat = ref.stat(a.stat);
    // heroes at home and free: idle ones and the current mayor
    const candidates = b.heroes.filter((h) => h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR);
    if (!candidates.length) throw new GameError(msg('flow.noMayorHero'), -99);
    const best = candidates.reduce((top, h) => (value(h) > value(top) ? h : top));
    if (best.status === HeroStatus.MAYOR) return msg('flow.step.alreadyMayor', { hero: best.name, stat, value: value(best) });
    await appointMayor(ctx, playerId, best.id);
    return msg('flow.step.mayor', { hero: best.name, stat, value: value(best) });
  }
  const cfg = troopConfig(a.troopId);
  const troop = ref.troop(a.troopId);
  if (!cfg || cfg.inside !== 1) throw new GameError(msg('common.invalidTroopType'), -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  const checks = checkRequirements(cfg.requires, b.city.buildings, b.player.research, b.player.items);
  if (!requirementsMet(checks)) {
    const missing = checks
      .filter((c) => !c.ok)
      .map((c) =>
        c.kind === 'item'
          ? msg('flow.req.item', { name: ref.item(String(c.id)), amount: c.required })
          : msg('flow.req.level', { name: c.kind === 'building' ? ref.building(Number(c.id)) : ref.tech(Number(c.id)), level: c.required }),
      );
    throw new GameError(msg('flow.cannotTrain', { troop, missing }), -99);
  }
  const have = { gold: b.city.gold, food: b.city.food, wood: b.city.wood, stone: b.city.stone, iron: b.city.iron };
  const max = maxTrainableCount(a.troopId, have, cityStats(b, ctx.now).idlePopulation, troopCostShare(b.player.buffs, ctx.now));
  // what the city cannot do right now is skipped, not failed: as many as it can afford, up to the amount
  if (!hasTrainingRoom(b)) return { detail: msg('flow.step.noBarracksRoom'), skipped: true };
  const count = a.amount === 'max' ? max : Math.min(a.amount, max);
  if (count < 1) return { detail: msg('flow.step.cannotAfford', { troop }), skipped: true };
  const r = await trainSplit(ctx, playerId, cityId, a.troopId, count);
  const left = Math.max(0, r.finishAt - ctx.now);
  const barracks = r.batches.length;
  const time = dur(Math.ceil(left / 1000) * 1000);
  if (a.amount !== 'max' && count < a.amount) {
    const requested = a.amount;
    return left > 0
      ? msg('flow.step.trainingPartial', { amount: count, requested, troop, count: barracks, time })
      : msg('flow.step.trainingPartialDone', { amount: count, requested, troop, count: barracks });
  }
  return left > 0
    ? msg('flow.step.training', { amount: count, troop, count: barracks, time })
    : msg('flow.step.trainingDone', { amount: count, troop, count: barracks });
}

const citiesWanted = (f: Pick<FlowRow, 'cities' | 'cityOverride'>) => f.cityOverride ?? f.cities;
export const usesAllCities = (f: Pick<FlowRow, 'cities' | 'cityOverride'>) => citiesWanted(f) === 'all';

/**
 * Cities a run starts on: the ones chosen for it, or the flow's own. 'all' is every city the lord has
 * now that has a hero of theirs (a city just captured has none, and every mayor action would fail
 * there), or every city when the flow hires heroes; the others are `skipped`, with why, for the run's report.
 */
export async function planCities(
  ctx: Ctx,
  playerId: number,
  f: Pick<FlowRow, 'cities' | 'cityOverride' | 'actions'>,
): Promise<{ cities: number[]; skipped: FlowSkippedCity[] }> {
  const cityRows = await citiesOf(ctx, playerId);
  // a city being abandoned sends nothing more out: an army still away when its hour ends is lost
  const own = cityRows.filter((c) => !c.abandonAt);
  const wanted = citiesWanted(f);
  const leaving = cityRows
    .filter((c) => c.abandonAt && (wanted === 'all' || wanted.includes(c.id)))
    .map((c) => ({ cityId: c.id, cityName: c.name, reason: msg('flow.skipAbandoning') }));
  if (wanted === 'all' && f.actions.some((a) => a.type === 'hireHeroes')) return { cities: own.map((c) => c.id), skipped: leaving };
  if (wanted === 'all') {
    const rows = await ctx.tx.selectDistinct({ cityId: heroesTable.cityId }).from(heroesTable).where(eq(heroesTable.playerId, playerId));
    const withHero = new Set(rows.map((r) => r.cityId));
    return {
      cities: own.filter((c) => withHero.has(c.id)).map((c) => c.id),
      skipped: [...own.filter((c) => !withHero.has(c.id)).map((c) => ({ cityId: c.id, cityName: c.name, reason: msg('flow.skipNoHero') })), ...leaving],
    };
  }
  return { cities: [...new Set(wanted)].filter((id) => own.some((c) => c.id === id)), skipped: leaving };
}

/** Why a run has no cities. */
const noCitiesReason = (f: Pick<FlowRow, 'cities' | 'cityOverride'>) => msg(usesAllCities(f) ? 'flow.noHeroCities' : 'flow.noOwnCities');

/** A player lost a city: its list of targets goes from their flows, or saving them would be refused for naming a city not theirs. */
export async function dropCityTargets(ctx: Ctx, playerId: number, cityId: number) {
  const key = String(cityId);
  for (const f of await ctx.tx.select().from(flowsTable).where(eq(flowsTable.playerId, playerId)).for('update')) {
    if (!f.actions.some((a) => a.type === 'attackTargets' && key in a.targets)) continue;
    const actions = f.actions.map((a) =>
      a.type === 'attackTargets' ? { ...a, targets: Object.fromEntries(Object.entries(a.targets).filter(([city]) => city !== key)) } : a,
    );
    await ctx.tx.update(flowsTable).set({ actions }).where(eq(flowsTable.id, f.id));
    ctx.push(playerId, PushCmd.FLOW_UPDATE, { flowId: f.id, status: f.status });
  }
}

/**
 * A barbarian city was captured: take its tile off every flow's attack targets (any lord's), so no
 * farming list goes on attacking what is now a lord's city.
 */
export async function dropCapturedTarget(ctx: Ctx, tileId: number) {
  const listed = await ctx.tx
    .select()
    .from(flowsTable)
    .where(
      sql`jsonb_path_exists(${flowsTable.actions}, '$[*] ? (@.type == "attackTargets").targets.*[*] ? (@ == $t)', jsonb_build_object('t', ${tileId}::int))`,
    )
    .for('update');
  for (const f of listed) {
    const actions = f.actions.map((a) =>
      a.type === 'attackTargets'
        ? { ...a, targets: Object.fromEntries(Object.entries(a.targets).map(([city, list]) => [city, list.filter((t) => t !== tileId)])) }
        : a,
    );
    await ctx.tx.update(flowsTable).set({ actions }).where(eq(flowsTable.id, f.id));
    ctx.push(f.playerId, PushCmd.FLOW_UPDATE, { flowId: f.id, status: f.status });
  }
}

/**
 * Run actions [from, to) (no waits among them) in each of the run's cities, each city in a savepoint:
 * a failure rolls back that city's part. Cities the lord no longer holds, or is abandoning, are left out.
 */
export async function runPart(ctx: Ctx, playerId: number, f: FlowRow, from: number, to: number): Promise<FlowCityResult[]> {
  const names = new Map((await citiesOf(ctx, playerId)).filter((c) => !c.abandonAt).map((c) => [c.id, c.name]));
  const out: FlowCityResult[] = [];
  for (const cityId of f.runCities) {
    if (!names.has(cityId)) continue;
    const key = String(cityId);
    let steps: FlowStepResult[] = [];
    let error: Message | null = null;
    try {
      await savepoint(ctx, async (sp) => {
        steps = [];
        const run: CityRun = { armyIds: [...(f.armyIds[key] ?? [])] };
        for (const a of f.actions.slice(from, to)) {
          if (a.type === 'wait') continue;
          const action = flowActionMessage(a);
          try {
            const res = await runAction(sp, playerId, cityId, a, run);
            steps.push('code' in res ? { action, ok: true, detail: res } : { action, ok: true, ...res });
          } catch (err) {
            steps.push({ action, ok: false, detail: err instanceof GameError ? err.msg : msg('common.serverError') });
            throw err;
          }
        }
        f.armyIds = { ...f.armyIds, [key]: run.armyIds };
      });
    } catch (err) {
      if (isRetryable(err)) throw err;
      // any failure (game rule or not) undoes the city's part
      error = err instanceof GameError ? err.msg : msg('flow.cityFailed');
      if (!(err instanceof GameError)) console.error('flow run failed', err);
    }
    out.push({ cityId, cityName: names.get(cityId) ?? '', ok: error == null, error, steps });
  }
  return out;
}

/** Add a part's results to the run so far, city by city. */
function mergeResults(into: FlowCityResult[], part: FlowCityResult[]): FlowCityResult[] {
  const out = into.map((c) => ({ ...c, steps: [...c.steps] }));
  for (const r of part) {
    const c = out.find((x) => x.cityId === r.cityId);
    if (!c) out.push({ ...r, steps: [...r.steps] });
    else {
      c.steps.push(...r.steps);
      c.cityName = r.cityName;
      if (!r.ok) {
        c.ok = false;
        c.error = r.error;
      }
    }
  }
  return out;
}

/** A wait step, shown in every city of the run. */
export const waitStep = (a: FlowAction, detail: Message): FlowStepResult => ({ action: flowActionMessage(a), ok: true, detail });

/**
 * When a wait action ends: after its minutes, or once every army the run sent is home (null: none
 * are out, so there is nothing to wait for).
 */
async function waitEnd(ctx: Ctx, f: FlowRow, a: Extract<FlowAction, { type: 'wait' }>): Promise<number | null> {
  if (a.until === 'time') return ctx.now + a.minutes * 60_000;
  const away = await armiesAway(ctx, Object.values(f.armyIds).flat());
  return away.count ? Math.max(away.homeBy, ctx.now + 5_000) : null;
}

/** About how long until `at`, in whole minutes (at least one). */
const aboutFrom = (ctx: Ctx, at: number) => dur(Math.max(1, Math.ceil((at - ctx.now) / 60_000)) * 60_000);

/**
 * Carry a run on from its next action: parts run in every city, waits pause the flow (timed event
 * 'flow.resume'). Ends the run at the last action, or stops the flow when a city fails.
 * Returns what ran now, city by city.
 */
async function advance(ctx: Ctx, playerId: number, f: FlowRow): Promise<FlowCityResult[]> {
  let ran: FlowCityResult[] = [];
  const log = (part: FlowCityResult[]) => {
    ran = mergeResults(ran, part);
    if (f.lastRun) f.lastRun = { ...f.lastRun, cities: mergeResults(f.lastRun.cities, part) };
  };
  for (;;) {
    const waitAt = f.actions.findIndex((a, i) => i >= f.nextAction && a.type === 'wait');
    const end = waitAt < 0 ? f.actions.length : waitAt;
    if (end > f.nextAction) {
      const hold = await holdUntil(ctx, playerId, f);
      if (hold != null) {
        f.status = 'waiting';
        f.waitUntil = hold;
        f.heldSince ||= ctx.now;
        ctx.schedule({ type: 'flow.resume', dueAt: hold, playerId, refKey: resumeRef(f.id), payload: { flowId: f.id } });
        await saveRow(ctx, f);
        return ran;
      }
      f.heldSince = 0;
      const part = await runPart(ctx, playerId, f, f.nextAction, end);
      log(part);
      const failed = part.filter((c) => !c.ok);
      if (failed.length) {
        const cities = failed.map((c) => msg('flow.failedCity', { city: c.cityName, error: c.error ?? msg('flow.cityFailed') }));
        await stopRun(ctx, playerId, f, msg('flow.runFailed', { cities }));
        return ran;
      }
    }
    if (waitAt < 0) {
      await finishRun(ctx, playerId, f);
      return ran;
    }
    const w = f.actions[waitAt] as Extract<FlowAction, { type: 'wait' }>;
    const until = await waitEnd(ctx, f, w);
    f.nextAction = waitAt + 1;
    const step = waitStep(w, until == null ? msg('flow.step.noArmiesOut') : msg('flow.step.waiting', { time: aboutFrom(ctx, until) }));
    log(
      f.runCities.map((cityId) => ({
        cityId,
        cityName: f.lastRun?.cities.find((c) => c.cityId === cityId)?.cityName ?? '',
        ok: true,
        error: null,
        steps: [step],
      })),
    );
    if (until != null) {
      f.status = 'waiting';
      f.waitUntil = until;
      ctx.schedule({ type: 'flow.resume', dueAt: until, playerId, refKey: resumeRef(f.id), payload: { flowId: f.id } });
      await saveRow(ctx, f);
      return ran;
    }
  }
}

/** Start a run of a queued flow on its cities. */
async function startRun(ctx: Ctx, playerId: number, f: FlowRow): Promise<FlowCityResult[]> {
  const { cities, skipped } = await planCities(ctx, playerId, f);
  const names = new Map((await citiesOf(ctx, playerId)).map((c) => [c.id, c.name]));
  f.runs += 1;
  f.status = 'running';
  f.runStartedAt = ctx.now;
  f.heldSince = 0;
  f.nextAction = 0;
  f.waitUntil = 0;
  f.armyIds = {};
  f.runCities = cities;
  f.stopReason = null;
  f.lastPreview = null;
  f.lastRun = {
    run: f.runs,
    startedAt: ctx.now,
    finishedAt: null,
    cities: cities.map((cityId) => ({ cityId, cityName: names.get(cityId) ?? '', ok: true, error: null, steps: [] })),
    skippedCities: skipped,
  };
  if (!cities.length) {
    await stopRun(ctx, playerId, f, noCitiesReason(f));
    return [];
  }
  return advance(ctx, playerId, f);
}

/** The run reached its last action: queue the next run of a repeating flow, then start the next flow in the queue. */
async function finishRun(ctx: Ctx, playerId: number, f: FlowRow) {
  if (f.lastRun) f.lastRun = { ...f.lastRun, finishedAt: ctx.now };
  f.nextAction = 0;
  f.waitUntil = 0;
  f.heldSince = 0;
  if (f.repeat) {
    f.status = 'queued';
    f.queuedAt = ctx.now;
    f.notBefore = f.runStartedAt + REPEAT_MIN_GAP_MS;
  } else {
    f.status = 'idle';
    f.cityOverride = null;
  }
  await saveRow(ctx, f);
  if (f.repeat) nextInQueue(ctx, playerId);
}

/** End the run now. With a reason, the flow stopped on its own: repeat goes off and the lord is told why. */
export async function stopRun(ctx: Ctx, playerId: number, f: FlowRow, reason: Message | null) {
  if (f.lastRun && f.lastRun.finishedAt == null) f.lastRun = { ...f.lastRun, finishedAt: ctx.now };
  f.status = 'idle';
  f.repeat = false;
  f.nextAction = 0;
  f.waitUntil = 0;
  f.heldSince = 0;
  f.cityOverride = null;
  f.stopReason = reason;
  ctx.unschedule(resumeRef(f.id));
  await saveRow(ctx, f);
  if (reason)
    ctx.push(playerId, PushCmd.SYSTEM_INFO_MESSAGE, {
      alliance: false,
      tV: false,
      noSenderSystemInfo: false,
      msg: msg('flow.stopped', { name: f.name, reason }),
    });
}

/** Look at the queue now (timed event 'flow.queue'), in its own transaction. */
const nextInQueue = (ctx: Ctx, playerId: number) => ctx.schedule({ type: 'flow.queue', dueAt: ctx.now, playerId, refKey: queueRef(playerId) });

/**
 * Start every queued flow that may start now, oldest in the queue first (another flow waiting does not
 * hold them back); a queued repeat that may not start yet is looked at again when it may. Returns what
 * each flow started ran, by flow id.
 */
export async function startNext(ctx: Ctx, playerId: number, list: FlowRow[]): Promise<Map<string, FlowCityResult[]>> {
  const queued = list.filter((f) => f.status === 'queued').sort((a, b) => a.queuedAt - b.queuedAt || a.createdAt - b.createdAt);
  const started = new Map<string, FlowCityResult[]>();
  for (const f of queued) if (f.notBefore <= ctx.now) started.set(f.id, await startRun(ctx, playerId, f));
  const later = queued.filter((f) => f.status === 'queued' && f.notBefore > ctx.now);
  if (later.length) ctx.schedule({ type: 'flow.queue', dueAt: Math.min(...later.map((f) => f.notBefore)), playerId, refKey: queueRef(playerId) });
  return started;
}

/** Timed event 'flow.queue': flows held for their heroes go first, then queued runs start. */
export async function runQueue(ctx: Ctx, playerId: number) {
  const list = await flowsOf(ctx, playerId, true);
  await runHeld(ctx, playerId, list);
  await startNext(ctx, playerId, list);
}

/** Carry on flows held for their heroes, the longest held first; one still held keeps the later ones behind it. */
async function runHeld(ctx: Ctx, playerId: number, list: FlowRow[]) {
  for (const f of list.filter((x) => x.heldSince > 0 && x.status === 'waiting').sort((a, b) => a.heldSince - b.heldSince)) {
    f.status = 'running';
    f.waitUntil = 0;
    await advance(ctx, playerId, f);
    if (f.heldSince > 0) break;
  }
}

/** Timed event 'flow.resume': a wait ended (an "armies home" wait checks again while armies are still out). */
export async function resumeFlow(ctx: Ctx, playerId: number, flowId: string) {
  const list = await flowsOf(ctx, playerId, true);
  const f = list.find((x) => x.id === flowId);
  if (!f || f.status !== 'waiting') return;
  if (f.heldSince > 0) return runHeld(ctx, playerId, list);
  const w = f.actions[f.nextAction - 1];
  if (w?.type === 'wait' && w.until === 'armiesHome') {
    const until = await waitEnd(ctx, f, w);
    if (until != null) {
      f.waitUntil = until;
      ctx.schedule({ type: 'flow.resume', dueAt: until, playerId, refKey: resumeRef(f.id), payload: { flowId: f.id } });
      await saveRow(ctx, f);
      return;
    }
  }
  f.status = 'running';
  f.waitUntil = 0;
  await advance(ctx, playerId, f);
}
