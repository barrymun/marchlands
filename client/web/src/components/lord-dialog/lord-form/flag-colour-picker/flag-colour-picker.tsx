import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getMapQueryKey, getMapTilesByTileIdQueryKey, getPlayerQueryKey, postPlayerFlagColourMutation } from '@marchlands/api-client';
import { FLAG_COLOURS, FlagColour } from '@marchlands/core';

import { FLAG_COLOUR_CLASS } from '@/components/flag-chip/constants';
import { FlagChip } from '@/components/flag-chip/flag-chip';
import { Label } from '@/components/ui/label';
import { useCommand, usePlayer } from '@/hooks/use-game';
import { allOf } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/** The colour behind the player's flag, shown as it looks on the map; a click on a swatch saves it. */
export function FlagColourPicker() {
  const { t } = useTranslation('flag-colour');
  const info = usePlayer().data?.playerInfo;
  const current = info?.flagColour ?? FlagColour.RED;
  const change = useCommand(
    postPlayerFlagColourMutation(),
    () => [getPlayerQueryKey(), allOf(getMapQueryKey), allOf(getMapTilesByTileIdQueryKey)],
    t('changed'),
  );
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label id="lord-flag-colour">{t('label')}</Label>
        {info?.flag && <FlagChip text={info.flag} colour={current} />}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="lord-flag-colour">
        {FLAG_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            title={t(`colours.${c}`)}
            aria-label={t(`colours.${c}`)}
            aria-pressed={c === current}
            disabled={change.isPending}
            className={cn(
              'grid size-7 place-items-center rounded-md text-white transition outline-none focus-visible:ring-2 focus-visible:ring-ring',
              FLAG_COLOUR_CLASS[c],
              c === current && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
            onClick={() => c !== current && change.mutate({ body: { colour: c } })}
          >
            {c === current && <Check className="size-4" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
}
