import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { useUnreadReports } from '@/components/reports-panel/hooks';
import { useGameNav } from '@/hooks/use-game-nav';
import { VIEWS } from '@/routes/game/constants';
import { NavButton } from '@/routes/game/nav-button/nav-button';
import { MenuSheet } from '@/routes/game/tab-bar/menu-sheet/menu-sheet';

/** The phone and tablet tab bar: the three views, and Menu for everything else (the sidebar's contents too). */
export function TabBar({ city }: { city?: CityBean }) {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const [menu, setMenu] = useState(false);
  const unread = useUnreadReports().data?.count ?? 0;
  return (
    <>
      <nav
        aria-label={t('mainMenu')}
        className="flex justify-around border-t bg-background/95 px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        {VIEWS.map((v) => (
          <NavButton key={v.id} icon={v.icon} label={v.label} active={nav.screen === v.id && !nav.panel} onClick={() => nav.go(v.id)} className="flex-1" />
        ))}
        <NavButton icon={Menu} label={t('menu')} active={menu} count={unread} onClick={() => setMenu(true)} className="flex-1" />
      </nav>
      <MenuSheet city={city} open={menu} onClose={() => setMenu(false)} />
    </>
  );
}
