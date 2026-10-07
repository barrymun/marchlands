// Heroes, armies, map and valleys.

import { armies, combat, heroes, world } from '@evony/game';
import {
  ArmyBean,
  ArmyParams,
  CityHeroList,
  Empty,
  HeroBean,
  HeroParams,
  HeroPointsBody,
  MapFieldInfo,
  MapQuery,
  MapSearchQuery,
  MapSearchResult,
  MapView,
  MarchEstimate,
  MarchEstimateBody,
  RenameHeroBody,
  SendArmyBody,
  StationedArmyList,
  TavernHireParams,
  TavernRefreshBody,
  TavernOffers,
  TileParams,
  TroopParams,
  UseHeroItemBody,
  VisibleArmies,
  ValleyUpgradeBody,
  LockHeroBody,
  ValleyUpgradeResult,
} from '@evony/contracts';
import { doc, anon, authenticate, game, playerIdOf, tags, zCityParams, type ZApp } from '../http.ts';

export default async function militaryRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = doc;

  // ---- heroes ----
  app.get('/cities/:cityId/heroes', s(tags.heroes, 'Heroes living in the city', CityHeroList, { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.listHeroes(ctx, pid, req.params.cityId)),
  );
  app.get('/cities/:cityId/tavern', s(tags.heroes, 'Inn offers (hero.getHerosListFromTavern)', TavernOffers, { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.tavern(ctx, pid, req.params.cityId)),
  );
  app.post(
    '/cities/:cityId/tavern/refresh',
    s(tags.heroes, 'New offers for gold or a Hero Hunting item (hero.refreshHerosListFromTavern)', TavernOffers, {
      params: zCityParams,
      body: TavernRefreshBody,
    }),
    (req) => game(req, (ctx, pid) => heroes.refreshTavern(ctx, pid, req.params.cityId, req.body.payWith)),
  );
  app.post('/cities/:cityId/tavern/:heroId/hire', s(tags.heroes, 'Hire (hero.hireHero)', HeroBean, { params: TavernHireParams }), (req) =>
    game(req, (ctx, pid) => heroes.hire(ctx, pid, req.params.cityId, req.params.heroId)),
  );
  app.delete('/cities/:cityId/mayor', s(tags.heroes, 'Dismiss the mayor (hero.dischargeChief)', Empty, { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => heroes.dischargeMayor(ctx, pid, req.params.cityId)),
  );
  app.post('/heroes/:heroId/fire', s(tags.heroes, 'Fire (hero.fireHero)', Empty, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.fire(ctx, pid, req.params.heroId)),
  );
  app.put(
    '/heroes/:heroId/lock',
    s(tags.heroes, 'Lock or unlock a hero (a locked hero cannot be dismissed)', HeroBean, { params: HeroParams, body: LockHeroBody }),
    (req) => game(req, (ctx, pid) => heroes.setHeroLocked(ctx, pid, req.params.heroId, req.body.locked)),
  );
  app.post('/heroes/:heroId/mayor', s(tags.heroes, 'Appoint mayor (hero.promoteToChief)', Empty, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.appointMayor(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/reset', s(tags.heroes, 'Reset attribute points with Holy Water (hero.resetPoint)', HeroBean, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.resetPoints(ctx, pid, req.params.heroId)),
  );
  app.post(
    '/heroes/:heroId/points',
    s(tags.heroes, 'Assign points: new totals (hero.addPoint)', HeroBean, { params: HeroParams, body: HeroPointsBody }),
    (req) => game(req, (ctx, pid) => heroes.assignPoints(ctx, pid, req.params.heroId, req.body)),
  );
  app.post('/heroes/:heroId/level-up', s(tags.heroes, 'Level up as many times as the experience pays for (hero.levelUp)', HeroBean, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.levelUp(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/reward', s(tags.heroes, '+5 loyalty for gold (hero.awardGold)', HeroBean, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.reward(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/items', s(tags.heroes, 'Use a hero item (hero.useItem)', HeroBean, { params: HeroParams, body: UseHeroItemBody }), (req) =>
    game(req, (ctx, pid) => heroes.useHeroItem(ctx, pid, req.params.heroId, req.body.itemId, req.body.payWith)),
  );
  app.patch('/heroes/:heroId', s(tags.heroes, 'Rename (hero.changeName)', HeroBean, { params: HeroParams, body: RenameHeroBody }), (req) =>
    game(req, (ctx, pid) => heroes.renameHero(ctx, pid, req.params.heroId, req.body.name)),
  );
  app.post('/heroes/:heroId/release', s(tags.heroes, 'Free a captured enemy hero (hero.releaseHero)', Empty, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.releaseCaptive(ctx, pid, req.params.heroId)),
  );
  app.post('/heroes/:heroId/persuade', s(tags.heroes, 'Recruit a captive whose loyalty is 0', HeroBean, { params: HeroParams }), (req) =>
    game(req, (ctx, pid) => heroes.persuadeCaptive(ctx, pid, req.params.heroId)),
  );

  // ---- armies ----
  app.get('/armies', s(tags.armies, 'Own, friendly and hostile armies (Self/Friend/EnemyArmysUpdate)', VisibleArmies), (req) =>
    game(req, (ctx, pid) => armies.visibleArmies(ctx, pid)),
  );
  app.post(
    '/cities/:cityId/armies',
    s(tags.armies, 'Send an army: mission 1 transport, 2 reinforce, 3 scout, 4 build city, 5 attack (army.newArmy)', ArmyBean, {
      params: zCityParams,
      body: SendArmyBody,
    }),
    (req) => game(req, (ctx, pid) => armies.sendArmy(ctx, pid, req.params.cityId, req.body)),
  );
  app.post('/armies/:armyId/recall', s(tags.armies, 'Recall (army.callBackArmy)', ArmyBean, { params: ArmyParams }), (req) =>
    game(req, (ctx, pid) => armies.recallArmy(ctx, pid, req.params.armyId)),
  );
  app.post('/armies/:armyId/dismiss', s(tags.armies, 'Send allied troops stationed with you home', Empty, { params: ArmyParams }), (req) =>
    game(req, (ctx, pid) => armies.dismissGuest(ctx, pid, req.params.armyId)),
  );
  app.get(
    '/cities/:cityId/armies/params',
    s(tags.armies, 'March/load bonuses and army cap (army.getTroopParam)', TroopParams, { params: zCityParams }),
    (req) => game(req, (ctx, pid) => armies.troopParams(ctx, pid, req.params.cityId)),
  );
  app.post(
    '/cities/:cityId/armies/estimate',
    s(tags.armies, 'March time and carry capacity preview', MarchEstimate, { params: zCityParams, body: MarchEstimateBody }),
    (req) => game(req, (ctx, pid) => armies.marchEstimate(ctx, pid, req.params.cityId, req.body.targetTileId, req.body.troops)),
  );
  app.get(
    '/cities/:cityId/stationed',
    s(tags.armies, 'Allied troops stationed here (army.getStayAllianceArmys)', StationedArmyList, { params: zCityParams }),
    (req) => game(req, (ctx, pid) => armies.stationedIn(ctx, pid, req.params.cityId)),
  );
  app.delete('/valleys/:tileId', s(tags.map, 'Give up an occupied valley (field.giveUpField)', Empty, { params: TileParams }), (req) =>
    game(req, (ctx, pid) => combat.abandonValley(ctx, pid, req.params.tileId)),
  );
  app.post(
    '/valleys/:tileId/upgrade',
    s(tags.map, 'Raise an unowned valley or barbarian city one level for gold (instant)', ValleyUpgradeResult, { params: TileParams, body: ValleyUpgradeBody }),
    (req) => game(req, (ctx, pid) => combat.upgradeValley(ctx, pid, req.body.cityId, req.params.tileId)),
  );

  // ---- map ----
  app.get('/map', s(tags.map, 'Up to 21x21 tiles with castles (common.mapInfoSimple)', MapView, { querystring: MapQuery }), async (req) => {
    const viewer = await playerIdOf(app.deps.db, req).catch(() => null);
    return anon(req, (ctx) => world.mapView(ctx, viewer, req.query.x1, req.query.y1, req.query.x2, req.query.y2));
  });
  app.get('/map/tiles/:tileId', s(tags.map, 'Tile details (field.getOtherFieldInfo)', MapFieldInfo, { params: TileParams }), async (req) => {
    const viewer = await playerIdOf(app.deps.db, req).catch(() => null);
    return anon(req, (ctx) => world.fieldInfo(ctx, viewer, req.params.tileId));
  });
  app.get('/map/search', s(tags.map, 'Find tiles of a type near a point', MapSearchResult, { querystring: MapSearchQuery }), (req) =>
    anon(req, (ctx) => world.searchTiles(ctx, req.query.x, req.query.y, req.query.radius, req.query.type)),
  );
}
