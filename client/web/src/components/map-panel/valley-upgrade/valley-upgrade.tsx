import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';
import { TileType, valleyBonus } from '@marchlands/core';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { fmt, fmtExact, percent } from '@/lib/format';

/** Pay gold to raise an unowned valley one level (bigger bonus once held, stronger garrison). */
export function ValleyUpgrade({
  city,
  tile,
  onUpgrade,
  pending,
}: {
  city: CityBean;
  tile: { id: number; type: number; level: number; upgradeCost: number | null };
  onUpgrade: (tileId: number) => unknown;
  pending: boolean;
}) {
  const { t } = useTranslation('map-panel');
  if (tile.upgradeCost == null)
    return (
      <p className="text-xs text-muted-foreground">
        {t(tile.type === TileType.NPC ? 'valleyUpgrade.maxNpc' : 'valleyUpgrade.maxValley', { level: tile.level })}
      </p>
    );
  const pct = (l: number) => percent(valleyBonus(tile.type, l));
  const short = city.resource.gold < tile.upgradeCost;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmButton
          size="xs"
          variant="outline"
          disabled={pending || short}
          title={t('valleyUpgrade.title', { level: tile.level + 1 })}
          description={t('valleyUpgrade.description', { city: city.name, gold: fmtExact(tile.upgradeCost) })}
          confirmLabel={t('valleyUpgrade.confirm', { gold: fmt(tile.upgradeCost) })}
          destructive={false}
          onConfirm={() => onUpgrade(tile.id)}
        >
          {t('valleyUpgrade.button', { level: tile.level + 1, gold: fmt(tile.upgradeCost) })}
        </ConfirmButton>
        {short && <span className="text-xs text-destructive">{t('valleyUpgrade.notEnoughGold', { city: city.name })}</span>}
      </div>
      <span className="text-xs text-muted-foreground">
        {tile.type === TileType.NPC
          ? t('valleyUpgrade.npcHint', { level: tile.level + 1 })
          : t('valleyUpgrade.valleyHint', { from: pct(tile.level), to: pct(tile.level + 1) })}
      </span>
    </div>
  );
}
