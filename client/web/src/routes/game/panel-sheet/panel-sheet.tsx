import { Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { CityBean } from '@marchlands/api-client';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameNav } from '@/hooks/use-game-nav';
import { PanelId } from '@/lib/nav';
import { ArmiesPanel, FactionsPanel, ItemsPanel, MilitaryPanel, PANELS, PlansPanel, ResearchPanel } from '@/routes/game/constants';

/**
 * The open panel (lib/nav.ts) as a sheet over the view: from the end side on a wide screen (the right, the left right to
 * left), the whole screen on a phone.
 * Closing it (the cross, Escape, a click outside, the browser's back button) leaves the view as it was.
 */
export function PanelSheet({ city }: { city: CityBean }) {
  const { t, i18n } = useTranslation('game');
  const nav = useGameNav();
  const place = PANELS.find((p) => p.id === nav.panel);
  const body = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={!!place} onOpenChange={(o) => !o && nav.close()}>
      <SheetContent
        side={i18n.dir() === 'rtl' ? 'left' : 'right'}
        className="w-full gap-0 sm:max-w-3xl xl:max-w-5xl"
        // focus the panel itself rather than its first control, which would pop that control's tooltip open
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          body.current?.focus();
        }}
      >
        <SheetHeader className="border-b py-3">
          <SheetTitle className="flex items-center gap-2">
            {place && <place.icon className="size-4" />}
            {place?.label}
          </SheetTitle>
          <SheetDescription className="sr-only">{t('panel')}</SheetDescription>
        </SheetHeader>
        <div ref={body} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-4 outline-none">
          <Suspense fallback={<Skeleton className="h-96" />}>
            {nav.panel === PanelId.MILITARY && <MilitaryPanel city={city} />}
            {nav.panel === PanelId.RESEARCH && <ResearchPanel city={city} />}
            {nav.panel === PanelId.ITEMS && <ItemsPanel city={city} />}
            {nav.panel === PanelId.ARMIES && <ArmiesPanel />}
            {nav.panel === PanelId.PLANS && <PlansPanel />}
            {nav.panel === PanelId.FACTIONS && <FactionsPanel />}
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
