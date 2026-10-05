// City management: interior, buildings, research, troops, fortifications.

import { z } from 'zod';
import { buildings, interior, research, training } from '@evony/game';
import { doc, authenticate, game, tags, zCityParams, zId, zTroops, type ZApp } from '../http.ts';

const pos = z.coerce.number().int().min(-2).max(1040);
const cityPos = zCityParams.extend({ positionId: pos });
const speedBody = z.object({ itemId: z.string().describe('free.speed | coins.speed | consume.2.a ... consume.2.d | player.speedup.1 | player.destroy.1.a') });

export default async function cityRoutes(app: ZApp) {
  app.addHook('preHandler', authenticate);
  const s = doc;

  // ---- interior ----
  app.get('/cities/:cityId', s(tags.city, 'City detail (castleBean)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => interior.getCity(ctx, pid, req.params.cityId)),
  );
  app.patch(
    '/cities/:cityId',
    s(tags.city, 'Rename / logo / defence settings (city.modifyCastleName, army.setArmyGoOut)', {
      params: zCityParams,
      body: z.object({ name: z.string().optional(), logoUrl: z.string().optional(), goOutForBattle: z.boolean().optional(), allowAlliance: z.boolean().optional() }),
    }),
    (req) =>
      game(req, async (ctx, pid) => {
        const { name, logoUrl, goOutForBattle, allowAlliance } = req.body;
        if (name != null || logoUrl != null) await interior.renameCity(ctx, pid, req.params.cityId, name, logoUrl);
        if (goOutForBattle != null || allowAlliance != null) await interior.setCityFlags(ctx, pid, req.params.cityId, { goOutForBattle, allowAlliance });
        return interior.getCity(ctx, pid, req.params.cityId);
      }),
  );
  app.put('/cities/:cityId/tax', s(tags.city, 'Tax rate (interior.modifyTaxRate)', { params: zCityParams, body: z.object({ rate: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => interior.setTaxRate(ctx, pid, req.params.cityId, req.body.rate)),
  );
  app.put(
    '/cities/:cityId/work-rates',
    s(tags.city, 'Labour per resource, % (interior.modifyCommenceRate)', {
      params: zCityParams,
      body: z.object({ food: z.number().int(), wood: z.number().int(), stone: z.number().int(), iron: z.number().int() }).partial(),
    }),
    (req) => game(req, (ctx, pid) => interior.setWorkRates(ctx, pid, req.params.cityId, req.body)),
  );
  app.put(
    '/cities/:cityId/store-percent',
    s(tags.city, 'Warehouse protection split, % (city.modifyStorePercent)', {
      params: zCityParams,
      body: z.object({ food: z.number().int(), wood: z.number().int(), stone: z.number().int(), iron: z.number().int() }).partial(),
    }),
    (req) => game(req, (ctx, pid) => interior.setStorePercent(ctx, pid, req.params.cityId, req.body)),
  );
  app.post(
    '/cities/:cityId/comfort',
    s(tags.city, 'Comfort: 1 relief, 2 prayer, 3 blessing, 4 population raising (interior.pacifyPeople)', { params: zCityParams, body: z.object({ typeId: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => interior.comfort(ctx, pid, req.params.cityId, req.body.typeId)),
  );
  app.post(
    '/cities/:cityId/levy',
    s(tags.city, 'Levy: 1 gold, 2 food, 3 wood, 4 stone, 5 iron (interior.taxation)', { params: zCityParams, body: z.object({ typeId: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => interior.levy(ctx, pid, req.params.cityId, req.body.typeId)),
  );
  app.get('/cities/:cityId/production', s(tags.city, 'Production breakdown (interior.getResourceProduceData)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => interior.productionBreakdown(ctx, pid, req.params.cityId)),
  );
  app.post(
    '/cities/:cityId/move',
    s(tags.city, 'Teleport: zoneId = City Teleporter, targetTileId = Adv City Teleporter', {
      params: zCityParams,
      body: z.object({ zoneId: z.number().int().optional(), targetTileId: zId.optional() }),
    }),
    (req) => game(req, (ctx, pid) => interior.moveCity(ctx, pid, req.params.cityId, req.body)),
  );

  // ---- buildings ----
  app.get(
    '/cities/:cityId/buildings/available',
    s(tags.buildings, 'Buildable types (castle.getAvailableBuildingList*)', { params: zCityParams, querystring: z.object({ area: z.enum(['inside', 'outside', 'walls']).default('inside') }) }),
    (req) => game(req, (ctx, pid) => buildings.availableBuildings(ctx, pid, req.params.cityId, req.query.area)),
  );
  app.get('/cities/:cityId/buildings/:positionId', s(tags.buildings, 'Next-level cost (castle.checkOutUpgrade)', { params: cityPos }), (req) =>
    game(req, (ctx, pid) => buildings.upgradeInfo(ctx, pid, req.params.cityId, req.params.positionId)),
  );
  app.post(
    '/cities/:cityId/buildings',
    s(tags.buildings, 'Construct (castle.newBuilding)', { params: zCityParams, body: z.object({ typeId: z.number().int(), positionId: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => buildings.construct(ctx, pid, req.params.cityId, req.body.typeId, req.body.positionId)),
  );
  app.post('/cities/:cityId/buildings/:positionId/upgrade', s(tags.buildings, 'Upgrade (castle.upgradeBuilding)', { params: cityPos }), (req) =>
    game(req, (ctx, pid) => buildings.upgrade(ctx, pid, req.params.cityId, req.params.positionId)),
  );
  app.post('/cities/:cityId/buildings/:positionId/demolish', s(tags.buildings, 'Demolish one level (castle.destructBuilding)', { params: cityPos }), (req) =>
    game(req, (ctx, pid) => buildings.demolish(ctx, pid, req.params.cityId, req.params.positionId)),
  );
  app.post('/cities/:cityId/buildings/:positionId/cancel', s(tags.buildings, 'Cancel construction (castle.cancleBuildCommand)', { params: cityPos }), (req) =>
    game(req, (ctx, pid) => buildings.cancel(ctx, pid, req.params.cityId, req.params.positionId)),
  );
  app.get('/cities/:cityId/buildings/:positionId/speedup', s(tags.buildings, 'Coins to finish now (castle.getCoinsNeed)', { params: cityPos }), (req) =>
    game(req, (ctx, pid) => buildings.speedupCost(ctx, pid, req.params.cityId, req.params.positionId)),
  );
  app.post('/cities/:cityId/buildings/:positionId/speedup', s(tags.buildings, 'Speed up (castle.speedUpBuildCommand)', { params: cityPos, body: speedBody }), (req) =>
    game(req, (ctx, pid) => buildings.speedup(ctx, pid, req.params.cityId, req.params.positionId, req.body.itemId)),
  );

  // ---- research ----
  app.get('/cities/:cityId/research', s(tags.research, 'Technologies (tech.getResearchList)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => research.researchList(ctx, pid, req.params.cityId)),
  );
  app.post('/cities/:cityId/research', s(tags.research, 'Start research (tech.research)', { params: zCityParams, body: z.object({ techId: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => research.startResearch(ctx, pid, req.params.cityId, req.body.techId)),
  );
  app.delete('/cities/:cityId/research', s(tags.research, 'Cancel research (tech.cancelResearch)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => research.cancelResearch(ctx, pid, req.params.cityId)),
  );
  app.get('/cities/:cityId/research/speedup', s(tags.research, 'Coins to finish now (tech.getCoinsNeed)', { params: zCityParams }), (req) =>
    game(req, (ctx, pid) => research.researchSpeedupCost(ctx, pid, req.params.cityId)),
  );
  app.post('/cities/:cityId/research/speedup', s(tags.research, 'Speed up (tech.speedUpResearch)', { params: zCityParams, body: speedBody }), (req) =>
    game(req, (ctx, pid) => research.speedupResearch(ctx, pid, req.params.cityId, req.body.itemId)),
  );

  // ---- troops & fortifications ----
  for (const kind of ['troops', 'fortifications'] as const) {
    const fort = kind === 'fortifications';
    const tag = tags.troops;
    app.get(`/cities/:cityId/${kind}/trainable`, s(tag, `Trainable ${kind} (${fort ? 'fortifications.getFortificationsProduceList' : 'troop.getTroopProduceList'})`, { params: zCityParams }), (req) =>
      game(req, (ctx, pid) => training.trainableList(ctx, pid, req.params.cityId, fort)),
    );
    app.get(`/cities/:cityId/${kind}/queues`, s(tag, `Production queues (${kind.slice(0, 5)}.getProduceQueue)`, { params: zCityParams }), (req) =>
      game(req, (ctx, pid) => training.productionQueues(ctx, pid, req.params.cityId, fort)),
    );
    app.post(
      `/cities/:cityId/${kind}/train`,
      s(tag, fort ? 'Build fortifications (fortifications.produceWallProtect)' : 'Train troops at a barracks (troop.produceTroop)', {
        params: zCityParams,
        body: z.object({ troopId: z.number().int(), count: z.number().int(), positionId: z.number().int().optional() }),
      }),
      (req) => game(req, (ctx, pid) => training.train(ctx, pid, req.params.cityId, req.body.troopId, req.body.count, fort ? training.WALLS_QUEUE : (req.body.positionId ?? -999))),
    );
    const qParams = zCityParams.extend({ positionId: pos, queueId: zId });
    app.delete(`/cities/:cityId/${kind}/queues/:positionId/:queueId`, s(tag, 'Cancel a batch', { params: qParams }), (req) =>
      game(req, (ctx, pid) => training.cancelTraining(ctx, pid, req.params.cityId, fort ? training.WALLS_QUEUE : req.params.positionId, req.params.queueId)),
    );
    app.post(
      `/cities/:cityId/${kind}/queues/:positionId/:queueId/speedup`,
      s(tag, fort ? "Archimedes' Note: -30% (fortifications.accTroopProduce)" : "Napoleon's Diary: -30% (troop.accTroopProduce)", { params: qParams }),
      (req) => game(req, (ctx, pid) => training.speedupTraining(ctx, pid, req.params.cityId, fort ? training.WALLS_QUEUE : req.params.positionId, req.params.queueId)),
    );
  }
  app.post('/cities/:cityId/troops/disband', s(tags.troops, 'Dismiss troops (troop.disbandTroop)', { params: zCityParams, body: z.object({ troopId: z.number().int(), count: z.number().int() }) }), (req) =>
    game(req, (ctx, pid) => training.disbandTroops(ctx, pid, req.params.cityId, req.body.troopId, req.body.count)),
  );
  app.post(
    '/cities/:cityId/fortifications/destroy',
    s(tags.troops, 'Destroy fortifications (fortifications.destructWallProtect)', { params: zCityParams, body: z.object({ troopId: z.number().int(), count: z.number().int() }) }),
    (req) => game(req, (ctx, pid) => training.destroyForts(ctx, pid, req.params.cityId, req.body.troopId, req.body.count)),
  );
  app.post('/cities/:cityId/troops/injured/cure', s(tags.troops, 'Heal injured troops (army.cureInjuredTroop)', { params: zCityParams, body: z.object({ troops: zTroops }) }), (req) =>
    game(req, (ctx, pid) => training.cureInjured(ctx, pid, req.params.cityId, req.body.troops)),
  );
  app.post('/cities/:cityId/troops/injured/disband', s(tags.troops, 'Dismiss injured troops (army.disbandInjuredTroop)', { params: zCityParams, body: z.object({ troops: zTroops }) }), (req) =>
    game(req, (ctx, pid) => training.disbandInjured(ctx, pid, req.params.cityId, req.body.troops)),
  );
}
