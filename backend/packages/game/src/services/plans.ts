// (marchlands) Wave plans (docs/features/camp-times.md, phases 2 and 3): waves from a player's cities, or from their
// alliance's when the plan is shared, set to land on one target in one second, in the plan's order. Each wave lands
// its place in the order in milliseconds into that second (armies landing together fight in landing order), so the
// order holds whoever sends first. Each player sends their own waves; nothing is sent for them.

import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import type { AddPlanWaveBody, CreatePlanBody, PlanBean } from '@marchlands/contracts';
import { BALANCE, dur, GameError, Mission, msg, sanitizeTroops, tileXY } from '@marchlands/core';
import { cities, heroes, one, players, warPlans, warPlanWaves } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { cleanName } from '#/helpers.ts';
import { getCity, getPlayer, getTile } from '#/repo.ts';
import { marchEstimate, sendArmy } from '#/services/armies.ts';

type PlanRow = typeof warPlans.$inferSelect;
type WaveRow = typeof warPlanWaves.$inferSelect;

/** Plans still worth showing: landing no longer ago than BALANCE.warPlans.keepMs. */
const live = (ctx: Ctx) => gt(warPlans.landAt, ctx.now - BALANCE.warPlans.keepMs);

/** The plans a player can see: their own, and those shared with their alliance. */
async function visiblePlans(ctx: Ctx, playerId: number): Promise<PlanRow[]> {
  const { allianceId } = await getPlayer(ctx, playerId);
  const whose = allianceId == null ? eq(warPlans.playerId, playerId) : or(eq(warPlans.playerId, playerId), eq(warPlans.allianceId, allianceId));
  return ctx.tx
    .select()
    .from(warPlans)
    .where(and(whose, live(ctx)))
    .orderBy(asc(warPlans.landAt), asc(warPlans.id));
}

/** A plan the player can see, locked; refused otherwise. */
async function planFor(ctx: Ctx, playerId: number, planId: number): Promise<PlanRow> {
  const { allianceId } = await getPlayer(ctx, playerId);
  const [plan] = await ctx.tx.select().from(warPlans).where(eq(warPlans.id, planId)).for('update');
  if (!plan || (plan.playerId !== playerId && (plan.allianceId == null || plan.allianceId !== allianceId)))
    throw new GameError(msg('army.planNotFound'), -99, 404);
  return plan;
}

async function waveOf(ctx: Ctx, plan: PlanRow, waveId: number): Promise<WaveRow> {
  const [wave] = await ctx.tx
    .select()
    .from(warPlanWaves)
    .where(and(eq(warPlanWaves.id, waveId), eq(warPlanWaves.planId, plan.id)));
  if (!wave) throw new GameError(msg('army.planNotFound'), -99, 404);
  return wave;
}

/** The player's plans and the ones shared with their alliance, each with its waves in landing order. */
export async function list(ctx: Ctx, playerId: number): Promise<PlanBean[]> {
  const plans = await visiblePlans(ctx, playerId);
  if (!plans.length) return [];
  const waves = await ctx.tx
    .select()
    .from(warPlanWaves)
    .where(
      inArray(
        warPlanWaves.planId,
        plans.map((p) => p.id),
      ),
    )
    .orderBy(asc(warPlanWaves.position));
  const playerIds = [...new Set([...plans.map((p) => p.playerId), ...waves.map((w) => w.playerId)])];
  const names = new Map(
    (await ctx.tx.select({ id: players.id, name: players.name }).from(players).where(inArray(players.id, playerIds))).map((p) => [p.id, p.name]),
  );
  const cityIds = [...new Set(waves.map((w) => w.cityId))];
  const cityNames = new Map(
    cityIds.length
      ? (await ctx.tx.select({ id: cities.id, name: cities.name }).from(cities).where(inArray(cities.id, cityIds))).map((c) => [c.id, c.name])
      : [],
  );
  const heroIds = waves.flatMap((w) => (w.playerId === playerId && w.heroId != null ? [w.heroId] : []));
  const heroNames = new Map(
    heroIds.length
      ? (await ctx.tx.select({ id: heroes.id, name: heroes.name }).from(heroes).where(inArray(heroes.id, heroIds))).map((h) => [h.id, h.name])
      : [],
  );
  const out: PlanBean[] = [];
  for (const p of plans) {
    const { x, y } = tileXY(p.targetTileId);
    const own = waves.filter((w) => w.planId === p.id);
    const beans = [];
    for (const w of own) {
      // the player's own unsent waves: how long they march now, so when they must leave
      const mine = w.playerId === playerId && w.armyId == null;
      const marchMs = mine ? (await marchEstimate(ctx, playerId, w.cityId, p.targetTileId, w.troops)).marchTime : null;
      beans.push({
        id: w.id,
        playerId: w.playerId,
        player: names.get(w.playerId) ?? '',
        cityId: w.cityId,
        city: cityNames.get(w.cityId) ?? '',
        heroId: w.heroId,
        hero: w.playerId === playerId && w.heroId != null ? (heroNames.get(w.heroId) ?? null) : null,
        mission: w.mission,
        troops: w.troops,
        position: w.position,
        armyId: w.armyId,
        marchMs,
      });
    }
    out.push({
      id: p.id,
      name: p.name,
      playerId: p.playerId,
      player: names.get(p.playerId) ?? '',
      shared: p.allianceId != null,
      targetTileId: p.targetTileId,
      x,
      y,
      landAt: p.landAt,
      waves: beans,
    });
  }
  return out;
}

/** A landing second as given (rounded down to the second): in the future, and at most BALANCE.landAtMaxAheadMs ahead. */
function landingSecond(ctx: Ctx, raw: number): number {
  const landAt = Math.floor(raw / 1000) * 1000;
  if (landAt <= ctx.now || landAt - ctx.now > BALANCE.landAtMaxAheadMs)
    throw new GameError(msg('army.planLandAt', { time: dur(BALANCE.landAtMaxAheadMs) }), -99);
  return landAt;
}

/** A plan's name, target and alliance (if shared) as the player gave them, checked. */
async function planFields(ctx: Ctx, playerId: number, body: Omit<CreatePlanBody, 'landAt'>) {
  const player = await getPlayer(ctx, playerId);
  const name = cleanName(body.name, 1, 40, msg('common.name'));
  await getTile(ctx, body.targetTileId);
  if (body.shared && player.allianceId == null) throw new GameError(msg('army.planNoAlliance'), -99);
  return { name, targetTileId: body.targetTileId, allianceId: body.shared ? player.allianceId : null };
}

/** A new plan: a target and the second its waves land, the player's own or shared with their alliance. */
export async function create(ctx: Ctx, playerId: number, body: CreatePlanBody) {
  const fields = { ...(await planFields(ctx, playerId, body)), landAt: landingSecond(ctx, body.landAt) };
  const mine = (await visiblePlans(ctx, playerId)).filter((p) => p.playerId === playerId);
  if (mine.length >= BALANCE.warPlans.maxPlans) throw new GameError(msg('army.planLimit', { count: BALANCE.warPlans.maxPlans }), -99);
  const plan = one(
    await ctx.tx
      .insert(warPlans)
      .values({ playerId, ...fields, createdAt: ctx.now })
      .returning(),
  );
  return { id: plan.id };
}

/**
 * Changes a plan (its maker only): its name and sharing at any time; its target and landing second only while none of
 * its waves is sent (a sent wave's army is set to land there, then). It stays shared while other players have waves in
 * it, which they'd no longer see.
 */
export async function update(ctx: Ctx, playerId: number, planId: number, body: CreatePlanBody) {
  const plan = await planFor(ctx, playerId, planId);
  if (plan.playerId !== playerId) throw new GameError(msg('army.planNotOwner'), -99, 403);
  const waves = await ctx.tx.select().from(warPlanWaves).where(eq(warPlanWaves.planId, plan.id));
  const fields = await planFields(ctx, playerId, body);
  // the landing second is checked only when it changes: a rename needn't be refused as the second nears
  const retimed = Math.floor(body.landAt / 1000) * 1000 !== plan.landAt;
  if ((retimed || fields.targetTileId !== plan.targetTileId) && waves.some((w) => w.armyId != null)) throw new GameError(msg('army.planMoveSent'), -99);
  const landAt = retimed ? landingSecond(ctx, body.landAt) : plan.landAt;
  if (fields.allianceId == null && waves.some((w) => w.playerId !== playerId)) throw new GameError(msg('army.planKeepShared'), -99);
  await ctx.tx
    .update(warPlans)
    .set({ ...fields, landAt })
    .where(eq(warPlans.id, plan.id));
}

/** Deletes a plan and its waves (its maker only); armies already sent march on. */
export async function remove(ctx: Ctx, playerId: number, planId: number) {
  const plan = await planFor(ctx, playerId, planId);
  if (plan.playerId !== playerId) throw new GameError(msg('army.planNotOwner'), -99, 403);
  await ctx.tx.delete(warPlans).where(eq(warPlans.id, plan.id));
}

/** Adds one of the player's armies to a plan they can see, last in its order; nothing leaves until it's sent. */
export async function addWave(ctx: Ctx, playerId: number, planId: number, body: AddPlanWaveBody) {
  const plan = await planFor(ctx, playerId, planId);
  const city = await getCity(ctx, body.cityId);
  if (city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  if (body.mission !== Mission.ATTACK && body.mission !== Mission.SCOUT) throw new GameError(msg('army.planMission'), -99);
  const troops = sanitizeTroops(body.troops);
  const waves = await ctx.tx.select({ position: warPlanWaves.position }).from(warPlanWaves).where(eq(warPlanWaves.planId, plan.id));
  const position = Math.max(-1, ...waves.map((w) => w.position)) + 1;
  // each lands a millisecond after the one before, all within the plan's second
  if (waves.length >= BALANCE.warPlans.maxWaves || position >= 1000) throw new GameError(msg('army.planWaveLimit', { count: BALANCE.warPlans.maxWaves }), -99);
  const wave = one(
    await ctx.tx
      .insert(warPlanWaves)
      .values({ planId: plan.id, playerId, cityId: city.id, heroId: body.heroId ?? null, mission: body.mission, troops, position, createdAt: ctx.now })
      .returning(),
  );
  return { id: wave.id };
}

/** Takes an unsent wave out of a plan: its player's, or any by the plan's maker. */
export async function removeWave(ctx: Ctx, playerId: number, planId: number, waveId: number) {
  const plan = await planFor(ctx, playerId, planId);
  const wave = await waveOf(ctx, plan, waveId);
  if (wave.playerId !== playerId && plan.playerId !== playerId) throw new GameError(msg('army.planNotOwner'), -99, 403);
  if (wave.armyId != null) throw new GameError(msg('army.planWaveSent'), -99);
  await ctx.tx.delete(warPlanWaves).where(eq(warPlanWaves.id, wave.id));
}

/** Moves an unsent wave one place earlier or later in its plan's order (the plan's maker only), past an unsent one. */
export async function moveWave(ctx: Ctx, playerId: number, planId: number, waveId: number, by: -1 | 1) {
  const plan = await planFor(ctx, playerId, planId);
  if (plan.playerId !== playerId) throw new GameError(msg('army.planNotOwner'), -99, 403);
  const wave = await waveOf(ctx, plan, waveId);
  const order = await ctx.tx.select().from(warPlanWaves).where(eq(warPlanWaves.planId, plan.id)).orderBy(asc(warPlanWaves.position));
  const at = order.findIndex((w) => w.id === wave.id);
  const other = order[at + by];
  if (!other) return;
  // a sent wave's landing millisecond is fixed: neither it nor one swapping with it can move
  if (wave.armyId != null || other.armyId != null) throw new GameError(msg('army.planWaveSent'), -99);
  await ctx.tx.update(warPlanWaves).set({ position: other.position }).where(eq(warPlanWaves.id, wave.id));
  await ctx.tx.update(warPlanWaves).set({ position: wave.position }).where(eq(warPlanWaves.id, other.id));
}

/** Sends one of the player's own waves: it waits at home and lands its place in the order into the plan's second. */
export async function sendWave(ctx: Ctx, playerId: number, planId: number, waveId: number) {
  const plan = await planFor(ctx, playerId, planId);
  const [wave] = await ctx.tx
    .select()
    .from(warPlanWaves)
    .where(and(eq(warPlanWaves.id, waveId), eq(warPlanWaves.planId, plan.id), eq(warPlanWaves.playerId, playerId), isNull(warPlanWaves.armyId)))
    .for('update');
  if (!wave) throw new GameError(msg('army.planWaveSent'), -99);
  const army = await sendArmy(
    ctx,
    playerId,
    wave.cityId,
    { targetTileId: plan.targetTileId, mission: wave.mission, troops: wave.troops, heroId: wave.heroId, arriveAt: plan.landAt },
    { landOffsetMs: wave.position },
  );
  await ctx.tx.update(warPlanWaves).set({ armyId: army.armyId }).where(eq(warPlanWaves.id, wave.id));
  return army;
}
