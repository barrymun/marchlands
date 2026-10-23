import { useTranslation } from 'react-i18next';

import { maxStars } from '@/components/hero-gear/constants';
import { GEAR_ART } from '@/components/hero-gear/gear-card/constants';
import { starKind } from '@/components/hero-gear/gear-card/stars/utils';
import { gearStarFile } from '@/lib/game-art';

/** A piece's stars in pixel art, two rows of five: red in use, orange waiting above the research level (`used`), grey not yet bought. */
export function Stars({ count, used }: { count: number; used?: number }) {
  const { t } = useTranslation('hero-gear');
  return (
    <div className="grid w-fit grid-cols-5 gap-px" aria-label={t('stars.label', { n: count, count: maxStars })}>
      {Array.from({ length: maxStars }, (_, i) => (
        <img
          key={i}
          src={GEAR_ART[gearStarFile(starKind(i, count, used))]}
          alt=""
          width={18}
          height={18}
          decoding="async"
          className="[image-rendering:pixelated]"
        />
      ))}
    </div>
  );
}
