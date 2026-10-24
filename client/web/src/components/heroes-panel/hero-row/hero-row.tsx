import type { HeroBean } from '@marchlands/api-client';

import { ExpBar } from '@/components/heroes-panel/exp-bar/exp-bar';
import { HeroAttributes } from '@/components/heroes-panel/hero-attributes/hero-attributes';
import { HeroBuffs } from '@/components/heroes-panel/hero-buffs/hero-buffs';
import { HeroName } from '@/components/heroes-panel/hero-name/hero-name';

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
  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div>
        <HeroName hero={hero} onRename={onRename} leading={leading} trailing={trailing} />
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
