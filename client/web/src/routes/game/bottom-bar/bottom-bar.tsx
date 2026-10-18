import { useTranslation } from 'react-i18next';

import { useUnreadReports } from '@/components/reports-panel/hooks';
import { useGameNav } from '@/hooks/use-game-nav';
import { PAGES, PANELS } from '@/routes/game/constants';
import { NavButton } from '@/routes/game/nav-button/nav-button';
import { PlayerSummary } from '@/routes/game/player-summary/player-summary';

/** The desktop bottom bar, the same on every screen: the player on the left, the menu of panels and pages on the right. */
export function BottomBar() {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const unread = useUnreadReports().data?.count ?? 0;
  return (
    <footer className="hidden items-center gap-4 border-t bg-background/95 px-6 py-1.5 lg:flex">
      <div className="min-w-0 flex-1">
        <PlayerSummary />
      </div>
      <nav aria-label={t('mainMenu')} className="flex items-center gap-1">
        {PANELS.map((p) => (
          <NavButton key={p.id} icon={p.icon} label={p.label} active={nav.panel === p.id} onClick={() => (nav.panel === p.id ? nav.close() : nav.open(p.id))} />
        ))}
        <span className="mx-1 h-8 w-px bg-border" />
        {PAGES.map((p) => (
          <NavButton
            key={p.id}
            icon={p.icon}
            label={p.label}
            active={nav.screen === p.id}
            count={p.id === 'reports' ? unread : undefined}
            onClick={() => nav.go(p.id)}
          />
        ))}
      </nav>
    </footer>
  );
}
