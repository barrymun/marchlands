import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HeroBean } from '@marchlands/api-client';

import { ExpBar } from '@/components/heroes-panel/hero-row/exp-bar/exp-bar';
import { HeroAttributes } from '@/components/heroes-panel/hero-row/hero-attributes/hero-attributes';
import { HeroBuffs } from '@/components/heroes-panel/hero-row/hero-buffs/hero-buffs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function HeroRow({
  hero,
  note,
  showExp = false,
  gear,
  onRename,
  leading,
  trailing,
  children,
}: {
  hero: HeroBean;
  /** before the name (e.g. a drag handle) */
  leading?: React.ReactNode;
  /** at the end of the name line (e.g. move up / down) */
  trailing?: React.ReactNode;
  note?: React.ReactNode;
  showExp?: boolean;
  gear?: React.ReactNode;
  onRename?: (name: string) => Promise<void>;
  children: React.ReactNode;
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
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div>
        {editing ? (
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
        ) : (
          <div className="flex items-center gap-1 text-sm font-medium">
            {leading}
            {hero.name} <span className="font-normal text-muted-foreground">{t('common:level.short', { level: hero.level })}</span>
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
        )}
        <HeroAttributes hero={hero} />
        {gear}
        {note && <div className="text-xs tabular-nums">{note}</div>}
        <HeroBuffs hero={hero} />
        {showExp && <ExpBar hero={hero} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
