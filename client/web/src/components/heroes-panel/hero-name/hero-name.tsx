import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { HeroLevel } from '@/components/hero-level/hero-level';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** A hero's name and level, with a button to rename it in place when `onRename` is given. */
export function HeroName({
  hero,
  onRename,
  leading,
  trailing,
  className,
}: {
  hero: HeroBean;
  onRename?: (name: string) => Promise<void>;
  /** before the name (e.g. a drag handle) */
  leading?: React.ReactNode;
  /** at the end of the line (e.g. move up / down) */
  trailing?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation(['heroes-panel', 'common']);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(hero.name);
  const save = async () => {
    const name = draft.trim();
    // renaming is only offered with onRename
    if (!name || name === hero.name || !onRename) return setEditing(false);
    try {
      await onRename(name);
      setEditing(false);
    } catch {
      /* the error is toasted; keep editing */
    }
  };
  if (editing)
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          // eslint-disable-next-line jsx-a11y-x/no-autofocus -- the field appears when the player asks to rename the hero, so it takes the focus
          autoFocus
          className="h-7 w-40"
          maxLength={20}
          value={draft}
          aria-label={t('heroRow.nameLabel')}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        />
        <Button type="submit" size="icon-xs" aria-label={t('heroRow.saveName')}>
          <Check />
        </Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label={t('common:actions.cancel')} onClick={() => setEditing(false)}>
          <X />
        </Button>
      </form>
    );
  return (
    <div className={cn('flex items-center gap-1 text-sm font-medium', className)}>
      {leading}
      {hero.name} <HeroLevel level={hero.level} />
      {onRename && (
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground"
          aria-label={t('heroRow.rename', { name: hero.name })}
          onClick={() => {
            setDraft(hero.name);
            setEditing(true);
          }}
        >
          <Pencil />
        </Button>
      )}
      {trailing && <div className="ml-auto flex gap-0.5">{trailing}</div>}
    </div>
  );
}
