import type { CityBean } from '@marchlands/api-client';
import { TileType, valleyBonus } from '@marchlands/core';
import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { fmt, fmtExact } from '@/lib/format';

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
  if (tile.upgradeCost == null)
    return (
      <p className="text-xs text-muted-foreground">
        Level {tile.level}: the highest {tile.type === TileType.NPC ? 'a barbarian city' : 'a valley'} can reach.
      </p>
    );
  const pct = (l: number) => Math.round(valleyBonus(tile.type, l) * 100);
  const short = city.resource.gold < tile.upgradeCost;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmButton
          size="xs"
          variant="outline"
          disabled={pending || short}
          title={`Upgrade to level ${tile.level + 1}?`}
          description={`${city.name} pays ${fmtExact(tile.upgradeCost)} gold. Its garrison, fortifications and resources start afresh at the new level.`}
          confirmLabel={`Pay ${fmt(tile.upgradeCost)} gold`}
          destructive={false}
          onConfirm={() => onUpgrade(tile.id)}
        >
          Upgrade to Lv {tile.level + 1} · {fmt(tile.upgradeCost)} gold
        </ConfirmButton>
        {short && <span className="text-xs text-destructive">Not enough gold in {city.name}.</span>}
      </div>
      <span className="text-xs text-muted-foreground">
        {tile.type === TileType.NPC
          ? `Its troops, fortifications, walls, hero and the resources you can plunder all grow to level ${tile.level + 1}, and it starts afresh at full strength.`
          : `Once held: +${pct(tile.level)}% → +${pct(tile.level + 1)}% production. Its defenders grow stronger with the level too.`}
      </span>
    </div>
  );
}
