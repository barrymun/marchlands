-- (marchlands) buffs set before they recorded their item (BuffState.itemId) get one, so the Items tab can show which
-- item is running: each of these bonuses comes from a 1-day and a 7-day item; more than a day left means the 7-day one
UPDATE "players" SET "buffs" = (
  SELECT jsonb_agg(
    CASE
      WHEN b ? 'itemId' OR NOT (b->>'id' = ANY (ARRAY['FoodProductionBuff', 'WoodProductionBuff', 'StoneProductionBuff', 'IronProductionBuff', 'GoldProductionBuff', 'TrainCostReduceBuff', 'UpkeepReduceBuff'])) THEN b
      ELSE b || jsonb_build_object('itemId', CASE
        WHEN (b->>'endTime')::bigint - (extract(epoch FROM now()) * 1000)::bigint > 86400000 THEN CASE b->>'id'
          WHEN 'FoodProductionBuff' THEN 'player.resinc.1.b'
          WHEN 'WoodProductionBuff' THEN 'player.resinc.2.b'
          WHEN 'StoneProductionBuff' THEN 'player.resinc.3.b'
          WHEN 'IronProductionBuff' THEN 'player.resinc.4.b'
          WHEN 'GoldProductionBuff' THEN 'player.gold.1.b'
          WHEN 'TrainCostReduceBuff' THEN 'player.reduce.troops.cost.7'
          WHEN 'UpkeepReduceBuff' THEN 'player.reduce.troops.upkeep.7'
        END
        ELSE CASE b->>'id'
          WHEN 'FoodProductionBuff' THEN 'player.resinc.1'
          WHEN 'WoodProductionBuff' THEN 'player.resinc.2'
          WHEN 'StoneProductionBuff' THEN 'player.resinc.3'
          WHEN 'IronProductionBuff' THEN 'player.resinc.4'
          WHEN 'GoldProductionBuff' THEN 'player.gold.1.a'
          WHEN 'TrainCostReduceBuff' THEN 'player.reduce.troops.cost.1'
          WHEN 'UpkeepReduceBuff' THEN 'player.reduce.troops.upkeep.1'
        END
      END)
    END
  )
  FROM jsonb_array_elements("buffs") b
)
WHERE jsonb_array_length("buffs") > 0;
