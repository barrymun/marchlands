// What the API tests reach into to arrange state (@marchlands/game/testing). App code uses the package index only;
// every export is tagged @internal so `knip --production` doesn't count them as unused.
/** @internal */
export { setBuff } from '#/helpers.ts';
/** @internal */
export { getArmy, getCity, getHero, getPlayer, getTile, saveCity, saveHero, savePlayer, saveTile, type HeroRow, type TileRow } from '#/repo.ts';
/** @internal */
export { processArmy } from '#/engine/combat.ts';
/** @internal */
export { createReport } from '#/engine/reports.ts';
/** @internal */
export { pickOpenFlat } from '#/engine/world.ts';
