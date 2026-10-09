-- (marchlands) Speakers (and their 10 / 100 packs) are removed from the game: World chat is free
-- (core REMOVED_ITEMS); drop them from lords' items
UPDATE "players" SET "items" = "items" - ARRAY['consume.1.a', 'consume.1.b', 'consume.1.c']
WHERE "items" ?| ARRAY['consume.1.a', 'consume.1.b', 'consume.1.c'];
