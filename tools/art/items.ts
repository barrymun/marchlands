// Items: one 32×32 icon per item (client/web/src/lib/game-art.ts, itemArtFile), drawn side on and lit from the top left
// like the troops, one module per kind of item in tools/art/items/ (design: docs/features/item-art.md). The original
// game's icons were looked at for what each item shows (docs/reference/items.md), never traced.

import { ItemId } from '@marchlands/core';

import { BOX_DRAWINGS } from './items/boxes.ts';
import { CITY_DRAWINGS } from './items/city.ts';
import { HERO_DRAWINGS } from './items/heroes.ts';
import { MEDAL_DRAWINGS } from './items/medals.ts';
import { MILITARY_DRAWINGS } from './items/military.ts';
import { PRODUCTION_DRAWINGS } from './items/production.ts';
import { SPEEDUP_DRAWINGS } from './items/speedups.ts';
import type { PixelCanvas } from './pixel.ts';

const S = SPEEDUP_DRAWINGS;
const P = PRODUCTION_DRAWINGS;
const M = MILITARY_DRAWINGS;
const C = CITY_DRAWINGS;
const B = BOX_DRAWINGS;
const H = HERO_DRAWINGS;
const MEDAL = MEDAL_DRAWINGS;

/** Every item's drawing, by item id. */
export const ITEM_DRAWINGS: Record<ItemId, () => PixelCanvas> = {
  [ItemId.BEGINNER_GUIDELINES]: S.beginner,
  [ItemId.PRIMARY_GUIDELINES]: S.primary,
  [ItemId.INTERMEDIATE_GUIDELINES]: S.intermediate,
  [ItemId.SENIOR_GUIDELINES]: S.senior,
  [ItemId.MASTER_GUIDELINES]: S.master,
  [ItemId.ULTIMATE_GUIDELINES]: S.ultimate,
  [ItemId.NAPOLEONS_DIARY]: S.napoleonsDiary,
  [ItemId.ARCHIMEDES_NOTE]: S.archimedesNote,
  [ItemId.PLOWSHARES]: P.plowshares,
  [ItemId.IRON_RAKE]: P.ironRake,
  [ItemId.ARCH_SAW]: P.archSaw,
  [ItemId.DOUBLE_SAW]: P.doubleSaw,
  [ItemId.QUARRYING_TOOLS]: P.quarryingTools,
  [ItemId.ADV_QUARRYING_TOOLS]: P.advQuarryingTools,
  [ItemId.BLOWER]: P.blower,
  [ItemId.BLAST_FURNACE]: P.blastFurnace,
  [ItemId.TAX_POLICY]: P.taxPolicy,
  [ItemId.ADV_TAX_POLICY]: P.advTaxPolicy,
  [ItemId.WAR_HORN]: M.warHorn,
  [ItemId.IVORY_HORN]: M.ivoryHorn,
  [ItemId.CORSELET]: M.corselet,
  [ItemId.ULTRA_CORSELET]: M.ultraCorselet,
  [ItemId.WAR_ENSIGN]: M.warEnsign,
  [ItemId.BERNINIS_HAMMER]: M.berninisHammer,
  [ItemId.VESTAS_BLESSING]: M.vestasBlessing,
  [ItemId.VESTAS_GRAND_BLESSING]: M.vestasGrandBlessing,
  [ItemId.QUARTERMASTERS_SEAL]: M.quartermastersSeal,
  [ItemId.QUARTERMASTERS_CHARTER]: M.quartermastersCharter,
  [ItemId.TRUCE_AGREEMENT]: C.truceAgreement,
  [ItemId.CITY_TELEPORTER]: C.cityTeleporter,
  [ItemId.CIVIL_CODE]: C.civilCode,
  [ItemId.PENICILLIN]: C.penicillin,
  [ItemId.JUNIOR_MEDAL_BOX]: B.juniorMedalBox,
  [ItemId.MEDIUM_MEDAL_BOX]: B.mediumMedalBox,
  [ItemId.SENIOR_MEDAL_BOX]: B.seniorMedalBox,
  [ItemId.HERO_PACKAGE]: B.heroPackage,
  [ItemId.WELCOME_PACKAGE]: B.welcomePackage,
  [ItemId.HOLY_WATER]: H.holyWater,
  [ItemId.EXCALIBUR]: H.excalibur,
  [ItemId.WEALTH_OF_NATIONS]: H.wealthOfNations,
  [ItemId.ART_OF_WAR]: H.artOfWar,
  [ItemId.ANABASIS]: H.anabasis,
  [ItemId.EPITOME_OF_MILITARY_SCIENCE]: H.epitome,
  [ItemId.ON_WAR]: H.onWar,
  [ItemId.CROSS_MEDAL]: MEDAL.cross,
  [ItemId.ROSE_MEDAL]: MEDAL.rose,
  [ItemId.LION_MEDAL]: MEDAL.lion,
  [ItemId.HONOUR_MEDAL]: MEDAL.honour,
  [ItemId.COURAGE_MEDAL]: MEDAL.courage,
  [ItemId.WISDOM_MEDAL]: MEDAL.wisdom,
  [ItemId.FREEDOM_MEDAL]: MEDAL.freedom,
  [ItemId.JUSTICE_MEDAL]: MEDAL.justice,
  [ItemId.NATION_MEDAL]: MEDAL.nation,
};
