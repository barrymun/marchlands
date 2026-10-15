// (marchlands) Hero gear (shared/core gear.ts): the lord's 14 pieces with their level and stars, and
// on each hero card the gear bonus and the attribute it boosts.

import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getCitiesByCityIdQueryKey, getPlayerQueryKey, postGearStarMutation } from '@marchlands/api-client';
import { BALANCE, GEAR_PIECES, gearStarCost, gearStarLimit, TechType } from '@marchlands/core';

import { maxLevel, maxStars, starPoints } from '@/components/hero-gear/constants';
import { Stars } from '@/components/hero-gear/gear-card/stars/stars';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { gearName, itemName, itemShortName } from '@/lib/game-data';
import { allOf } from '@/lib/query-keys';

/** The lord's gear: every piece's level (Hero Enhancement) and stars, with a button to add a star. */
export function GearCard({ onResearch }: { onResearch?: () => void }) {
  const { t } = useTranslation(['hero-gear', 'common']);
  const player = usePlayer();
  const inv = useInventory();
  const gear = player.data?.gear;
  const addStar = useCommand(postGearStarMutation(), () => [getPlayerQueryKey(), allOf(getCitiesByCityIdQueryKey)], t('card.starAdded'));
  if (!gear) return null;
  const starLimit = gearStarLimit(gear);
  const research = player.data?.research[TechType.HERO_ENHANCEMENT]?.level ?? 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('card.title')}</CardTitle>
        <CardDescription>
          {t('card.description', { pieces: GEAR_PIECES.length, research, max: maxLevel, heroMaxLevel: BALANCE.heroMaxLevel, starPoints })}
        </CardDescription>
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
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {GEAR_PIECES.map((p) => {
          const stars = gear.stars[p.id] ?? 0;
          const full = stars >= maxStars;
          const cost = full ? null : gearStarCost(stars + 1);
          const owned = cost ? inv.count(cost.itemId) : 0;
          const medal = cost ? itemName(cost.itemId) : '';
          // stars cannot go beyond the Hero Enhancement level; any bought above it wait, unused
          const capped = !full && stars >= starLimit;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  {gearName(p.id)}{' '}
                  <span className="font-normal text-muted-foreground tabular-nums">{t('common:level.ofMax', { level: gear.level, max: maxLevel })}</span>
                </div>
                <Stars count={stars} used={starLimit} />
              </div>
              {cost ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={capped || owned < cost.count || addStar.isPending}
                        onClick={() => addStar.mutate({ path: { pieceId: p.id } })}
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
          );
        })}
      </CardContent>
    </Card>
  );
}
