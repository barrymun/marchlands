-- (marchlands) The server no longer stores English for players: what it tells them is a message, a code plus params
-- (shared/core/src/messages), worded by the client in the player's language. This converts what was stored as text.
-- Text with a known meaning gets its code; anything else becomes common.legacyText, shown as it was.
CREATE FUNCTION pg_temp.legacy(t text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL THEN NULL ELSE jsonb_build_object('code', 'common.legacyText', 'params', jsonb_build_object('text', t)) END
$$;--> statement-breakpoint
-- a stored value that is still a string becomes a legacy message; one already a message stays
CREATE FUNCTION pg_temp.as_msg(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v IS NULL OR jsonb_typeof(v) = 'null' THEN v WHEN jsonb_typeof(v) = 'string' THEN pg_temp.legacy(v #>> '{}') ELSE v END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.m(code text, params jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN params IS NULL THEN jsonb_build_object('code', code) ELSE jsonb_build_object('code', code, 'params', params) END
$$;--> statement-breakpoint

-- report titles
ALTER TABLE "reports" ALTER COLUMN "title" SET DATA TYPE jsonb USING (
  CASE
    WHEN "title" = 'Mission aborted' THEN pg_temp.m('report.title.missionAborted')
    WHEN "title" = 'Scout Returned' THEN pg_temp.m('report.title.scoutReturned')
    WHEN "title" = 'Attack Returned' THEN pg_temp.m('report.title.attackReturned')
    WHEN "title" = 'Returned' THEN pg_temp.m('report.title.returned')
    WHEN "title" = 'Transport Report' THEN pg_temp.m('report.title.transportReport')
    WHEN "title" = 'Transport Received' THEN pg_temp.m('report.title.transportReceived')
    WHEN "title" = 'Reinforcement Arrived' THEN pg_temp.m('report.title.reinforcementArrived')
    WHEN "title" LIKE 'Reinforcements from %' THEN pg_temp.m('report.title.reinforcementsFrom', jsonb_build_object('name', substr("title", 21)))
    WHEN "title" = 'New City Founded' THEN pg_temp.m('report.title.newCityFounded')
    WHEN "title" = 'Scout Report' THEN pg_temp.m('report.title.scoutReport')
    WHEN "title" = 'Enemy Scouts' THEN pg_temp.m('report.title.enemyScouts')
    WHEN "title" = 'Scouts Repelled' THEN pg_temp.m('report.title.scoutsRepelled')
    WHEN "title" = 'Attack Succeeded' THEN pg_temp.m('report.title.attackSucceeded')
    WHEN "title" = 'Attack Failed' THEN pg_temp.m('report.title.attackFailed')
    WHEN "title" = 'City Attacked' THEN pg_temp.m('report.title.cityAttacked')
    WHEN "title" = 'Attack Repelled' THEN pg_temp.m('report.title.attackRepelled')
    WHEN "title" = 'Reinforcements Fought' THEN pg_temp.m('report.title.reinforcementsFought')
    WHEN "title" = 'Valley Occupied' THEN pg_temp.m('report.title.valleyOccupied')
    WHEN "title" = 'Valley Lost' THEN pg_temp.m('report.title.valleyLost')
    WHEN "title" = 'Valley Defended' THEN pg_temp.m('report.title.valleyDefended')
    WHEN "title" = 'Trade Completed' THEN pg_temp.m('report.title.tradeCompleted')
    WHEN "title" = 'Troops Deserted' THEN pg_temp.m('report.title.troopsDeserted')
    ELSE pg_temp.legacy("title")
  END
);--> statement-breakpoint

-- report bodies: text reports, a valley battle's reason ('' meant none), and battle bonuses (boost descriptions)
CREATE FUNCTION pg_temp.bonus(b jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(b -> 'desc') <> 'string' THEN b
    WHEN b ->> 'desc' = 'Troop attack +20%' THEN jsonb_set(b, '{desc}', pg_temp.m('buff.troopAttack', '{"percent":20}'))
    WHEN b ->> 'desc' = 'Troop defense +20%' THEN jsonb_set(b, '{desc}', pg_temp.m('buff.troopDefense', '{"percent":20}'))
    WHEN b ->> 'desc' IN ('Armies may hold 25% more troops', 'Army +25% troops') THEN jsonb_set(b, '{desc}', pg_temp.m('buff.armySize', '{"percent":25}'))
    ELSE jsonb_set(b, '{desc}', pg_temp.legacy(b ->> 'desc'))
  END
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.side(s jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(s -> 'bonuses') = 'array'
    THEN jsonb_set(s, '{bonuses}', (SELECT coalesce(jsonb_agg(pg_temp.bonus(x) ORDER BY i), '[]') FROM jsonb_array_elements(s -> 'bonuses') WITH ORDINALITY AS e(x, i)))
    ELSE s END
$$;--> statement-breakpoint
UPDATE "reports" SET "body" = jsonb_set("body", '{text}', pg_temp.as_msg("body" -> 'text'))
  WHERE "body" ->> 'kind' = 'text' AND jsonb_typeof("body" -> 'text') = 'string';--> statement-breakpoint
UPDATE "reports" SET "body" = jsonb_set("body", '{battle,reason}',
  CASE
    WHEN "body" #>> '{battle,reason}' = '' THEN 'null'::jsonb
    WHEN "body" #>> '{battle,reason}' = 'Your city no longer exists.' THEN pg_temp.m('army.homeCityGone')
    WHEN "body" #>> '{battle,reason}' = 'Your Town Hall level does not allow another valley.' THEN pg_temp.m('army.valleyLimit', '{"building":{"ref":"building","id":31}}')
    ELSE pg_temp.legacy("body" #>> '{battle,reason}')
  END)
  WHERE "body" ->> 'kind' = 'battle' AND jsonb_typeof("body" #> '{battle,reason}') = 'string';--> statement-breakpoint
UPDATE "reports" SET "body" = jsonb_set(jsonb_set("body", '{battle,attacker}', pg_temp.side("body" #> '{battle,attacker}')), '{battle,defender}', pg_temp.side("body" #> '{battle,defender}'))
  WHERE "body" ->> 'kind' = 'battle' AND ("body" #> '{battle,attacker,bonuses}' IS NOT NULL OR "body" #> '{battle,defender,bonuses}' IS NOT NULL);--> statement-breakpoint

-- alliance events and flow stop reasons
ALTER TABLE "alliance_events" ALTER COLUMN "message" SET DATA TYPE jsonb USING pg_temp.legacy("message");--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "stop_reason" SET DATA TYPE jsonb USING pg_temp.legacy("stop_reason");--> statement-breakpoint

-- flow run logs and previews: every text becomes a legacy message (they are replaced by the next run or preview)
CREATE FUNCTION pg_temp.flow_log(log jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN log IS NULL OR jsonb_typeof(log) <> 'object' THEN log ELSE
    jsonb_set(
      CASE WHEN jsonb_typeof(log -> 'skippedCities') = 'array'
        THEN jsonb_set(log, '{skippedCities}', (SELECT coalesce(jsonb_agg(jsonb_set(s, '{reason}', pg_temp.as_msg(s -> 'reason')) ORDER BY i), '[]')
                                                 FROM jsonb_array_elements(log -> 'skippedCities') WITH ORDINALITY AS e(s, i)))
        ELSE log END,
      '{cities}',
      (SELECT coalesce(jsonb_agg(
         jsonb_set(jsonb_set(c, '{error}', coalesce(pg_temp.as_msg(c -> 'error'), 'null'::jsonb)), '{steps}',
           (SELECT coalesce(jsonb_agg(
              CASE WHEN jsonb_typeof(st -> 'items') = 'array'
                THEN jsonb_set(jsonb_set(jsonb_set(st, '{action}', pg_temp.as_msg(st -> 'action')), '{detail}', pg_temp.as_msg(st -> 'detail')), '{items}',
                       (SELECT coalesce(jsonb_agg(jsonb_set(it, '{detail}', pg_temp.as_msg(it -> 'detail')) ORDER BY k), '[]')
                          FROM jsonb_array_elements(st -> 'items') WITH ORDINALITY AS f(it, k)))
                ELSE jsonb_set(jsonb_set(st, '{action}', pg_temp.as_msg(st -> 'action')), '{detail}', pg_temp.as_msg(st -> 'detail'))
              END ORDER BY j), '[]')
            FROM jsonb_array_elements(c -> 'steps') WITH ORDINALITY AS g(st, j)))
       ORDER BY i), '[]')
       FROM jsonb_array_elements(log -> 'cities') WITH ORDINALITY AS h(c, i)))
  END
$$;--> statement-breakpoint
UPDATE "flows" SET "last_run" = pg_temp.flow_log("last_run"), "last_preview" = pg_temp.flow_log("last_preview")
  WHERE "last_run" IS NOT NULL OR "last_preview" IS NOT NULL;--> statement-breakpoint

-- boost descriptions, by boost id (each id has one meaning)
CREATE FUNCTION pg_temp.buff_desc(b jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(b -> 'desc') <> 'string' THEN b ELSE jsonb_set(b, '{desc}', CASE b ->> 'id'
    WHEN 'FoodProductionBuff' THEN pg_temp.m('buff.production', '{"resource":{"ref":"resource","id":"food"},"percent":25}')
    WHEN 'WoodProductionBuff' THEN pg_temp.m('buff.production', '{"resource":{"ref":"resource","id":"wood"},"percent":25}')
    WHEN 'StoneProductionBuff' THEN pg_temp.m('buff.production', '{"resource":{"ref":"resource","id":"stone"},"percent":25}')
    WHEN 'IronProductionBuff' THEN pg_temp.m('buff.production', '{"resource":{"ref":"resource","id":"iron"},"percent":25}')
    WHEN 'GoldProductionBuff' THEN pg_temp.m('buff.goldIncome', '{"percent":25}')
    WHEN 'AttackBuff' THEN pg_temp.m('buff.troopAttack', '{"percent":20}')
    WHEN 'DefenseBuff' THEN pg_temp.m('buff.troopDefense', '{"percent":20}')
    WHEN 'WarEnsignBuff' THEN pg_temp.m('buff.armySize', '{"percent":25}')
    WHEN 'BuildingQueueBuff' THEN pg_temp.m('buff.buildingQueue')
    WHEN 'UpkeepReduceBuff' THEN pg_temp.m('buff.upkeep', '{"percent":50}')
    WHEN 'TrainCostReduceBuff' THEN pg_temp.m('buff.trainingCost', '{"percent":25}')
    WHEN 'PlayerPeaceBuff' THEN pg_temp.m('buff.truce')
    WHEN 'PlayerPeaceCoolDownBuff' THEN pg_temp.m('buff.truceCooldown')
    WHEN 'MoveCastleCoolDownBuff' THEN pg_temp.m('buff.teleportCooldown')
    WHEN 'FurloughBuff' THEN pg_temp.m('buff.holiday')
    WHEN 'power' THEN pg_temp.m('buff.heroStat', '{"stat":{"ref":"stat","id":"power"},"percent":25}')
    WHEN 'management' THEN pg_temp.m('buff.heroStat', '{"stat":{"ref":"stat","id":"management"},"percent":25}')
    WHEN 'stratagem' THEN pg_temp.m('buff.heroStat', '{"stat":{"ref":"stat","id":"stratagem"},"percent":25}')
    WHEN 'homeCity' THEN pg_temp.m('buff.homeCity')
    ELSE pg_temp.legacy(b ->> 'desc')
  END) END
$$;--> statement-breakpoint
UPDATE "players" SET "buffs" = (SELECT coalesce(jsonb_agg(pg_temp.buff_desc(b) ORDER BY i), '[]') FROM jsonb_array_elements("buffs") WITH ORDINALITY AS e(b, i))
  WHERE jsonb_typeof("buffs") = 'array' AND jsonb_array_length("buffs") > 0;--> statement-breakpoint
UPDATE "heroes" SET "buffs" = (SELECT coalesce(jsonb_agg(pg_temp.buff_desc(b) ORDER BY i), '[]') FROM jsonb_array_elements("buffs") WITH ORDINALITY AS e(b, i))
  WHERE jsonb_typeof("buffs") = 'array' AND jsonb_array_length("buffs") > 0;--> statement-breakpoint

-- mail the game sent: its title and content become messages
ALTER TABLE "mails" ADD COLUMN "system" jsonb;--> statement-breakpoint
UPDATE "mails" SET "system" = jsonb_build_object('title', pg_temp.m('player.mail.protectionExpired.title'), 'content', pg_temp.m('player.mail.protectionExpired.content')),
  "title" = '', "content" = ''
  WHERE "type" = 2 AND "other_player_id" IS NULL AND "title" = 'Beginner''s Protection Expired';
