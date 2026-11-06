// (marchlands) Hero gear (shared/core gear.ts): the lord's 14 pieces with their level and stars, and
// on each hero card the gear bonus and the attribute it boosts.

import { Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { getCitiesByCityIdQueryKey, getPlayerQueryKey, postGearStarMutation } from '@marchlands/api-client';
import { BALANCE, GEAR_PIECES, type GearPieceId, gearSetBonus, gearSetStars, gearStarCost, gearStarLimit, TechType } from '@marchlands/core';

import { levelPoints, maxLevel, maxStars, setBonus } from '@/components/hero-gear/constants';
import { LEVEL_BURST_STAGGER_MS } from '@/components/hero-gear/gear-card/constants';
import { gearLevelRose, rememberedGearLevel, rememberGearLevel } from '@/components/hero-gear/gear-card/utils';
import { GearIcon } from '@/components/hero-gear/gear-icon/gear-icon';
import { Stars } from '@/components/hero-gear/stars/stars';
import { startBurst } from '@/components/hero-gear/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { gearName, itemName, itemShortName } from '@/lib/game-data';
import { allOf } from '@/lib/query-keys';

/**
 * The lord's gear: every piece's level (Hero Enhancement) and stars, with a button to add a star. A star added makes
 * its piece burst and the star twinkle; a gear level gained since the card last showed it (remembered in this browser)
 * makes every piece burst in turn (docs/features/gear-animations.md).
 */
export function GearCard({ onResearch }: { onResearch?: () => void }) {
  const { t } = useTranslation(['hero-gear', 'common']);
  const player = usePlayer();
  const inv = useInventory();
  const gear = player.data?.gear;
  const addStar = useCommand(postGearStarMutation(), () => [getPlayerQueryKey(), allOf(getCitiesByCityIdQueryKey)], t('card.starAdded'));
  // the star just added, for its twinkle; `n` replays it for the next
  const [added, setAdded] = useState<{ piece: GearPieceId; star: number; n: number } | null>(null);
  const playerId = player.data?.playerInfo.id;
  const level = gear?.level;
  // the level this card last showed, and whose: a rise since then bursts every piece, one after another
  const shown = useRef<{ playerId: number; level: number } | null>(null);
  useEffect(() => {
    if (playerId == null || level == null) return;
    const before = shown.current?.playerId === playerId ? shown.current.level : rememberedGearLevel(playerId);
    if (gearLevelRose(before, level)) {
      const now = performance.now();
      GEAR_PIECES.forEach((p, i) => startBurst(p.id, now + i * LEVEL_BURST_STAGGER_MS));
    }
    shown.current = { playerId, level };
    rememberGearLevel(playerId, level);
  }, [playerId, level]);
  if (!gear) return null;
  const starLimit = gearStarLimit(gear);
  const research = player.data?.research[TechType.HERO_ENHANCEMENT]?.level ?? 0;
  // the set bonus: the star level every piece has reached (heroes below that tier get less)
  const setStars = gearSetStars(gear);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('card.title')}</CardTitle>
        <CardDescription>
          {t('card.description', { pieces: GEAR_PIECES.length, research, max: maxLevel, heroMaxLevel: BALANCE.heroMaxLevel, levelPoints, setBonus })}
        </CardDescription>
        <div className="text-xs tabular-nums">
          {setStars > 0 ? (
            <Trans
              t={t}
              i18nKey="card.setBonus"
              values={{ bonus: gearSetBonus(setStars), count: setStars }}
              components={{ b: <span className="font-semibold" /> }}
            />
          ) : (
            t('card.setBonusNone', { bonus: setBonus })
          )}
          {setStars > 0 && setStars < maxStars && ` ${t('card.setBonusNext', { bonus: setBonus, count: setStars + 1 })}`}
        </div>
        {gear.level === 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <span>{t('card.levelZero')}</span>
            {onResearch && (
              <Button size="xs" variant="outline" onClick={onResearch}>
                {t('card.goToResearch')}
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      {/* two columns once the card, not the screen, is wide enough for an icon, its stars and the star button */}
      <CardContent className="@container">
        <div className="grid gap-2 @lg:grid-cols-2">
          {GEAR_PIECES.map((p) => {
            const stars = gear.stars[p.id] ?? 0;
            const full = stars >= maxStars;
            const cost = full ? null : gearStarCost(stars + 1);
            const owned = cost ? inv.count(cost.itemId) : 0;
            const medal = cost ? itemName(cost.itemId) : '';
            // stars cannot go beyond the Hero Enhancement level; any bought above it wait, unused
            const capped = !full && stars >= starLimit;
            return (
              <div key={p.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <GearIcon piece={p.id} level={gear.level} />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <div className="font-medium">
                    {gearName(p.id)}{' '}
                    <span className="font-normal text-muted-foreground tabular-nums">{t('common:level.ofMax', { level: gear.level, max: maxLevel })}</span>
                  </div>
                  <Stars count={stars} used={starLimit} fresh={added?.piece === p.id ? added : undefined} />
                  {cost ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={capped || owned < cost.count || addStar.isPending}
                            onClick={() =>
                              addStar.mutate(
                                { path: { pieceId: p.id } },
                                {
                                  onSuccess: () => {
                                    startBurst(p.id);
                                    setAdded((a) => ({ piece: p.id, star: stars, n: (a?.n ?? 0) + 1 }));
                                  },
                                },
                              )
                            }
                          >
                            <Star className="size-3" />{' '}
                            {capped ? t('card.needsResearch', { level: stars + 1 }) : t('card.medalCost', { n: cost.count, medal: itemShortName(cost.itemId) })}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {capped
                          ? stars > starLimit
                            ? t('card.starNeedsResearchWaiting', { star: stars + 1, level: gear.level, used: starLimit, count: stars })
                            : t('card.starNeedsResearch', { star: stars + 1, level: gear.level })
                          : t('card.starCost', { star: stars + 1, count: cost.count, medal, owned })}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground" title={stars > starLimit ? t('card.starsAboveHint') : undefined}>
                      {stars > starLimit ? t('card.starsCount', { used: starLimit, stars }) : t('card.allStars')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
