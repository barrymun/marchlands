ALTER TABLE "heroes" ADD COLUMN "gear_stat" text;--> statement-breakpoint
-- (marchlands) hero gear: the gear boosts each hero's current strongest attribute until the lord picks another
UPDATE "heroes" SET "gear_stat" = CASE
  WHEN "power" >= "management" AND "power" >= "stratagem" THEN 'power'
  WHEN "management" >= "stratagem" THEN 'management'
  ELSE 'stratagem' END
WHERE "player_id" IS NOT NULL;--> statement-breakpoint
-- heroes stop at level 100 (BALANCE.heroMaxLevel): cap them, drop experience at the cap
UPDATE "heroes" SET "level" = 100, "experience" = 0, "upgrade_exp" = 1000000 WHERE "level" >= 100;--> statement-breakpoint
-- every lord's heroes get their attribute points back to assign again (1 per level)
UPDATE "heroes" SET "power" = "base_power", "management" = "base_management", "stratagem" = "base_stratagem", "remain_point" = "level"
WHERE "player_id" IS NOT NULL;
