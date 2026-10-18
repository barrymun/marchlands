import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { useUnreadReports } from '@/components/reports-panel/hooks';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useGameNav } from '@/hooks/use-game-nav';
import { CityList } from '@/routes/game/city-list/city-list';
import { PAGES, PANELS } from '@/routes/game/constants';
import { NavButton } from '@/routes/game/nav-button/nav-button';
import { PlayerSummary } from '@/routes/game/player-summary/player-summary';
import { TroopsHome } from '@/routes/game/troops-home/troops-home';

/** The phone menu, from the bottom: every panel and page, then what the desktop sidebar shows (cities, troops at home). */
export function MenuSheet({ city, open, onClose }: { city?: CityBean; open: boolean; onClose: () => void }) {
  const { t } = useTranslation('game');
  const nav = useGameNav();
  const unread = useUnreadReports().data?.count ?? 0;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="pb-2">
          <SheetTitle>{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">{t('mainMenu')}</SheetDescription>
          <PlayerSummary />
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
            {PANELS.map((p) => (
              <NavButton
                key={p.id}
                icon={p.icon}
                label={p.label}
                active={nav.panel === p.id}
                onClick={() => {
                  onClose();
                  nav.open(p.id);
                }}
              />
            ))}
            {PAGES.map((p) => (
              <NavButton
                key={p.id}
                icon={p.icon}
                label={p.label}
                active={nav.screen === p.id}
                count={p.id === 'reports' ? unread : undefined}
                onClick={() => {
                  onClose();
                  nav.go(p.id);
                }}
              />
            ))}
          </div>
          <Separator />
          <CityList city={city} onPick={onClose} />
          {city && (
            <>
              <Separator />
              <TroopsHome city={city} onPick={onClose} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
