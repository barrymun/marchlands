import { useTranslation } from 'react-i18next';

import { GEAR_ART, maxStars } from '@/components/hero-gear/constants';
import { starKind } from '@/components/hero-gear/stars/utils';
import { gearStarFile } from '@/lib/game-art';
import { cn } from '@/lib/utils';

/**
 * A piece's stars in pixel art, two rows of five: red in use, orange waiting above the research level (`used`), grey not
 * yet bought. `size` is a star's pixels: 18 (twice the art) or 9 (the art's own size, beside a small icon). `fresh` is a
 * star just added (from 0), which twinkles once; a new `n` plays it again. Still with reduced motion.
 */
export function Stars({ count, used, size = 18, fresh }: { count: number; used?: number; size?: 9 | 18; fresh?: { star: number; n: number } }) {
  const { t } = useTranslation('hero-gear');
  return (
    // a picture of the stars, named by how many: a label on a plain div is one ARIA doesn't allow
    <div role="img" className="grid w-fit grid-cols-5 gap-px" aria-label={t('stars.label', { n: count, count: maxStars })}>
      {Array.from({ length: maxStars }, (_, i) => (
        <img
          // a new key mounts the star afresh, so its twinkle plays from the start
          key={i === fresh?.star ? `${i}:${fresh.n}` : i}
          src={GEAR_ART[gearStarFile(starKind(i, count, used))]}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className={cn('[image-rendering:pixelated]', i === fresh?.star && 'motion-safe:animate-gear-star')}
        />
      ))}
    </div>
  );
}
