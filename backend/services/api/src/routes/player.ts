import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { players } from '@evony/db';
import { player, runGame, shop, world } from '@evony/game';
import { signToken } from '../auth/jwt.ts';
import { doc, authenticate, game, secured, tags, zId, type ZApp } from '../http.ts';

export default async function playerRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = <T extends object = {}>(summary: string, extra?: T) => doc(tags.player, summary, extra);

  app.get('/world/zones', { schema: { tags: tags.map, security: secured, summary: 'States with population stats (common.zoneInfo)' } }, async () => ({
    ok: 1,
    data: await world.zoneStats(app.deps.db),
  }));

  app.get('/world', { schema: { tags: tags.map, security: secured, summary: 'World info' } }, async () => ({
    ok: 1,
    data: { ...(await world.getWorldInfo(app.deps.db)), online: app.deps.online() },
  }));

  app.post(
    '/player',
    s('Create the lord and first city (common.createNewPlayer)', {
      body: z.object({
        userName: z.string(),
        castleName: z.string(),
        flag: z.string(),
        faceUrl: z.string().default('images/icon/player/faceA1.jpg'),
        sex: z.number().int(),
        zone: z.number().int().min(-1).max(15).default(-1),
      }),
    }),
    async (req) => {
      const accountId = req.claims!.sub;
      const result = await runGame(app.deps.db, async (ctx) => {
        const p = await player.createPlayer(ctx, accountId, req.body);
        return { playerId: p.id, state: await player.playerState(ctx, p.id) };
      });
      const token = signToken({ sub: accountId, pid: result.playerId, adm: req.claims!.adm }, app.deps.config.jwtSecret, app.deps.config.jwtTtl);
      return { ok: 1, data: { token, ...result.state } };
    },
  );

  app.get('/player', s('Full lord state: cities, items, buffs, armies, counters (login bean)'), (req) =>
    game(req, async (ctx, pid) => {
      await player.touchLogin(ctx, pid);
      return player.playerState(ctx, pid);
    }),
  );

  app.get('/players/:name', s('Public profile of a lord', { params: z.object({ name: z.string() }) }), (req) =>
    game(req, (ctx, pid) => player.publicPlayerInfo(ctx, pid, req.params.name)),
  );

  app.patch('/player/face', s('Set portrait and sex once (common.changeUserFace)', { body: z.object({ faceUrl: z.string(), sex: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => player.changeFace(ctx, pid, req.body.faceUrl, req.body.sex)),
  );
  app.post('/player/flag', s('Change flag with a National Flag (city.modifyFlag)', { body: z.object({ flag: z.string() }) }), (req) =>
    game(req, (ctx, pid) => player.changeFlag(ctx, pid, req.body.flag)),
  );
  app.post('/player/rename', s('Rename the lord with a New ID (city.modifyUserName)', { body: z.object({ userName: z.string() }) }), (req) =>
    game(req, (ctx, pid) => player.renamePlayer(ctx, pid, req.body.userName)),
  );
  app.post('/player/title/promote', s('Promote to the next nobility title'), (req) => game(req, (ctx, pid) => player.promoteTitle(ctx, pid)));
  app.post('/player/tutorial', s('Store tutorial progress (common.step)', { body: z.object({ step: z.number().int().min(0) }) }), (req) =>
    game(req, (ctx, pid) => player.saveTutorialStep(ctx, pid, req.body.step)),
  );
  app.post('/player/furlough', s('Holiday mode, 10 cents/day (furlough.isFurlought)', { body: z.object({ days: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => player.startFurlough(ctx, pid, req.body.days)),
  );
  app.delete('/player/furlough', s('End holiday mode (furlough.cancelFurlought)'), (req) => game(req, (ctx, pid) => player.cancelFurlough(ctx, pid)));
  app.post('/player/truce', s('Truce Agreement (city.setStopWarState)', { body: z.object({ itemId: z.string().default('player.peace.1') }) }), (req) =>
    game(req, (ctx, pid) => player.startTruce(ctx, pid, req.body.itemId)),
  );
  app.post('/player/restart', s('Delete everything and start over (common.deleteUserAndRestart)'), (req) =>
    game(req, (ctx, pid) => player.restartPlayer(ctx, pid)),
  );

  app.get('/player/bookmarks', s('Map bookmarks (castleSignBean)'), (req) =>
    game(req, async (ctx, pid) => (await ctx.tx.select({ s: players.castleSigns }).from(players).where(eq(players.id, pid)))[0].s),
  );
  app.post('/player/bookmarks', s('Bookmark a castle (castle.saveCastleSignList)', { body: z.object({ tileId: zId }) }), (req) =>
    game(req, (ctx, pid) => player.addCastleSign(ctx, pid, req.body.tileId)),
  );
  app.delete('/player/bookmarks/:tileId', s('Remove a bookmark', { params: z.object({ tileId: zId }) }), (req) =>
    game(req, (ctx, pid) => player.removeCastleSign(ctx, pid, req.params.tileId)),
  );

  app.post(
    '/player/items/:itemId/use',
    s('Use an item (shop.useGoods / shop.useCastleGoods)', { params: z.object({ itemId: z.string() }), body: z.object({ cityId: zId.nullish() }).default({}) }),
    (req) => game(req, (ctx, pid) => shop.useItem(ctx, pid, req.params.itemId, req.body.cityId ?? null)),
  );

}
