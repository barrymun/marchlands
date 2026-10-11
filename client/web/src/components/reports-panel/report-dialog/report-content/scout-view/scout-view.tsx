import { useTranslation } from 'react-i18next';
import type { ReportBody } from '@marchlands/core';
import { fmtExact } from '@/lib/format';
import { tileName } from '@/lib/game-data';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';

export function ScoutView({ scout: s }: { scout: Extract<ReportBody, { kind: 'scout' }>['scout'] }) {
  const { t } = useTranslation(['reports-panel', 'common']);
  if (s.target === 'npc') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={t('labels.target')}>{t('barbarianCity', { level: s.level })}</Line>
        <Line label={t('labels.guardHero')}>{t('common:level.named', { name: s.hero.name, level: s.hero.level })}</Line>
        <Line label={t('labels.troops')}>
          <TroopList troops={s.troops} />
        </Line>
        <Line label={t('labels.fortifications')}>
          <TroopList troops={s.fortifications} /> {s.wallLevel > 0 && t('walls', { level: s.wallLevel })}
        </Line>
        <Line label={t('labels.resources')}>
          <ResourceList res={s.resources} />
        </Line>
        <Line label={t('labels.loyalty')}>{fmtExact(s.loyalty)}</Line>
        <Line label={t('labels.population')}>{fmtExact(s.population)}</Line>
      </div>
    );
  }
  if (s.target === 'valley') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={t('labels.target')}>{t('common:level.named', { name: tileName(s.type), level: s.level })}</Line>
        <Line label={t('labels.heldBy')}>{s.owner ?? t('scout.nobody')}</Line>
        <Line label={t('labels.defenders')}>
          <TroopList troops={s.troops} empty={t('none')} />
        </Line>
        {s.hero && <Line label={t('labels.hero')}>{t('common:level.named', { name: s.hero.name, level: s.hero.level })}</Line>}
      </div>
    );
  }
  const fight = (
    <Line label={t('labels.scouts')}>
      {t('scout.fight', {
        outcome: s.success ? t('scout.gotThrough') : t('scout.repelled'),
        ourBefore: fmtExact(s.battle.attackerScouts.before),
        ourAfter: fmtExact(s.battle.attackerScouts.after),
        theirBefore: fmtExact(s.battle.defenderScouts.before),
        theirAfter: fmtExact(s.battle.defenderScouts.after),
      })}
    </Line>
  );
  if ('from' in s) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label={t('labels.scoutedBy')}>{s.from}</Line>
        {fight}
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label={t('labels.player')}>{s.owner}</Line>
      {fight}
      {s.intel && (
        <>
          <Line label={t('labels.troops')}>
            <TroopList troops={s.intel.troops} />
          </Line>
          <Line label={t('labels.fortifications')}>
            <TroopList troops={s.intel.fortifications} /> {s.intel.wallLevel > 0 && t('walls', { level: s.intel.wallLevel })}
          </Line>
          <Line label={t('labels.resources')}>
            <ResourceList res={s.intel.resources} />
          </Line>
          <Line label={t('labels.population')}>{fmtExact(s.intel.population)}</Line>
          {s.intel.heroes && (
            <Line label={t('labels.heroes')}>
              {s.intel.heroes.map((h) => t('common:level.named', { name: h.name, level: h.level })).join(' · ') || t('none')}
            </Line>
          )}
          {s.intel.stationed.length > 0 && (
            <Line label={t('labels.reinforcements')}>
              {s.intel.stationed.map((troops, i) => (
                <div key={i}>
                  <TroopList troops={troops} />
                </div>
              ))}
            </Line>
          )}
        </>
      )}
    </div>
  );
}
