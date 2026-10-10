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
// flows held earlier go first. A preview runs up to the first wait and rolls everything back.

import {
  checkRequirements,
  describeFlowAction,
  FLOW_STAT_LABEL,
  FLOW_TROOP_IDS,
  FlowActionSchema,
  FlowSchema,
  GameError,
  heroManagement,
  heroPower,
  heroStratagem,
  HeroStatus,
  maxTrainableCount,
  troopCostShare,
  requirementsMet,
  TROOP_NAMES,
  BUILDING_NAMES,
  TECH_NAMES,
  troopConfig,
  BALANCE,
  hasTroops,
  Mission,
  tileXY,
  ArmyDirection,
  healCost,
  healHonorCost,
  formatFlowMinutes,
  type Flow,
  type FlowAction,
  type FlowCityResult,
  type FlowRunLog,
  type FlowStepResult,
} from '@marchlands/core';
import { armies, flows as flowsTable, timedEvents, type Db } from '@marchlands/db';
import { and, asc, eq, gt, inArray, isNotNull, lt, ne } from 'drizzle-orm';
import { cityStats, openOwnCity } from '../city.ts';
import { isRetryable, runGame, savepoint, type Ctx } from '../context.ts';
import { citiesOf, getPlayer } from '../repo.ts';
import { appointMayor } from './heroes.ts';
import { sendArmy } from './armies.ts';
import { cureInjured, hasTrainingRoom, trainSplit } from './training.ts';

const MAX_FLOWS = 30;
/** A repeating flow starts again no sooner than this after its last run started (real time). */
const REPEAT_MIN_GAP_MS = 60_000;

type FlowRow = typeof flowsTable.$inferSelect;
export type FlowView = Flow &
  Pick<FlowRow, 'status' | 'nextAction' | 'runs' | 'queuedAt' | 'notBefore' | 'waitUntil' | 'heldSince' | 'stopReason'> & { lastRun: FlowRunLog | null };

const isActive = (f: FlowRow) => f.status === 'running' || f.status === 'waiting';
const resumeRef = (flowId: string) => `flow:${flowId}`;
const queueRef = (playerId: number) => `flowqueue:${playerId}`;

/**
 * A flow as the API shows it, every default filled in (FlowSchema): actions saved before a field
 * existed (a heal's "when") read as if they had their default, so responses always match the schema.
 */
function view(f: FlowRow): FlowView {
  const parsed = FlowSchema.safeParse({ id: f.id, name: f.name, actions: f.actions, cities: f.cities, repeat: f.repeat });
  if (!parsed.success) console.error('saved flow does not match FlowSchema', f.id, parsed.error.issues);
  const def = parsed.success ? parsed.data : { id: f.id, name: f.name, actions: f.actions, cities: f.cities, repeat: f.repeat };
  return {
    ...def,
    status: f.status,
    nextAction: f.nextAction,
    runs: f.runs,
    queuedAt: f.queuedAt,
    notBefore: f.notBefore,
    waitUntil: f.waitUntil,
    heldSince: f.heldSince,
    stopReason: f.stopReason,
    lastRun: f.lastRun ?? null,
  };
}

/** The lord's flows, oldest first. With `lock`, every one of them is locked (always in this order). */
async function flowsOf(ctx: Ctx, playerId: number, lock = false): Promise<FlowRow[]> {
  const q = ctx.tx.select().from(flowsTable).where(eq(flowsTable.playerId, playerId)).orderBy(asc(flowsTable.createdAt), asc(flowsTable.id));
  return lock ? q.for('update') : q;
}

async function saveRow(ctx: Ctx, f: FlowRow) {
  const { id, playerId, createdAt: _c, ...rest } = f;
  await ctx.tx.update(flowsTable).set(rest).where(eq(flowsTable.id, id));
  ctx.push(playerId, 'server.FlowUpdate', { flowId: id, status: f.status });
}

export async function listFlows(ctx: Ctx, playerId: number): Promise<FlowView[]> {
  return (await flowsOf(ctx, playerId)).map(view);
}

/** Create a flow, or replace the one with `id`. */
export async function saveFlow(
  ctx: Ctx,
  playerId: number,
  input: { id?: string | null; name: string; actions: unknown[]; cities?: 'all' | number[] },
): Promise<FlowView[]> {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new GameError('Give the flow a name of up to 40 characters.', -99);
  if (!input.actions.length || input.actions.length > 20) throw new GameError('A flow needs 1 to 20 actions.', -99);
  const actions = input.actions.map((a) => {
    const parsed = FlowActionSchema.safeParse(a);
    if (!parsed.success) throw new GameError('Invalid action.', -99);
    if (parsed.data.type === 'trainTroops' && !FLOW_TROOP_IDS.includes(parsed.data.troopId)) throw new GameError('Invalid troop type.', -99);
    return parsed.data;
  });
  // attack actions: a saved army, and targets on the map listed under the lord's own cities
  const attacks = actions.filter((a) => a.type === 'attackTargets');
  if (attacks.length) {
    const p = await getPlayer(ctx, playerId);
    const own = new Set((await citiesOf(ctx, playerId)).map((c) => String(c.id)));
    const tiles = BALANCE.mapSize * BALANCE.mapSize;
    for (const a of attacks) {
      // no army yet is allowed (a farming list started from the map); it is skipped until one is chosen
      if (a.presetId && !(p.misc.armyPresets ?? []).some((x) => x.id === a.presetId)) throw new GameError('Choose a saved army for the attack.', -99);
      for (const [city, list] of Object.entries(a.targets)) {
        if (!own.has(city)) throw new GameError('Targets can only be listed under your own cities.', -99);
        if (list.some((t) => !Number.isInteger(t) || t < 0 || t >= tiles)) throw new GameError('Invalid target coordinates.', -99);
        a.targets[city] = [...new Set(list)];
      }
    }
  }
  // chosen cities must be the lord's own (cities lost later are skipped when the flow runs)
  let cities: Flow['cities'] = 'all';
  if (Array.isArray(input.cities)) {
    const own = new Set((await citiesOf(ctx, playerId)).map((c) => c.id));
    cities = [...new Set(input.cities)].filter((id) => own.has(id));
    if (!cities.length) throw new GameError('Choose at least one of your cities, or all cities.', -99);
  }
  const list = await flowsOf(ctx, playerId, true);
  const existing = input.id ? list.find((f) => f.id === input.id) : undefined;
  if (input.id && !existing) throw new GameError('Flow not found.', -99, 404);
  if (existing) {
    // a run in progress continues by action index: its actions may change settings (targets, amounts), not order
    if (isActive(existing) && (existing.actions.length !== actions.length || existing.actions.some((a, i) => a.type !== actions[i].type)))
      throw new GameError('This flow is running: stop it to add, remove or reorder actions.', -99);
    await saveRow(ctx, { ...existing, name, actions, cities });
  } else {
    if (list.length >= MAX_FLOWS) throw new GameError(`At most ${MAX_FLOWS} flows.`, -99);
    const id = `${ctx.now.toString(36)}${Math.floor(ctx.rng.next() * 1e6).toString(36)}`;
    await ctx.tx.insert(flowsTable).values({ id, playerId, name, actions, cities, createdAt: ctx.now });
  }
  return listFlows(ctx, playerId);
}

export async function deleteFlow(ctx: Ctx, playerId: number, flowId: string): Promise<FlowView[]> {
  const f = (await flowsOf(ctx, playerId, true)).find((x) => x.id === flowId);
  if (f) {
    ctx.unschedule(resumeRef(f.id));
    await ctx.tx.delete(flowsTable).where(eq(flowsTable.id, f.id));
  }
  return listFlows(ctx, playerId);
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

/** What an action did: a line, plus per-item outcomes for actions over several targets. */
type ActionOutcome = string | { detail: string; items: NonNullable<FlowStepResult['items']> } | { detail: string; skipped: true };

const STAT_VALUE = { power: heroPower, management: heroManagement, stratagem: heroStratagem } as const;

/** Thrown at the end of a preview so its transaction rolls back. */
class PreviewRollback extends Error {}

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
  if (!targets.length) return 'No targets listed for this city';
  const preset = ((await getPlayer(ctx, playerId)).misc.armyPresets ?? []).find((x) => x.id === a.presetId);
  if (!preset) return a.presetId ? 'Skipped: the saved army no longer exists' : 'Skipped: choose a saved army for this action in the Flows tab';
  const start = await openOwnCity(ctx, playerId, cityId);
  const heroes = start.heroes
    .filter((h) => h.playerId === playerId && h.capturedByPlayerId == null && h.status === HeroStatus.IDLE)
    .sort((x, y) => heroPower(y) - heroPower(x));
  const items: NonNullable<FlowStepResult['items']> = [];
  let next = 0;
  for (const tileId of targets) {
    const { x, y } = tileXY(tileId);
    const at = `(${x},${y})`;
    const hero = heroes[next];
    if (!hero) {
      items.push({ label: at, ok: false, detail: 'skipped: no idle hero left' });
      continue;
    }
    const b = await openOwnCity(ctx, playerId, cityId);
    if (!hasTroops(b.city.troops, preset.troops)) {
      items.push({ label: at, ok: false, detail: `skipped: not enough troops for "${preset.name}"` });
      continue;
    }
    try {
      // sendArmy checks everything before it changes anything, so a refusal leaves the city as it was
      const sent = await sendArmy(ctx, playerId, cityId, { targetTileId: tileId, mission: Mission.ATTACK, troops: preset.troops, heroId: hero.id });
      run.armyIds.push(sent.armyId);
      next++;
      items.push({ label: at, ok: true, detail: `sent with ${hero.name}` });
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      items.push({ label: at, ok: false, detail: `skipped: ${err.message}` });
    }
  }
  return { detail: `Sent ${next} of ${targets.length} with "${preset.name}"`, items };
}

/** Heal every injured troop in the city (resources or honor); fails, rolling the city back, if it cannot pay for all of them. */
async function healAll(ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor'): Promise<string> {
  const b = await openOwnCity(ctx, playerId, cityId);
  const injured = Object.fromEntries(Object.entries(b.city.injuredTroops).filter(([, n]) => (n ?? 0) > 0)) as Record<string, number>;
  const total = Object.values(injured).reduce((s, n) => s + n, 0);
  if (!total) return 'No injured troops';
  await cureInjured(ctx, playerId, cityId, injured, payWith);
  const cost =
    payWith === 'honor'
      ? `${healHonorCost(injured).toLocaleString('en')} honor`
      : Object.entries(healCost(injured))
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${Math.ceil(v).toLocaleString('en')} ${k === 'wood' ? 'lumber' : k}`)
          .join(', ');
  return `Healed ${total.toLocaleString('en')} troops for ${cost}`;
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
async function healWhenHome(ctx: Ctx, playerId: number, cityId: number, payWith: 'resources' | 'honor', run: CityRun): Promise<string> {
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
  const mins = Math.max(1, Math.ceil((away.homeBy - ctx.now) / 60_000));
  return `Scheduled: heals when the ${away.count} arm${away.count === 1 ? 'y' : 'ies'} this flow sent ${away.count === 1 ? 'is' : 'are'} home (~${mins.toLocaleString('en')}m)`;
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
  let msg: string;
  try {
    msg = `${name}: ${await healAll(ctx, playerId, cityId, payWith)}`;
  } catch (err) {
    if (!(err instanceof GameError)) throw err;
    msg = `${name}: could not heal after the armies came home (${err.message})`;
  }
  ctx.push(playerId, 'server.SystemInfoMsg', { alliance: false, tV: false, noSenderSystemInfo: false, msg });
}

async function runAction(ctx: Ctx, playerId: number, cityId: number, a: Exclude<FlowAction, { type: 'wait' }>, run: CityRun): Promise<ActionOutcome> {
  if (a.type === 'attackTargets') return attackTargets(ctx, playerId, cityId, a, run);
  if (a.type === 'healTroops') return a.when === 'armiesHome' ? healWhenHome(ctx, playerId, cityId, a.payWith, run) : healAll(ctx, playerId, cityId, a.payWith);
  if (a.type === 'setMayor') {
    const b = await openOwnCity(ctx, playerId, cityId);
    const value = STAT_VALUE[a.stat];
    const label = FLOW_STAT_LABEL[a.stat];
    // heroes at home and free: idle ones and the current mayor
    const candidates = b.heroes.filter(
      (h) => h.playerId === playerId && h.capturedByPlayerId == null && (h.status === HeroStatus.IDLE || h.status === HeroStatus.MAYOR),
    );
    if (!candidates.length) throw new GameError('No hero in the city can be mayor.', -99);
    const best = candidates.reduce((top, h) => (value(h) > value(top) ? h : top));
    if (best.status === HeroStatus.MAYOR) return `${best.name} is already mayor (${label} ${value(best)})`;
    await appointMayor(ctx, playerId, best.id);
    return `Mayor: ${best.name} (${label} ${value(best)})`;
  }
  const cfg = troopConfig(a.troopId);
  const name = TROOP_NAMES[a.troopId] ?? `Unit ${a.troopId}`;
  if (!cfg || cfg.inside !== 1) throw new GameError('Invalid troop type.', -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  const checks = checkRequirements(cfg.requires, b.city.buildings, b.player.research, b.player.items);
  if (!requirementsMet(checks)) {
    const missing = checks
      .filter((c) => !c.ok)
      .map(
        (c) =>
          `${c.kind === 'building' ? BUILDING_NAMES[Number(c.id)] : c.kind === 'tech' ? TECH_NAMES[Number(c.id)] : c.id} ${c.kind === 'item' ? `×${c.required}` : `Lv ${c.required}`}`,
      );
    throw new GameError(`${name} cannot be trained here (needs ${missing.join(', ')}).`, -99);
  }
  const have = { gold: b.city.gold, food: b.city.food, wood: b.city.wood, stone: b.city.stone, iron: b.city.iron };
  const max = maxTrainableCount(a.troopId, have, cityStats(b, ctx.now).idlePopulation, troopCostShare(b.player.buffs, ctx.now));
  // what the city cannot do right now is skipped, not failed: as many as it can afford, up to the amount
  if (!hasTrainingRoom(b)) return { detail: 'Skipped: no barracks queue has room', skipped: true };
  const count = a.amount === 'max' ? max : Math.min(a.amount, max);
  if (count < 1) return { detail: `Skipped: cannot afford any ${name} (resources or idle population)`, skipped: true };
  const r = await trainSplit(ctx, playerId, cityId, a.troopId, count);
  const left = Math.max(0, r.finishAt - ctx.now);
  const short = a.amount !== 'max' && count < a.amount ? ` (only ${count.toLocaleString('en')} of ${a.amount.toLocaleString('en')} affordable)` : '';
  return `Training ${count.toLocaleString('en')} ${name}${short} in ${r.batches.length} barracks${left > 0 ? `, done in ${Math.ceil(left / 1000).toLocaleString('en')}s` : ', done now'}`;
}

/** Cities a run starts on: the ones chosen for it, or the flow's own ('all': every city the lord has now). */
async function runCitiesOf(ctx: Ctx, playerId: number, f: Pick<FlowRow, 'cities' | 'cityOverride'>): Promise<number[]> {
  const own = (await citiesOf(ctx, playerId)).map((c) => c.id);
  const wanted = f.cityOverride ?? (f.cities === 'all' || f.cities == null ? own : f.cities);
  return [...new Set(wanted)].filter((id) => own.includes(id));
}

/**
 * Run actions [from, to) (no waits among them) in each of the run's cities, each city in a savepoint:
 * a failure rolls back that city's part. Cities the lord no longer holds are left out.
 */
async function runPart(ctx: Ctx, playerId: number, f: FlowRow, from: number, to: number): Promise<FlowCityResult[]> {
  const names = new Map((await citiesOf(ctx, playerId)).map((c) => [c.id, c.name]));
  const out: FlowCityResult[] = [];
  for (const cityId of f.runCities) {
    if (!names.has(cityId)) continue;
    const key = String(cityId);
    let steps: FlowStepResult[] = [];
    let error: string | null = null;
    try {
      await savepoint(ctx, async (sp) => {
        steps = [];
        const run: CityRun = { armyIds: [...(f.armyIds[key] ?? [])] };
        for (const a of f.actions.slice(from, to)) {
          if (a.type === 'wait') continue;
          const action = describeFlowAction(a);
          try {
            const res = await runAction(sp, playerId, cityId, a, run);
            steps.push(typeof res === 'string' ? { action, ok: true, detail: res } : { action, ok: true, ...res });
          } catch (err) {
            steps.push({ action, ok: false, detail: err instanceof Error ? err.message : String(err) });
            throw err;
          }
        }
        f.armyIds = { ...f.armyIds, [key]: run.armyIds };
      });
    } catch (err) {
      if (isRetryable(err)) throw err;
      // any failure (game rule or not) undoes the city's part
      error = err instanceof GameError ? err.message : 'Something went wrong; nothing was changed in this city.';
      if (!(err instanceof GameError)) console.error('flow run failed', err);
    }
    out.push({ cityId, cityName: names.get(cityId)!, ok: error == null, error, steps });
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
const waitStep = (a: FlowAction, detail: string): FlowStepResult => ({ action: describeFlowAction(a), ok: true, detail });

/**
 * When a wait action ends: after its minutes, or once every army the run sent is home (null: none
 * are out, so there is nothing to wait for).
 */
async function waitEnd(ctx: Ctx, f: FlowRow, a: Extract<FlowAction, { type: 'wait' }>): Promise<number | null> {
  if (a.until === 'time') return ctx.now + a.minutes * 60_000;
  const away = await armiesAway(ctx, Object.values(f.armyIds).flat());
  return away.count ? Math.max(away.homeBy, ctx.now + 5_000) : null;
}

const minutesFrom = (ctx: Ctx, at: number) => `~${formatFlowMinutes(Math.max(1, Math.ceil((at - ctx.now) / 60_000)))}`;

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
        await stopRun(ctx, playerId, f, `failed in ${failed.map((c) => `${c.cityName} (${c.error})`).join(', ')}`);
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
    const step = waitStep(w, until == null ? 'No armies out: carried on' : `Waiting ${minutesFrom(ctx, until)}`);
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
  const cities = await runCitiesOf(ctx, playerId, f);
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
  f.lastRun = {
    run: f.runs,
    startedAt: ctx.now,
    finishedAt: null,
    cities: cities.map((cityId) => ({ cityId, cityName: names.get(cityId)!, ok: true, error: null, steps: [] })),
  };
  if (!cities.length) {
    await stopRun(ctx, playerId, f, 'none of its cities are yours any more');
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
async function stopRun(ctx: Ctx, playerId: number, f: FlowRow, reason: string | null) {
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
    ctx.push(playerId, 'server.SystemInfoMsg', { alliance: false, tV: false, noSenderSystemInfo: false, msg: `Flow "${f.name}" stopped: ${reason}.` });
}

/** Look at the queue now (timed event 'flow.queue'), in its own transaction. */
const nextInQueue = (ctx: Ctx, playerId: number) => ctx.schedule({ type: 'flow.queue', dueAt: ctx.now, playerId, refKey: queueRef(playerId) });

/**
 * Start every queued flow that may start now, oldest in the queue first (another flow waiting does not
 * hold them back); a queued repeat that may not start yet is looked at again when it may. Returns what
 * each flow started ran, by flow id.
 */
async function startNext(ctx: Ctx, playerId: number, list: FlowRow[]): Promise<Map<string, FlowCityResult[]>> {
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

/**
 * Run a flow (Run button): it joins the queue, on `cityIds` for this run (by default the flow's own
 * cities), and starts now when no other flow is running. With `preview`, it runs up to the first wait
 * and every city is rolled back: the report shows what would happen.
 */
export async function runFlow(
  db: Db,
  playerId: number,
  flowId: string,
  cityIds: number[] | undefined,
  preview: boolean,
): Promise<{ preview: boolean; flow: FlowView | null; cities: FlowCityResult[] }> {
  if (preview) {
    let cities: FlowCityResult[] = [];
    try {
      await runGame(db, async (ctx) => {
        const saved = (await flowsOf(ctx, playerId)).find((x) => x.id === flowId);
        if (!saved) throw new GameError('Flow not found.', -99, 404);
        const f: FlowRow = { ...saved, cityOverride: cityIds ?? null, armyIds: {} };
        f.runCities = await runCitiesOf(ctx, playerId, f);
        if (!f.runCities.length) throw new GameError('Choose at least one of your cities.', -99);
        const waitAt = f.actions.findIndex((a) => a.type === 'wait');
        cities = await runPart(ctx, playerId, f, 0, waitAt < 0 ? f.actions.length : waitAt);
        if (waitAt >= 0) {
          const rest = f.actions.length - waitAt - 1;
          const note = waitStep(f.actions[waitAt], rest ? `then ${rest} more action${rest === 1 ? '' : 's'} (not previewed)` : 'then the run ends');
          cities = cities.map((c) => (c.ok ? { ...c, steps: [...c.steps, note] } : c));
        }
        throw new PreviewRollback();
      });
    } catch (err) {
      if (!(err instanceof PreviewRollback)) throw err;
    }
    return { preview, flow: null, cities };
  }
  return runGame(db, async (ctx) => {
    const list = await flowsOf(ctx, playerId, true);
    const f = list.find((x) => x.id === flowId);
    if (!f) throw new GameError('Flow not found.', -99, 404);
    if (f.status !== 'idle') throw new GameError(f.status === 'queued' ? 'This flow is already queued.' : 'This flow is already running.', -99);
    queue(ctx, f, cityIds ?? null);
    if (!(await runCitiesOf(ctx, playerId, f)).length) throw new GameError('Choose at least one of your cities.', -99);
    await saveRow(ctx, f);
    const started = await startNext(ctx, playerId, list);
    return { preview, flow: view(f), cities: started.get(f.id) ?? [] };
  });
}

/** Put an idle flow at the back of the queue. */
function queue(ctx: Ctx, f: FlowRow, cityOverride: number[] | null) {
  f.status = 'queued';
  f.queuedAt = ctx.now;
  f.notBefore = 0;
  f.cityOverride = cityOverride;
  f.stopReason = null;
}

/**
 * The repeat switch. On: the flow runs again after every run until a run fails or the switch goes
 * off; an idle flow joins the queue now. Off: the current run (if any) finishes and the flow stops.
 */
export async function setRepeat(ctx: Ctx, playerId: number, flowId: string, repeat: boolean): Promise<FlowView[]> {
  const list = await flowsOf(ctx, playerId, true);
  const f = list.find((x) => x.id === flowId);
  if (!f) throw new GameError('Flow not found.', -99, 404);
  f.repeat = repeat;
  if (repeat && f.status === 'idle') {
    queue(ctx, f, null);
    if (!(await runCitiesOf(ctx, playerId, f)).length) throw new GameError("None of the flow's cities are yours any more.", -99);
  }
  // a repeat waiting in the queue for its next run (notBefore set) does not run again
  if (!repeat && f.status === 'queued' && f.notBefore > 0) {
    f.status = 'idle';
    f.cityOverride = null;
  }
  await saveRow(ctx, f);
  if (repeat) await startNext(ctx, playerId, list);
  return listFlows(ctx, playerId);
}

/** Stop a flow now: a run in progress ends where it is (nothing is undone), a queued flow leaves the queue, repeat goes off. */
export async function stopFlow(ctx: Ctx, playerId: number, flowId: string): Promise<FlowView[]> {
  const f = (await flowsOf(ctx, playerId, true)).find((x) => x.id === flowId);
  if (!f) throw new GameError('Flow not found.', -99, 404);
  await stopRun(ctx, playerId, f, null);
  return listFlows(ctx, playerId);
}
