// (evony-re) Flows: a lord's saved series of actions (core FlowSchema), run on any of their cities.
// Each city runs in its own transaction: if any action fails there, everything the flow did in that
// city is rolled back and the other cities carry on. A preview runs the same way and always rolls back.

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
  type Flow,
  type FlowAction,
} from '@evony/core';
import { armies, timedEvents, type Db } from '@evony/db';
import { and, eq, inArray } from 'drizzle-orm';
import { cityStats, openOwnCity } from '../city.ts';
import { runGame, type Ctx } from '../context.ts';
import { citiesOf, getPlayer, savePlayer } from '../repo.ts';
import { appointMayor } from './heroes.ts';
import { sendArmy } from './armies.ts';
import { cureInjured, trainSplit } from './training.ts';

const MAX_FLOWS = 30;

/**
 * Saved flows with every default filled in (FlowSchema): flows saved before a field existed (a flow's
 * cities, a heal's "when") read as if it had its default, so API responses always match the schema.
 */
const withCities = (list: Flow[] | undefined): Flow[] =>
  (list ?? []).map((f) => {
    const parsed = FlowSchema.safeParse(f);
    if (parsed.success) return parsed.data;
    console.error('saved flow does not match FlowSchema', f.id, parsed.error.issues);
    return { ...f, cities: f.cities ?? 'all' };
  });

export async function listFlows(ctx: Ctx, playerId: number): Promise<Flow[]> {
  return withCities((await getPlayer(ctx, playerId)).misc.flows);
}

/** Create a flow, or replace the one with `id`. */
export async function saveFlow(
  ctx: Ctx,
  playerId: number,
  input: { id?: string | null; name: string; actions: unknown[]; cities?: 'all' | number[] },
): Promise<Flow[]> {
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
  const p = await getPlayer(ctx, playerId, { lock: true });
  const list = p.misc.flows ?? [];
  const existing = input.id ? list.find((f) => f.id === input.id) : undefined;
  if (input.id && !existing) throw new GameError('Flow not found.', -99, 404);
  if (!existing && list.length >= MAX_FLOWS) throw new GameError(`At most ${MAX_FLOWS} flows.`, -99);
  const flow: Flow = { id: existing?.id ?? `${ctx.now.toString(36)}${Math.floor(ctx.rng.next() * 1e6).toString(36)}`, name, actions, cities };
  p.misc = { ...p.misc, flows: existing ? list.map((f) => (f.id === flow.id ? flow : f)) : [...list, flow] };
  await savePlayer(ctx, p);
  return withCities(p.misc.flows);
}

export async function deleteFlow(ctx: Ctx, playerId: number, flowId: string): Promise<Flow[]> {
  const p = await getPlayer(ctx, playerId, { lock: true });
  p.misc = { ...p.misc, flows: (p.misc.flows ?? []).filter((f) => f.id !== flowId) };
  await savePlayer(ctx, p);
  return withCities(p.misc.flows);
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

export interface FlowStepResult {
  action: string;
  ok: boolean;
  /** what happened, or why it failed */
  detail: string;
  /** per-target outcomes of an attack action, e.g. "(204,406)" sent with a hero or skipped and why */
  items?: { label: string; ok: boolean; detail: string }[];
}
/** What an action did: a line, plus per-item outcomes for actions over several targets. */
type ActionOutcome = string | { detail: string; items: NonNullable<FlowStepResult['items']> };
export interface FlowCityResult {
  cityId: number;
  cityName: string;
  ok: boolean;
  /** the failure that rolled this city back */
  error: string | null;
  steps: FlowStepResult[];
}

const STAT_VALUE = { power: heroPower, management: heroManagement, stratagem: heroStratagem } as const;

/** Thrown at the end of a preview so its transaction rolls back. */
class PreviewRollback extends Error {}

/**
 * Attack this city's targets in order with the saved army, the idle heroes leading by Attack (strongest
 * first). A target is skipped, never failed, when the city lacks the troops, a hero or Rally Spot room,
 * or the target cannot be attacked now; its hero then leads the next target.
 */
/** What one city's run has done so far that later actions need: the armies it sent. */
interface CityRun {
  armyIds: number[];
}

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
  // an army still marching out needs about as long again to come back
  const homeBy = rows.reduce((t, r) => Math.max(t, r.direction === ArmyDirection.BACKWARD ? r.reachTime : r.reachTime + (r.reachTime - r.startTime)), 0);
  return { count: rows.length, homeBy };
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

async function runAction(ctx: Ctx, playerId: number, cityId: number, a: FlowAction, run: CityRun): Promise<ActionOutcome> {
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
  const max = maxTrainableCount(a.troopId, have, cityStats(b, ctx.now).idlePopulation);
  const count = a.amount === 'max' ? max : a.amount;
  if (count < 1) throw new GameError(`Cannot afford any ${name} (resources or idle population).`, -99);
  if (count > max) throw new GameError(`Can afford only ${max.toLocaleString('en')} ${name}, not ${count.toLocaleString('en')}.`, -99);
  const r = await trainSplit(ctx, playerId, cityId, a.troopId, count);
  const left = Math.max(0, r.finishAt - ctx.now);
  return `Training ${count.toLocaleString('en')} ${name} in ${r.batches.length} barracks${left > 0 ? `, done in ${Math.ceil(left / 1000).toLocaleString('en')}s` : ', done now'}`;
}

/**
 * Run a flow on each of `cityIds`, by default the flow's saved cities ('all': every city the lord has
 * now). Each city is its own transaction; a failure rolls back that city only.
 * With `preview`, every city is rolled back afterwards: the report shows what would happen.
 */
export async function runFlow(
  db: Db,
  playerId: number,
  flowId: string,
  cityIds: number[] | undefined,
  preview: boolean,
): Promise<{ preview: boolean; cities: FlowCityResult[] }> {
  const { flow, cities } = await runGame(db, async (ctx) => {
    const p = await getPlayer(ctx, playerId);
    const f = (p.misc.flows ?? []).find((x) => x.id === flowId);
    if (!f) throw new GameError('Flow not found.', -99, 404);
    const own = await citiesOf(ctx, playerId);
    return { flow: f, cities: own.map((c) => ({ id: c.id, name: c.name })) };
  });
  const names = new Map(cities.map((c) => [c.id, c.name]));
  const wanted = cityIds ?? (flow.cities === 'all' || flow.cities == null ? cities.map((c) => c.id) : flow.cities);
  const targets = [...new Set(wanted)].filter((id) => names.has(id));
  if (!targets.length) throw new GameError('Choose at least one of your cities.', -99);

  const out: FlowCityResult[] = [];
  for (const cityId of targets) {
    let steps: FlowStepResult[] = [];
    let error: string | null = null;
    try {
      await runGame(db, async (ctx) => {
        steps = [];
        const run: CityRun = { armyIds: [] };
        for (const a of flow.actions) {
          const action = describeFlowAction(a);
          try {
            const out = await runAction(ctx, playerId, cityId, a, run);
            steps.push(typeof out === 'string' ? { action, ok: true, detail: out } : { action, ok: true, ...out });
          } catch (err) {
            steps.push({ action, ok: false, detail: err instanceof Error ? err.message : String(err) });
            throw err;
          }
        }
        if (preview) throw new PreviewRollback();
      });
    } catch (err) {
      if (!(err instanceof PreviewRollback)) {
        // any failure (game rule or not) undoes the whole city
        error = err instanceof GameError ? err.message : 'Something went wrong; nothing was changed in this city.';
        if (!(err instanceof GameError)) console.error('flow run failed', err);
      }
    }
    out.push({ cityId, cityName: names.get(cityId)!, ok: error == null, error, steps });
  }
  return { preview, cities: out };
}
