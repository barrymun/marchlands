import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { SPARK_H, SPARK_W } from '@/components/stats-panel/headline/stat-tile/sparkline/constants';
import { indexAt, sparkPoints } from '@/components/stats-panel/headline/stat-tile/sparkline/utils';

/**
 * A headline number day by day: a 2px line over a faint area, 0 at the bottom; pointing at it picks a day (`onPick`,
 * null on leaving), shown with a hairline.
 */
export function Sparkline({ values, picked, onPick }: { values: readonly number[]; picked: number | null; onPick: (index: number | null) => void }) {
  const { t } = useTranslation('stats-panel');
  const points = sparkPoints(values, SPARK_W, SPARK_H);
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const [first] = points;
  const last = points.at(-1);
  const at = picked == null ? undefined : points[picked];
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPick(indexAt(e.clientX - r.left, r.width, values.length));
  };
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      className="h-6 w-full touch-none overflow-visible text-foreground/60"
      role="img"
      aria-label={t('headline.trend', { count: values.length })}
      onPointerMove={pick}
      onPointerDown={pick}
      onPointerLeave={() => onPick(null)}
    >
      {first && last && <path d={`M${first.x},${SPARK_H} L${line.replaceAll(' ', ' L')} L${last.x},${SPARK_H} Z`} className="fill-current opacity-10" />}
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {at && <line x1={at.x} x2={at.x} y1={0} y2={SPARK_H} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
