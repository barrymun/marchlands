-- (marchlands) the tax rate now sells that share of a city's field output to the merchant as it is produced,
-- while the people always pay the base tax (BALANCE.baseTaxShare, the old 10%). Cities start at 0% so nothing
-- is sold until the lord chooses a rate.
UPDATE "cities" SET "tax_rate" = 0;
