// Heroes, armies, map and valleys.

import { z } from 'zod';

import {
  AddPlanWaveBody,
  ArmyBean,
  ArmyParams,
  CityHeroList,
  CreatePlanBody,
  Empty,
  GearPieceParams,
  HeroBean,
  HeroGearStatBody,
  HeroOrderBody,
  HeroParams,
  HeroPointsBody,
  LockHeroBody,
  LordGear,
  MapFieldInfo,
  MapQuery,
  MapSearchQuery,
  MapSearchResult,
  MapView,
  MarchEstimate,
  MarchEstimateBody,
  MovePlanWaveBody,
  PlanBean,
  PlanCreated,
  PlanParams,
  PlanWaveParams,
  RenameHeroBody,
  SendArmyBody,
  StationedArmyList,
  TavernHireParams,
  TavernOffers,
  TileParams,
  TroopParams,
  UpdatePlanBody,
  UseHeroItemBody,
  ValleyUpgradeBody,
  ValleyUpgradeResult,
  VisibleArmies,
} from '@marchlands/contracts';
import { armies, combat, heroes, plans, world } from '@marchlands/game';

import { anon, authenticate, doc, game, playerIdOf, tags, type ZApp, zCityParams } from '#/http.ts';

export default async function militaryRoutes(app: ZApp) {
  app.addHook('onRequest', authenticate);
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
    s(tags.heroes, 'New offers for gold (hero.refreshHerosListFromTavern)', TavernOffers, { params: zCityParams }),
    (req) => game(req, (ctx, pid) => heroes.refreshTavern(ctx, pid, req.params.cityId)),
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
    '/cities/:cityId/heroes/order',
    s(tags.heroes, "Reorder the city's heroes (the order the hero list shows them in)", CityHeroList, { params: zCityParams, body: HeroOrderBody }),
    (req) => game(req, (ctx, pid) => heroes.reorderHeroes(ctx, pid, req.params.cityId, req.body.heroIds)),
  );
  app.put(
    '/heroes/:heroId/lock',
    s(tags.heroes, 'Lock or unlock a hero (a locked hero cannot be dismissed)', HeroBean, { params: HeroParams, body: LockHeroBody }),
    (req) => game(req, (ctx, pid) => heroes.setHeroLocked(ctx, pid, req.params.heroId, req.body.locked)),
  );
  app.put(
    '/heroes/:heroId/gear-stat',
    s(tags.heroes, "Choose the attribute the lord's gear boosts on this hero (free)", HeroBean, { params: HeroParams, body: HeroGearStatBody }),
    (req) => game(req, (ctx, pid) => heroes.setHeroGearStat(ctx, pid, req.params.heroId, req.body.stat)),
  );
  app.get('/gear', s(tags.heroes, "The lord's hero gear: Hero Enhancement level and stars per piece", LordGear), (req) =>
    game(req, (ctx, pid) => heroes.gearState(ctx, pid)),
  );
  app.post('/gear/:pieceId/star', s(tags.heroes, 'Add a star to a gear piece for every hero, paid in medals', LordGear, { params: GearPieceParams }), (req) =>
    game(req, (ctx, pid) => heroes.buyGearStar(ctx, pid, req.params.pieceId)),
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
  app.post(
    '/heroes/:heroId/level-up',
    s(tags.heroes, 'Level up as many times as the experience pays for (hero.levelUp)', HeroBean, { params: HeroParams }),
    (req) => game(req, (ctx, pid) => heroes.levelUp(ctx, pid, req.params.heroId)),
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
  // ---- wave plans (camp times, docs/features/camp-times.md) ----
  app.get(
    '/plans',
    s(tags.armies, "The player's wave plans and those shared with their alliance, with their waves in landing order", z.array(PlanBean)),
    (req) => game(req, (ctx, pid) => plans.list(ctx, pid)),
  );
  app.post('/plans', s(tags.armies, 'Make a wave plan: a target and the second its waves land', PlanCreated, { body: CreatePlanBody }), (req) =>
    game(req, (ctx, pid) => plans.create(ctx, pid, req.body)),
  );
  app.patch(
    '/plans/:planId',
    s(tags.armies, 'Change a wave plan (its maker only): its target and landing second only while no wave is sent', Empty, {
      params: PlanParams,
      body: UpdatePlanBody,
    }),
    (req) => game(req, (ctx, pid) => plans.update(ctx, pid, req.params.planId, req.body)),
  );
  app.delete('/plans/:planId', s(tags.armies, 'Delete a wave plan (its maker only); armies already sent march on', Empty, { params: PlanParams }), (req) =>
    game(req, (ctx, pid) => plans.remove(ctx, pid, req.params.planId)),
  );
  app.post(
    '/plans/:planId/waves',
    s(tags.armies, "Add one of the player's armies to a plan, last in its order", PlanCreated, { params: PlanParams, body: AddPlanWaveBody }),
    (req) => game(req, (ctx, pid) => plans.addWave(ctx, pid, req.params.planId, req.body)),
  );
  app.delete(
    '/plans/:planId/waves/:waveId',
    s(tags.armies, "Take an unsent wave out of a plan (its player's, or any by the plan's maker)", Empty, { params: PlanWaveParams }),
    (req) => game(req, (ctx, pid) => plans.removeWave(ctx, pid, req.params.planId, req.params.waveId)),
  );
  app.post(
    '/plans/:planId/waves/:waveId/move',
    s(tags.armies, 'Move an unsent wave one place earlier or later (the plan’s maker only)', Empty, { params: PlanWaveParams, body: MovePlanWaveBody }),
    (req) => game(req, (ctx, pid) => plans.moveWave(ctx, pid, req.params.planId, req.params.waveId, req.body.by)),
  );
  app.post(
    '/plans/:planId/waves/:waveId/send',
    s(tags.armies, "Send one of the player's waves: it waits at home and lands its place in the order into the plan's second", ArmyBean, {
      params: PlanWaveParams,
    }),
    (req) => game(req, (ctx, pid) => plans.sendWave(ctx, pid, req.params.planId, req.params.waveId)),
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
