import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseCoords } from '@/components/map-panel/go-to-coords/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LOSS_TEXT } from '@/lib/tones';
import { cn } from '@/lib/utils';

/** Where the map is, on the toolbar; a click opens a box to type any coordinates and go there. */
export function GoToCoords({ x, y, mapSize, onGoTo }: { x: number; y: number; mapSize: number; onGoTo: (x: number, y: number) => void }) {
  const { t } = useTranslation('map-panel');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const show = (on: boolean) => {
    if (on) {
      setDraft(`${x}, ${y}`);
      setInvalid(false);
    }
    setOpen(on);
  };
  return (
    <Popover open={open} onOpenChange={show}>
      <PopoverTrigger asChild>
        <Button size="xs" variant="ghost" className="font-medium tabular-nums" aria-label={t('goTo.open', { x, y })}>
          {t('title', { x, y })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="w-64">
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const at = parseCoords(draft, mapSize);
            if (!at) return setInvalid(true);
            onGoTo(at.x, at.y);
            setOpen(false);
          }}
        >
          <label htmlFor={id} className="text-sm font-medium">
            {t('goTo.label')}
          </label>
          <div className="flex gap-1">
            <Input
              id={id}
              className="h-8 tabular-nums"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              placeholder={t('goTo.placeholder')}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${id}-error` : undefined}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setDraft(e.target.value);
                setInvalid(false);
              }}
            />
            <Button type="submit" size="sm">
              {t('goTo.go')}
            </Button>
          </div>
          {invalid && (
            <p id={`${id}-error`} className={cn('text-xs', LOSS_TEXT)}>
              {t('goTo.invalid')}
            </p>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}
