import type { ReportDetail } from '@marchlands/api-client';
import type { ReportBody } from '@marchlands/core';

import { BattleView } from '@/components/reports-panel/report-dialog/report-content/battle-view/battle-view';
import { DesertionView } from '@/components/reports-panel/report-dialog/report-content/desertion-view/desertion-view';
import { DraftView } from '@/components/reports-panel/report-dialog/report-content/draft-view/draft-view';
import { MovementView } from '@/components/reports-panel/report-dialog/report-content/movement-view/movement-view';
import { ScoutView } from '@/components/reports-panel/report-dialog/report-content/scout-view/scout-view';
import { TradeView } from '@/components/reports-panel/report-dialog/report-content/trade-view/trade-view';
import { translateMessage } from '@/lib/messages';

// ---------------------------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------------------------

export function ReportContent({ report }: { report: ReportDetail }) {
  const body = report.content as ReportBody;
  switch (body.kind) {
    case 'battle':
      return <BattleView battle={body.battle} />;
    case 'scout':
      return <ScoutView scout={body.scout} />;
    case 'movement':
      return <MovementView movement={body.movement} />;
    case 'trade':
      return <TradeView trade={body.trade} />;
    case 'text':
      return <p className="text-sm">{translateMessage(body.text)}</p>;
    case 'desertion':
      return <DesertionView desertion={body.desertion} />;
    case 'draft':
      return <DraftView draft={body.draft} />;
  }
}
