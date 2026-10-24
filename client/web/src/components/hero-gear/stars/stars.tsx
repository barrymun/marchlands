import { useTranslation } from 'react-i18next';

import { GEAR_ART, maxStars } from '@/components/hero-gear/constants';
import { starKind } from '@/components/hero-gear/stars/utils';
import { gearStarFile } from '@/lib/game-art';

/**
 * A piece's stars in pixel art, two rows of five: red in use, orange waiting above the research level (`used`), grey not
 * yet bought. `size` is a star's pixels: 18 (twice the art) or 9 (the art's own size, beside a small icon).
 */
export function Stars({ count, used, size = 18 }: { count: number; used?: number; size?: 9 | 18 }) {
  const { t } = useTranslation('hero-gear');
  return (
    <div className="grid w-fit grid-cols-5 gap-px" aria-label={t('stars.label', { n: count, count: maxStars })}>
      {Array.from({ length: maxStars }, (_, i) => (
        <img
          key={i}
          src={GEAR_ART[gearStarFile(starKind(i, count, used))]}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className="[image-rendering:pixelated]"
        />
      ))}
    </div>
  );
}
