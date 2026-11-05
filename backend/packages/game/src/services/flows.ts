// (marchlands) flow.* — listing, saving, deleting, running, repeating and stopping a lord's flows.
// How a run works: engine/flows.ts.

import { isDeepStrictEqual } from 'node:util';

import { and, eq } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  type Flow,
  FLOW_TROOP_IDS,
  FlowActionSchema,
  FlowActionType,
  FlowCities,
  type FlowCityChoice,
  type FlowCityResult,
  type FlowPreviewLog,
  type FlowRunLog,
  FlowSchema,
  type FlowSkippedCity,
  FlowStatus,
  GameError,
  msg,
} from '@marchlands/core';
import { type Db, flows as flowsTable } from '@marchlands/db';

import { type Ctx, runGame } from '#/context.ts';
import { type FlowRow, flowsOf, planCities, resumeRef, runPart, saveRow, startNext, stopRun, usesAllCities, waitStep } from '#/engine/flows.ts';
import { citiesOf, findCity, getPlayer } from '#/repo.ts';

const MAX_FLOWS = 30;
const MAX_NAME = 40;
const MIN_ACTIONS = 1;
const MAX_ACTIONS = 20;
export type FlowView = Flow &
  Pick<FlowRow, 'status' | 'nextAction' | 'runs' | 'queuedAt' | 'notBefore' | 'waitUntil' | 'heldSince' | 'stopReason'> & {
    lastRun: FlowRunLog | null;
    lastPreview: FlowPreviewLog | null;
  };

const isActive = (f: FlowRow) => f.status === FlowStatus.RUNNING || f.status === FlowStatus.WAITING;

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
    lastPreview: f.lastPreview ?? null,
  };
}

export async function listFlows(ctx: Ctx, playerId: number): Promise<FlowView[]> {
  return (await flowsOf(ctx, playerId)).map(view);
}

/** Create a flow, or replace the one with `id`. */
export async function saveFlow(
  ctx: Ctx,
  playerId: number,
  input: { id?: string | null; name: string; actions: unknown[]; cities?: FlowCityChoice },
): Promise<FlowView[]> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME) throw new GameError(msg('flow.nameLength', { max: MAX_NAME }), -99);
  if (input.actions.length < MIN_ACTIONS || input.actions.length > MAX_ACTIONS)
    throw new GameError(msg('flow.actionCount', { min: MIN_ACTIONS, max: MAX_ACTIONS }), -99);
  const actions = input.actions.map((a) => {
    const parsed = FlowActionSchema.safeParse(a);
    if (!parsed.success) throw new GameError(msg('flow.invalidAction'), -99);
    if (parsed.data.type === FlowActionType.TRAIN_TROOPS && !FLOW_TROOP_IDS.includes(parsed.data.troopId))
      throw new GameError(msg('common.invalidTroopType'), -99);
    return parsed.data;
  });
  // attack actions: a saved army, and targets on the map listed under the lord's own cities
  const attacks = actions.filter((a) => a.type === FlowActionType.ATTACK_TARGETS);
  if (attacks.length) {
    const p = await getPlayer(ctx, playerId);
    const own = new Set((await citiesOf(ctx, playerId)).map((c) => String(c.id)));
    const tiles = BALANCE.mapSize * BALANCE.mapSize;
    for (const a of attacks) {
      // no army yet is allowed (a farming list started from the map); it is skipped until one is chosen
      if (a.presetId && !(p.misc.armyPresets ?? []).some((x) => x.id === a.presetId)) throw new GameError(msg('flow.chooseArmy'), -99);
      for (const [city, list] of Object.entries(a.targets)) {
        if (!own.has(city)) {
          // a city that's gone is forgotten (a restart leaves the flows); one of another player's is refused
          if (/^[1-9]\d{0,8}$/.test(city) && !(await findCity(ctx, Number(city)))) {
            delete a.targets[city];
            continue;
          }
          throw new GameError(msg('flow.targetsOwnCities'), -99);
        }
        if (list.some((t) => !Number.isInteger(t) || t < 0 || t >= tiles)) throw new GameError(msg('common.invalidCoordinates'), -99);
        a.targets[city] = [...new Set(list)];
      }
    }
  }
  // chosen cities must be the lord's own (cities lost later are skipped when the flow runs)
  let cities: Flow['cities'] = FlowCities.ALL;
  if (Array.isArray(input.cities)) {
    const own = new Set((await citiesOf(ctx, playerId)).map((c) => c.id));
    cities = [...new Set(input.cities)].filter((id) => own.has(id));
    if (!cities.length) throw new GameError(msg('flow.chooseCities'), -99);
  }
  const list = await flowsOf(ctx, playerId, true);
  const existing = input.id ? list.find((f) => f.id === input.id) : undefined;
  if (input.id && !existing) throw new GameError(msg('flow.notFound'), -99, 404);
  if (existing) {
    // a run in progress continues by action index: its actions may change settings (targets, amounts), not order
    if (isActive(existing) && (existing.actions.length !== actions.length || existing.actions.some((a, i) => a.type !== actions[i]?.type)))
      throw new GameError(msg('flow.runningLocked'), -99);
    // a preview of other actions or cities no longer shows what the flow would do
    const same = isDeepStrictEqual([existing.actions, existing.cities], [actions, cities]);
    await saveRow(ctx, { ...existing, name, actions, cities, lastPreview: same ? existing.lastPreview : null });
  } else {
    if (list.length >= MAX_FLOWS) throw new GameError(msg('flow.tooMany', { count: MAX_FLOWS }), -99);
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

/** Thrown at the end of a preview so its transaction rolls back. */
class PreviewRollback extends Error {}

const runCitiesOf = async (ctx: Ctx, playerId: number, f: Pick<FlowRow, 'cities' | 'cityOverride' | 'actions'>) => (await planCities(ctx, playerId, f)).cities;

/**
 * Run a flow (Run button): it joins the queue, on `cityIds` for this run ('all', or by default the flow's
 * own cities), and starts now when no other flow is running. With `preview`, it runs up to the first wait
 * and every city is rolled back: the report shows what would happen.
 */
export async function runFlow(
  db: Db,
  playerId: number,
  flowId: string,
  cityIds: FlowCityChoice | undefined,
  preview: boolean,
): Promise<{ preview: boolean; flow: FlowView | null; cities: FlowCityResult[]; skippedCities: FlowSkippedCity[] }> {
  if (preview) {
    let cities: FlowCityResult[] = [];
    let skippedCities: FlowSkippedCity[] = [];
    try {
      await runGame(db, async (ctx) => {
        const saved = (await flowsOf(ctx, playerId)).find((x) => x.id === flowId);
        if (!saved) throw new GameError(msg('flow.notFound'), -99, 404);
        const f: FlowRow = { ...saved, cityOverride: cityIds ?? null, armyIds: {} };
        const plan = await planCities(ctx, playerId, f);
        f.runCities = plan.cities;
        skippedCities = plan.skipped;
        if (!f.runCities.length) throw new GameError(msg(usesAllCities(f) ? 'flow.noHeroCities' : 'flow.chooseCity'), -99);
        const waitAt = f.actions.findIndex((a) => a.type === FlowActionType.WAIT);
        const waitAction = f.actions[waitAt];
        cities = await runPart(ctx, playerId, f, 0, waitAt < 0 ? f.actions.length : waitAt);
        if (waitAction) {
          const rest = f.actions.length - waitAt - 1;
          const note = waitStep(waitAction, rest ? msg('flow.step.moreActions', { count: rest }) : msg('flow.step.runEnds'));
          cities = cities.map((c) => (c.ok ? { ...c, steps: [...c.steps, note] } : c));
        }
        throw new PreviewRollback();
      });
    } catch (err) {
      if (!(err instanceof PreviewRollback)) throw err;
    }
    // everything the preview did was rolled back; only its report is kept, so a reload still shows it
    await runGame(db, async (ctx) => {
      const lastPreview: FlowPreviewLog = { at: ctx.now, cities, skippedCities };
      const [f] = await ctx.tx
        .update(flowsTable)
        .set({ lastPreview })
        .where(and(eq(flowsTable.id, flowId), eq(flowsTable.playerId, playerId)))
        .returning({ status: flowsTable.status });
      if (f) ctx.push(playerId, PushCmd.FLOW_UPDATE, { flowId, status: f.status });
    });
    return { preview, flow: null, cities, skippedCities };
  }
  return runGame(db, async (ctx) => {
    const list = await flowsOf(ctx, playerId, true);
    const f = list.find((x) => x.id === flowId);
    if (!f) throw new GameError(msg('flow.notFound'), -99, 404);
    if (f.status !== FlowStatus.IDLE) throw new GameError(msg(f.status === FlowStatus.QUEUED ? 'flow.alreadyQueued' : 'flow.alreadyRunning'), -99);
    queue(ctx, f, cityIds ?? null);
    if (!(await runCitiesOf(ctx, playerId, f)).length) throw new GameError(msg(usesAllCities(f) ? 'flow.noHeroCities' : 'flow.chooseCity'), -99);
    await saveRow(ctx, f);
    const started = await startNext(ctx, playerId, list);
    const ran = started.get(f.id);
    return { preview, flow: view(f), cities: ran ?? [], skippedCities: ran ? (f.lastRun?.skippedCities ?? []) : [] };
  });
}

/** Put an idle flow at the back of the queue. */
function queue(ctx: Ctx, f: FlowRow, cityOverride: FlowCityChoice | null) {
  f.status = FlowStatus.QUEUED;
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
  if (!f) throw new GameError(msg('flow.notFound'), -99, 404);
  f.repeat = repeat;
  f.lastPreview = null;
  if (repeat && f.status === FlowStatus.IDLE) {
    queue(ctx, f, null);
    if (!(await runCitiesOf(ctx, playerId, f)).length) throw new GameError(msg(usesAllCities(f) ? 'flow.noHeroCities' : 'flow.noOwnCities'), -99);
  }
  // a repeat waiting in the queue for its next run (notBefore set) does not run again
  if (!repeat && f.status === FlowStatus.QUEUED && f.notBefore > 0) {
    f.status = FlowStatus.IDLE;
    f.cityOverride = null;
  }
  await saveRow(ctx, f);
  if (repeat) await startNext(ctx, playerId, list);
  return listFlows(ctx, playerId);
}

/** Stop a flow now: a run in progress ends where it is (nothing is undone), a queued flow leaves the queue, repeat goes off. */
export async function stopFlow(ctx: Ctx, playerId: number, flowId: string): Promise<FlowView[]> {
  const f = (await flowsOf(ctx, playerId, true)).find((x) => x.id === flowId);
  if (!f) throw new GameError(msg('flow.notFound'), -99, 404);
  await stopRun(ctx, playerId, f, null);
  return listFlows(ctx, playerId);
}
