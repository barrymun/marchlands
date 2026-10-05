// Heroes, armies, map and valleys.

import { z } from 'zod';
import { armies, combat, heroes, world } from '@evony/game';
import { doc, anon, authenticate, game, playerIdOf, tags, zCityParams, zId, zResources, zTroops, type ZApp } from '../http.ts';

const heroParams = z.object({ heroId: zId });

export default async function militaryRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = doc;

  // ---- heroes ----
  app.get('/cities/:cityId/heroes', s(tags.heroes, 'Heroes living in the city', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.listHeroes(ctx, pid, req.params.cityId)),
  );
  app.get('/cities/:cityId/tavern', s(tags.heroes, 'Inn offers (hero.getHerosListFromTavern)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.tavern(ctx, pid, req.params.cityId)),
  );
  app.post('/cities/:cityId/tavern/refresh', s(tags.heroes, 'New offers with Hero Hunting (hero.refreshHerosListFromTavern)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.refreshTavern(ctx, pid, req.params.cityId)),
  );
  app.post('/cities/:cityId/tavern/:heroId/hire', s(tags.heroes, 'Hire (hero.hireHero)', { params: zCityParams.extend({ heroId: zId }) }), (req) =>
    game(req, (ctx, pid) => heroes.hire(ctx, pid, req.params.cityId, req.params.heroId)),
  );
  app.delete('/cities/:cityId/mayor', s(tags.heroes, 'Dismiss the mayor (hero.dischargeChief)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.dischargeMayor(ctx, pid, req.params.cityId)),
  );
  app.post('/heroes/:heroId/fire', s(tags.heroes, 'Fire (hero.fireHero)', { params: heroParams }), (req) => game(req, (ctx, pid) => heroes.fire(ctx, pid, req.params.heroId)));
  app.post('/heroes/:heroId/mayor', s(tags.heroes, 'Appoint mayor (hero.promoteToChief)', { params: heroParams }), (req) =>
    game(req, (ctx, pid) => heroes.appointMayor(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/reset', s(tags.heroes, 'Reset attribute points with Holy Water (hero.resetPoint)', { params: heroParams }), (req) =>
    game(req, (ctx, pid) => heroes.resetPoints(ctx, pid, req.params.heroId)),
  );
  app.post(
    '/heroes/:heroId/points',
    s(tags.heroes, 'Assign points: new totals (hero.addPoint)', { params: heroParams, body: z.object({ power: z.number().int(), management: z.number().int(), stratagem: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => heroes.assignPoints(ctx, pid, req.params.heroId, req.body)),
  );
  app.post('/heroes/:heroId/level-up', s(tags.heroes, 'Level up (hero.levelUp)', { params: heroParams }), (req) => game(req, (ctx, pid) => heroes.levelUp(ctx, pid, req.params.heroId)));
  app.post('/heroes/:heroId/reward', s(tags.heroes, '+5 loyalty for gold (hero.awardGold)', { params: heroParams }), (req) => game(req, (ctx, pid) => heroes.reward(ctx, pid, req.params.heroId)));
  app.post('/heroes/:heroId/items', s(tags.heroes, 'Use a hero item (hero.useItem)', { params: heroParams, body: z.object({ itemId: z.string() }) }), (req) =>
    game(req, (ctx, pid) => heroes.useHeroItem(ctx, pid, req.params.heroId, req.body.itemId)),
  );
  app.patch('/heroes/:heroId', s(tags.heroes, 'Rename (hero.changeName)', { params: heroParams, body: z.object({ name: z.string() }) }), (req) =>
    game(req, (ctx, pid) => heroes.renameHero(ctx, pid, req.params.heroId, req.body.name)),
  );
  app.post('/heroes/:heroId/release', s(tags.heroes, 'Free a captured enemy hero (hero.releaseHero)', { params: heroParams }), (req) =>
    game(req, (ctx, pid) => heroes.releaseCaptive(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/persuade', s(tags.heroes, 'Recruit a captive whose loyalty is 0', { params: heroParams }), (req) =>
    game(req, (ctx, pid) => heroes.persuadeCaptive(ctx, pid, req.params.heroId)),
  );

  // ---- armies ----
  app.get('/armies', s(tags.armies, 'Own, friendly and hostile armies (Self/Friend/EnemyArmysUpdate)'), (req) => game(req, (ctx, pid) => armies.visibleArmies(ctx, pid)));
  app.post(
    '/cities/:cityId/armies',
    s(tags.armies, 'Send an army: mission 1 transport, 2 reinforce, 3 scout, 4 build city, 5 attack (army.newArmy)', {
      params: zCityParams,
      body: z.object({
        targetTileId: zId,
        mission: z.number().int().min(1).max(5),
        troops: zTroops,
        resources: zResources.optional(),
        heroId: z.number().int().nullish(),
        restTime: z.number().int().min(0).optional().describe('seconds to camp before returning (0 = until recalled)'),
      }),
    }),
    (req) => game(req, (ctx, pid) => armies.sendArmy(ctx, pid, req.params.cityId, req.body)),
  );
  app.post('/armies/:armyId/recall', s(tags.armies, 'Recall (army.callBackArmy)', { params: z.object({ armyId: zId }) }), (req) =>
    game(req, (ctx, pid) => armies.recallArmy(ctx, pid, req.params.armyId)),
  );
  app.post('/armies/:armyId/dismiss', s(tags.armies, 'Send allied troops stationed with you home', { params: z.object({ armyId: zId }) }), (req) =>
    game(req, (ctx, pid) => armies.dismissGuest(ctx, pid, req.params.armyId)),
  );
  app.get('/cities/:cityId/armies/params', s(tags.armies, 'March/load bonuses and army cap (army.getTroopParam)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => armies.troopParams(ctx, pid, req.params.cityId)),
  );
  app.post(
    '/cities/:cityId/armies/estimate',
    s(tags.armies, 'March time and carry capacity preview', { params: zCityParams, body: z.object({ targetTileId: zId, troops: zTroops }) }),
    (req) => game(req, (ctx, pid) => armies.marchEstimate(ctx, pid, req.params.cityId, req.body.targetTileId, req.body.troops)),
  );
  app.get('/cities/:cityId/stationed', s(tags.armies, 'Allied troops stationed here (army.getStayAllianceArmys)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => armies.stationedIn(ctx, pid, req.params.cityId)),
  );
  app.delete('/valleys/:tileId', s(tags.map, 'Give up an occupied valley (field.giveUpField)', { params: z.object({ tileId: zId }) }), (req) =>
    game(req, (ctx, pid) => combat.abandonValley(ctx, pid, req.params.tileId)),
  );

  // ---- map ----
  app.get(
    '/map',
    s(tags.map, 'Up to 21x21 tiles with castles (common.mapInfoSimple)', {
      querystring: z.object({ x1: z.coerce.number().int(), y1: z.coerce.number().int(), x2: z.coerce.number().int(), y2: z.coerce.number().int() }),
    }),
    async (req) => {
      const viewer = await playerIdOf(app.deps.db, req).catch(() => null);
      return anon(req, (ctx) => world.mapView(ctx, viewer, req.query.x1, req.query.y1, req.query.x2, req.query.y2));
    },
  );
  app.get('/map/tiles/:tileId', s(tags.map, 'Tile details (field.getOtherFieldInfo)', { params: z.object({ tileId: zId }) }), async (req) => {
    const viewer = await playerIdOf(app.deps.db, req).catch(() => null);
    return anon(req, (ctx) => world.fieldInfo(ctx, viewer, req.params.tileId));
  });
  app.get(
    '/map/search',
    s(tags.map, 'Find tiles of a type near a point', {
      querystring: z.object({ x: z.coerce.number().int(), y: z.coerce.number().int(), radius: z.coerce.number().int().default(10), type: z.coerce.number().int() }),
    }),
    (req) => anon(req, (ctx) => world.searchTiles(ctx, req.query.x, req.query.y, req.query.radius, req.query.type)),
  );
}
