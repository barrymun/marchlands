import type { HeroBean } from '@marchlands/api-client';
import { dominantAttribute } from '@/lib/hero-attributes';
import { cn } from '@/lib/utils';

/** The hero's strongest attribute as a coloured badge (politics green, attack red, intelligence blue). */
export function DominantBadge({ hero }: { hero: HeroBean }) {
  const top = dominantAttribute(hero);
  return <span className={cn('rounded px-1 py-px font-semibold tabular-nums', top.tone)}>{`${top.label} ${top.v}`}</span>;
}
