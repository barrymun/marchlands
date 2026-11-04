import { useQuery } from '@tanstack/react-query';
import { Castle, Swords } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getPlayerFlowsOptions } from '@marchlands/api-client';
import { BALANCE, tileXY } from '@marchlands/core';

import { farmLists } from '@/components/map-panel/utils';
import { destinationOptions, matchOptions, resolveDestination } from '@/components/send-army-dialog/send-form/destination/utils';
import { TileLabel } from '@/components/tile-label/tile-label';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { usePlayer } from '@/hooks/use-game';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/**
 * Where the army goes: coordinates to type or paste, or one of the player's cities or this city's farm targets, suggested
 * as they type. A place takes effect once picked, on Enter or on leaving the box, never part way through typing, as the
 * form holds Send back until then (`text` is what's typed, null when the box shows the destination).
 */
export function Destination({
  city,
  tileId,
  text,
  onText,
  onPick,
  children,
}: {
  city: CityBean;
  tileId: number;
  text: string | null;
  onText: (text: string | null) => void;
  onPick: (tileId: number) => void;
  /** what's at the destination, beside the box */
  children: ReactNode;
}) {
  const { t } = useTranslation('send-army-dialog');
  const id = useId();
  const player = usePlayer();
  const mapSize = player.data?.mapSizeX ?? BALANCE.mapSize;
  const cities = player.data?.castles ?? [];
  const flows = useQuery(getPlayerFlowsOptions());
  const farms = farmLists(flows.data ?? [], cities, city.id).find((l) => l.here)?.targets ?? [];
  const options = destinationOptions(
    cities,
    farms.map((f) => f.tileId),
    city.fieldId,
    mapSize,
  );
  const matches = matchOptions(options, text ?? '');
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const open = focused && !dismissed && matches.length > 0;
  const at = tileXY(tileId, mapSize);
  const activeOption = active == null ? undefined : matches[active];

  const pick = (place: number) => {
    onPick(place);
    setActive(null);
    setInvalid(false);
    setDismissed(true);
  };
  /** Take what's typed as the destination; an empty box goes back to the one before, and anything else is shown as wrong. */
  const commit = () => {
    if (text == null) return;
    if (!text.trim()) {
      onText(null);
      setInvalid(false);
      return;
    }
    const place = resolveDestination(text, options, mapSize);
    if (place == null) setInvalid(true);
    else pick(place);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setDismissed(false);
      if (matches.length > 0) setActive(active == null ? (step > 0 ? 0 : matches.length - 1) : (active + step + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // the place highlighted; or part of a name typed, the first place it fits
      const first = text != null && resolveDestination(text, options, mapSize) == null ? matches[0] : undefined;
      const chosen = open ? (activeOption ?? first) : undefined;
      if (chosen) pick(chosen.tileId);
      else commit();
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('to.label')}</Label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Popover open={open} onOpenChange={(on) => !on && setDismissed(true)}>
          <PopoverAnchor asChild>
            <Input
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={open && active != null ? `${id}-${active}` : undefined}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${id}-error` : undefined}
              className="h-8 w-full tabular-nums sm:w-56"
              autoComplete="off"
              placeholder={t('to.placeholder')}
              value={text ?? `${at.x}, ${at.y}`}
              onFocus={(e) => {
                e.currentTarget.select();
                setFocused(true);
                setDismissed(false);
              }}
              // the box keeps the focus after a place is picked: a click on it starts afresh, as focusing it does
              onClick={(e) => {
                if (text == null) e.currentTarget.select();
                setDismissed(false);
              }}
              onBlur={() => {
                setFocused(false);
                setActive(null);
                commit();
              }}
              onChange={(e) => {
                onText(e.target.value);
                setInvalid(false);
                setDismissed(false);
                setActive(null);
              }}
              onKeyDown={onKeyDown}
            />
          </PopoverAnchor>
          <PopoverContent
            align="start"
            collisionPadding={8}
            className="w-(--radix-popover-trigger-width) min-w-64 gap-0 p-1"
            // the box keeps the focus while the list is open: it's the box that's typed in
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (e.target instanceof HTMLElement && e.target.id === id) e.preventDefault();
            }}
          >
            <div id={`${id}-list`} role="listbox" aria-label={t('to.suggestions')}>
              {matches.map((o, i) => (
                <button
                  key={o.tileId}
                  id={`${id}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-sm hover:bg-muted', i === active && 'bg-muted')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.tileId)}
                >
                  {o.name ? (
                    <>
                      <Castle className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {o.name}{' '}
                        <span className="text-muted-foreground tabular-nums">
                          ({o.x},{o.y})
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Swords className="size-3.5 shrink-0 text-muted-foreground" />
                      <TileLabel tileId={o.tileId} />
                    </>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {text == null && children}
      </div>
      {invalid && (
        <p id={`${id}-error`} className={cn('text-xs', LOSS_TEXT)}>
          {t('to.invalid')}
        </p>
      )}
    </div>
  );
}
