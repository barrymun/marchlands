ALTER TABLE "heroes" ADD COLUMN "sex" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Heroes made before hero sex was kept: those named with one of the old generator's women's names are women, all others
-- men (renamed heroes give nothing to go on). Heroes still in an Inn are renamed by the worker at start-up (innNamesJob).
UPDATE "heroes" SET "sex" = 1
WHERE split_part("name", ' ', 1) IN ('Adela', 'Beatrix', 'Cunigunde', 'Edith', 'Gisela', 'Hildegard', 'Isolde', 'Mathilda', 'Richenza', 'Sibylla');
