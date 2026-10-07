// (evony-re) Hero gear (shared/core gear.ts): the lord's 14 pieces with their level and stars, and
// on each hero card the gear bonus and the attribute it boosts.

import { Star } from 'lucide-react';
import type { HeroBean, LordGear } from '@evony/api-client';
import { BALANCE, GEAR_PIECES, GEAR_STATS, gearStarCost, gearStarLimit, heroGearBreakdown, itemConfig, TechType } from '@evony/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';
import { attributeOfStat } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

const { maxLevel, maxStars, starPoints } = BALANCE.heroGear;

/** The lord's gear: every piece's level (Hero Enhancement) and stars, with a button to add a star. */
export function GearCard({ onResearch }: { onResearch?: () => void }) {
  const player = usePlayer();
  const inv = useInventory();
  const gear = player.data?.gear;
  const addStar = useCommand(
    (pieceId: string) => unwrap(api.POST('/api/v1/gear/{pieceId}/star', { params: { path: { pieceId } } })),
    () => [qk.player, ['city']],
    'Star added',
  );
  if (!gear) return null;
  const starLimit = gearStarLimit(gear);
  const research = player.data?.research[TechType.HERO_ENHANCEMENT]?.level ?? 0;
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Hero gear</CardTitle>
        <CardDescription>
          Every hero wears all {GEAR_PIECES.length} pieces. Their level is your Hero Enhancement research ({research}/{maxLevel}, in the Academy); stars are
          bought with medals. A hero uses gear levels and stars up to its gear tier: none at hero levels 1-9, 1 at 10-19, … 9 at 90-99, all {maxLevel} at level{' '}
          {BALANCE.heroMaxLevel}. A piece at level L adds 1 + … + L points, each star +{starPoints}.
        </CardDescription>
        {gear.level === 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <span>Your gear is level 0: only stars count until you research Hero Enhancement in the Academy (level N needs Academy level N).</span>
            {onResearch && (
              <Button size="xs" variant="outline" onClick={onResearch}>
                Go to Research
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {GEAR_PIECES.map((p) => {
          const stars = gear.stars[p.id] ?? 0;
          const full = stars >= maxStars;
          const cost = full ? null : gearStarCost(stars + 1);
          const owned = cost ? inv.count(cost.itemId) : 0;
          const medal = cost ? (itemConfig(cost.itemId)?.name ?? cost.itemId) : '';
          // stars cannot go beyond the Hero Enhancement level; any bought above it wait, unused
          const capped = !full && stars >= starLimit;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  {p.name}{' '}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    Lv {gear.level}/{maxLevel}
                  </span>
                </div>
                <Stars count={stars} used={starLimit} />
              </div>
              {cost ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="xs" variant="outline" disabled={capped || owned < cost.count || addStar.isPending} onClick={() => addStar.mutate(p.id)}>
                        <Star className="size-3" /> {capped ? `Needs research ${stars + 1}` : `${cost.count}× ${medal.replace(/ Medal$/, '')}`}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {capped ? (
                      `Star ${stars + 1} needs Hero Enhancement level ${stars + 1} (now ${gear.level})${stars > starLimit ? `; only ${starLimit} of the ${stars} stars count until then` : ''}`
                    ) : (
                      <>
                        Star {stars + 1}: {cost.count} {medal}
                        {cost.count > 1 ? 's' : ''} (you have {owned})
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span
                  className="text-xs text-muted-foreground"
                  title={stars > starLimit ? 'Stars above your Hero Enhancement level count once you research it' : undefined}
                >
                  {stars > starLimit ? `${starLimit} of ${stars} count` : 'All stars'}
                </span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Stars({ count, used }: { count: number; used?: number }) {
  return (
    <div className="flex gap-px" aria-label={`${count} of ${maxStars} stars`}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3',
            i < count
              ? used == null || i < used
                ? 'fill-amber-400 text-amber-500'
                : 'fill-amber-200 text-amber-300 dark:fill-amber-900 dark:text-amber-800'
              : 'text-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}

/** On a hero card: the gear bonus this hero gets, its gear tier, and the attribute the gear boosts (free to change). */
export function HeroGearLine({ hero, cityId }: { hero: HeroBean; cityId: number }) {
  const gear: LordGear | undefined = usePlayer().data?.gear;
  const setStat = useCommand(
    (stat: (typeof GEAR_STATS)[number]) => unwrap(api.PUT('/api/v1/heroes/{heroId}/gear-stat', { params: { path: { heroId: hero.id } }, body: { stat } })),
    () => [qk.city(cityId)],
  );
  if (!gear || hero.seized) return null;
  const { tier, total } = heroGearBreakdown(hero.level, gear);
  const current = attributeOfStat(hero.gearStat);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">
            Gear <span className={cn('rounded px-1 py-px font-semibold', current.tone)}>+{total}</span> · tier {tier}/{maxLevel}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Uses gear level {Math.min(gear.level, tier)} and up to {tier} stars per piece
          {tier < maxLevel && ` (tier ${tier + 1} at level ${(tier + 1) * 10})`}
        </TooltipContent>
      </Tooltip>
      <span className="flex gap-0.5" role="group" aria-label="Attribute the gear boosts">
        {GEAR_STATS.map((stat) => {
          const a = attributeOfStat(stat);
          const on = stat === hero.gearStat;
          return (
            <button
              key={stat}
              type="button"
              disabled={setStat.isPending}
              aria-pressed={on}
              title={on ? `Gear boosts ${a.label}` : `Put the gear on ${a.label}`}
              className={cn('rounded px-1.5 py-px font-medium uppercase', on ? a.tone : 'text-muted-foreground hover:bg-muted')}
              onClick={() => !on && setStat.mutate(stat)}
            >
              {a.short}
            </button>
          );
        })}
      </span>
    </div>
  );
}
