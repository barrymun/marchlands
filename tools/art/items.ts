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
  [ItemId.NOVICES_NOTES]: S.novicesNotes,
  [ItemId.APPRENTICES_NOTES]: S.apprenticesNotes,
  [ItemId.JOURNEYMANS_NOTES]: S.journeymansNotes,
  [ItemId.MASTERS_NOTES]: S.mastersNotes,
  [ItemId.GRANDMASTERS_NOTES]: S.grandmastersNotes,
  [ItemId.VILLARDS_SKETCHBOOK]: S.villardsSketchbook,
  [ItemId.OTTOS_MUSTER_ROLL]: S.ottosMusterRoll,
  [ItemId.HENRYS_CASTLE_LAW]: S.henrysCastleLaw,
  [ItemId.PLOUGHSHARE]: P.ploughshare,
  [ItemId.HEAVY_PLOUGH]: P.heavyPlough,
  [ItemId.BOW_SAW]: P.bowSaw,
  [ItemId.WATER_SAW]: P.waterSaw,
  [ItemId.MASONS_PICK]: P.masonsPick,
  [ItemId.TREADWHEEL_CRANE]: P.treadwheelCrane,
  [ItemId.HAND_BELLOWS]: P.handBellows,
  [ItemId.WATER_BELLOWS]: P.waterBellows,
  [ItemId.TOLL_RIGHT]: P.tollRight,
  [ItemId.MINT_RIGHT]: P.mintRight,
  [ItemId.WAR_HORN]: M.warHorn,
  [ItemId.OLIFANT]: M.olifant,
  [ItemId.GAMBESON]: M.gambeson,
  [ItemId.HAUBERK]: M.hauberk,
  [ItemId.IMPERIAL_BANNER]: M.imperialBanner,
  [ItemId.BERNWARDS_HAMMER]: M.bernwardsHammer,
  [ItemId.ELIZABETHS_BREAD]: M.elizabethsBread,
  [ItemId.ELIZABETHS_GRANARY]: M.elizabethsGranary,
  [ItemId.MARSHALS_SEAL]: M.marshalsSeal,
  [ItemId.MARSHALS_CHARTER]: M.marshalsCharter,
  [ItemId.KINGS_PEACE]: C.kingsPeace,
  [ItemId.LOCATORS_CHARTER]: C.locatorsCharter,
  [ItemId.MAGDEBURG_RIGHTS]: C.magdeburgRights,
  [ItemId.THERIAC]: C.theriac,
  [ItemId.BRONZE_COFFER]: B.bronzeCoffer,
  [ItemId.SILVER_COFFER]: B.silverCoffer,
  [ItemId.GOLD_COFFER]: B.goldCoffer,
  [ItemId.OATH_OF_FEALTY]: B.oathOfFealty,
  [ItemId.FOUNDERS_GIFT]: B.foundersGift,
  [ItemId.HOLY_WATER]: H.holyWater,
  [ItemId.JOYEUSE]: H.joyeuse,
  [ItemId.MIRROR_OF_KINGS]: H.mirrorOfKings,
  [ItemId.STRATAGEMS]: H.stratagems,
  [ItemId.DEEDS_OF_THE_SAXONS]: H.deedsOfTheSaxons,
  [ItemId.EPITOME_OF_MILITARY_SCIENCE]: H.epitome,
  [ItemId.NIBELUNGENLIED]: H.nibelungenlied,
  [ItemId.CROSS_MEDAL]: MEDAL.cross,
  [ItemId.ROSE_MEDAL]: MEDAL.rose,
  [ItemId.LION_MEDAL]: MEDAL.lion,
  [ItemId.HONOUR_MEDAL]: MEDAL.honour,
  [ItemId.COURAGE_MEDAL]: MEDAL.courage,
  [ItemId.WISDOM_MEDAL]: MEDAL.wisdom,
  [ItemId.FIDELITY_MEDAL]: MEDAL.fidelity,
  [ItemId.JUSTICE_MEDAL]: MEDAL.justice,
  [ItemId.CROWN_MEDAL]: MEDAL.crown,
};
