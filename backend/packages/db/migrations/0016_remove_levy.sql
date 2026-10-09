-- (marchlands) the levy (interior.taxation) is removed: with no city loyalty it had no cost; drop its cooldown stamp
UPDATE "cities" SET "misc" = "misc" - 'lastLevyAt' WHERE "misc" ? 'lastLevyAt';
