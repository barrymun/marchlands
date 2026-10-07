import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ArmyPreset,
  ArmyPresetBody,
  ArmyPresetParams,
  Flow,
  FlowBody,
  FlowParams,
  FlowRunBody,
  FlowRunReport,
  BookmarkBody,
  BookmarkParams,
  CastleSign,
  ChangeFaceBody,
  ChangeFlagBody,
  CreatePlayerBody,
  Empty,
  FurloughBody,
  PlayerCreated,
  PlayerNameParams,
  PlayerState,
  PublicPlayerInfo,
  RenamePlayerBody,
  TitlePromotion,
  TruceBody,
  TutorialStepBody,
  UseItemBody,
  UseItemParams,
  UseItemResult,
  WorldInfo,
  ZoneStats,
} from '@evony/contracts';
import { players } from '@evony/db';
import { flows, player, runGame, shop, world } from '@evony/game';
import { signToken } from '../auth/jwt.ts';
import { doc, authenticate, game, playerIdOf, tags, type ZApp } from '../http.ts';

export default async function playerRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = <R extends z.ZodType, T extends object = {}>(summary: string, data: R, extra?: T) => doc(tags.player, summary, data, extra);

  app.get('/world/zones', doc(tags.map, 'States with population stats (common.zoneInfo)', z.array(ZoneStats)), async () => ({
    ok: 1 as const,
    data: await world.zoneStats(app.deps.db),
  }));

  app.get('/world', doc(tags.map, 'World info', WorldInfo), async () => ({
    ok: 1 as const,
    data: { ...(await world.getWorldInfo(app.deps.db)), online: app.deps.online() },
  }));

  app.post('/player', s('Create the lord and first city (common.createNewPlayer)', PlayerCreated, { body: CreatePlayerBody }), async (req) => {
    const accountId = req.claims!.sub;
    const result = await runGame(app.deps.db, async (ctx) => {
      const p = await player.createPlayer(ctx, accountId, req.body);
      return { playerId: p.id, state: await player.playerState(ctx, p.id) };
    });
    const token = signToken({ sub: accountId, pid: result.playerId, adm: req.claims!.adm }, app.deps.config.jwtSecret, app.deps.config.jwtTtl);
    return { ok: 1 as const, data: { token, ...result.state } };
  });

  app.get('/player', s('Full lord state: cities, items, buffs, armies, counters (login bean)', PlayerState), (req) =>
    game(req, async (ctx, pid) => {
      await player.touchLogin(ctx, pid);
      return player.playerState(ctx, pid);
    }),
  );

  app.get('/players/:name', s('Public profile of a lord', PublicPlayerInfo, { params: PlayerNameParams }), (req) =>
    game(req, (ctx, pid) => player.publicPlayerInfo(ctx, pid, req.params.name)),
  );

  app.patch('/player/face', s('Set portrait and sex once (common.changeUserFace)', Empty, { body: ChangeFaceBody }), (req) =>
    game(req, (ctx, pid) => player.changeFace(ctx, pid, req.body.faceUrl, req.body.sex)),
  );
  app.post('/player/flag', s('Change flag with a National Flag (city.modifyFlag)', Empty, { body: ChangeFlagBody }), (req) =>
    game(req, (ctx, pid) => player.changeFlag(ctx, pid, req.body.flag)),
  );
  app.post('/player/rename', s('Rename the lord with a New ID (city.modifyUserName)', Empty, { body: RenamePlayerBody }), (req) =>
    game(req, (ctx, pid) => player.renamePlayer(ctx, pid, req.body.userName)),
  );
  app.post('/player/title/promote', s('Promote to the next nobility title', TitlePromotion), (req) => game(req, (ctx, pid) => player.promoteTitle(ctx, pid)));
  app.post('/player/tutorial', s('Store tutorial progress (common.step)', Empty, { body: TutorialStepBody }), (req) =>
    game(req, (ctx, pid) => player.saveTutorialStep(ctx, pid, req.body.step)),
  );
  app.post('/player/furlough', s('Holiday mode, 10 cents/day (furlough.isFurlought)', Empty, { body: FurloughBody }), (req) =>
    game(req, (ctx, pid) => player.startFurlough(ctx, pid, req.body.days)),
  );
  app.delete('/player/furlough', s('End holiday mode (furlough.cancelFurlought)', Empty), (req) => game(req, (ctx, pid) => player.cancelFurlough(ctx, pid)));
  app.post('/player/truce', s('Truce Agreement (city.setStopWarState)', Empty, { body: TruceBody }), (req) =>
    game(req, (ctx, pid) => player.startTruce(ctx, pid, req.body.itemId)),
  );
  app.post('/player/restart', s('Delete everything and start over (common.deleteUserAndRestart)', Empty), (req) =>
    game(req, (ctx, pid) => player.restartPlayer(ctx, pid)),
  );

  app.get('/player/bookmarks', s('Map bookmarks (castleSignBean)', z.array(CastleSign)), (req) =>
    game(req, async (ctx, pid) => (await ctx.tx.select({ s: players.castleSigns }).from(players).where(eq(players.id, pid)))[0].s),
  );
  app.post('/player/bookmarks', s('Bookmark a castle (castle.saveCastleSignList)', z.array(CastleSign), { body: BookmarkBody }), (req) =>
    game(req, (ctx, pid) => player.addCastleSign(ctx, pid, req.body.tileId)),
  );
  app.get('/player/army-presets', s('Saved army compositions', z.array(ArmyPreset)), (req) => game(req, (ctx, pid) => player.armyPresets(ctx, pid)));
  app.post('/player/army-presets', s('Save an army composition (same name replaces)', z.array(ArmyPreset), { body: ArmyPresetBody }), (req) =>
    game(req, (ctx, pid) => player.saveArmyPreset(ctx, pid, req.body.name, req.body.troops)),
  );
  app.delete('/player/army-presets/:presetId', s('Delete a saved army composition', z.array(ArmyPreset), { params: ArmyPresetParams }), (req) =>
    game(req, (ctx, pid) => player.deleteArmyPreset(ctx, pid, req.params.presetId)),
  );
  app.get('/player/flows', s('Saved flows (series of actions run on cities)', z.array(Flow)), (req) => game(req, (ctx, pid) => flows.listFlows(ctx, pid)));
  app.post('/player/flows', s('Create a flow, or replace one by id', z.array(Flow), { body: FlowBody }), (req) =>
    game(req, (ctx, pid) => flows.saveFlow(ctx, pid, req.body)),
  );
  app.delete('/player/flows/:flowId', s('Delete a flow', z.array(Flow), { params: FlowParams }), (req) =>
    game(req, (ctx, pid) => flows.deleteFlow(ctx, pid, req.params.flowId)),
  );
  app.post(
    '/player/flows/:flowId/run',
    s('Run a flow on cities, each all-or-nothing (or preview it: run and roll back)', FlowRunReport, { params: FlowParams, body: FlowRunBody }),
    async (req) => {
      const pid = await playerIdOf(app.deps.db, req);
      return { ok: 1 as const, data: await flows.runFlow(app.deps.db, pid, req.params.flowId, req.body.cityIds, req.body.preview) };
    },
  );
  app.delete('/player/bookmarks/:tileId', s('Remove a bookmark', z.array(CastleSign), { params: BookmarkParams }), (req) =>
    game(req, (ctx, pid) => player.removeCastleSign(ctx, pid, req.params.tileId)),
  );

  app.post(
    '/player/items/:itemId/use',
    s('Use an item (shop.useGoods / shop.useCastleGoods)', UseItemResult, { params: UseItemParams, body: UseItemBody }),
    (req) => game(req, (ctx, pid) => shop.useItem(ctx, pid, req.params.itemId, req.body.cityId ?? null)),
  );
}
