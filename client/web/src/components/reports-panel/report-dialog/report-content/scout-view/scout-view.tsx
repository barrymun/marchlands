import { TILE_NAMES, type ReportBody } from '@marchlands/core';
import { fmtExact } from '@/lib/format';
import { TroopList } from '@/components/reports-panel/report-dialog/report-content/troop-list/troop-list';
import { ResourceList } from '@/components/reports-panel/report-dialog/report-content/resource-list/resource-list';
import { Line } from '@/components/reports-panel/report-dialog/report-content/line/line';

export function ScoutView({ scout: s }: { scout: Extract<ReportBody, { kind: 'scout' }>['scout'] }) {
  if (s.target === 'npc') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Target">Barbarian city Lv {s.level}</Line>
        <Line label="Guard hero">
          {s.hero.name} Lv {s.hero.level}
        </Line>
        <Line label="Troops">
          <TroopList troops={s.troops} />
        </Line>
        <Line label="Fortifications">
          <TroopList troops={s.fortifications} /> {s.wallLevel > 0 && `· walls Lv ${s.wallLevel}`}
        </Line>
        <Line label="Resources">
          <ResourceList res={s.resources} />
        </Line>
        <Line label="Loyalty">{fmtExact(s.loyalty)}</Line>
        <Line label="Population">{fmtExact(s.population)}</Line>
      </div>
    );
  }
  if (s.target === 'valley') {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Target">
          {TILE_NAMES[s.type] ?? 'Valley'} Lv {s.level}
        </Line>
        <Line label="Held by">{s.owner ?? 'nobody'}</Line>
        <Line label="Defenders">
          <TroopList troops={s.troops} empty="none" />
        </Line>
        {s.hero && (
          <Line label="Hero">
            {s.hero.name} Lv {s.hero.level}
          </Line>
        )}
      </div>
    );
  }
  const fight = (
    <Line label="Scouts">
      {s.success ? 'got through' : 'were repelled'} · ours {fmtExact(s.battle.attackerScouts.before)} → {fmtExact(s.battle.attackerScouts.after)}, theirs{' '}
      {fmtExact(s.battle.defenderScouts.before)} → {fmtExact(s.battle.defenderScouts.after)}
    </Line>
  );
  if ('from' in s) {
    return (
      <div className="grid gap-1.5 text-sm">
        <Line label="Scouted by">{s.from}</Line>
        {fight}
      </div>
    );
  }
  return (
    <div className="grid gap-1.5 text-sm">
      <Line label="Player">{s.owner}</Line>
      {fight}
      {s.intel && (
        <>
          <Line label="Troops">
            <TroopList troops={s.intel.troops} />
          </Line>
          <Line label="Fortifications">
            <TroopList troops={s.intel.fortifications} /> {s.intel.wallLevel > 0 && `· walls Lv ${s.intel.wallLevel}`}
          </Line>
          <Line label="Resources">
            <ResourceList res={s.intel.resources} />
          </Line>
          <Line label="Population">{fmtExact(s.intel.population)}</Line>
          {s.intel.heroes && <Line label="Heroes">{s.intel.heroes.map((h) => `${h.name} Lv ${h.level}`).join(' · ') || 'none'}</Line>}
          {s.intel.stationed.length > 0 && (
            <Line label="Reinforcements">
              {s.intel.stationed.map((t, i) => (
                <div key={i}>
                  <TroopList troops={t} />
                </div>
              ))}
            </Line>
          )}
        </>
      )}
    </div>
  );
}
