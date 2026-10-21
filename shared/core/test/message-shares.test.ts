import { describe, expect, it } from 'vitest';
import {
  buildingEffect,
  buildingInfo,
  BUILDINGS,
  heroBuffDesc,
  itemEffect,
  itemInfo,
  ITEMS,
  type Message,
  type MsgParam,
  TECH_IDS,
  techEffect,
  techInfo,
  troopDescription,
  TROOPS,
} from '#/index.ts';

/** Params that hold a percentage: they must be shares (`share(x)`), never a percent number. */
const SHARE_PARAMS = new Set(['percent', 'pct', 'life', 'injured', 'march', 'battle']);

/** Every [code, param name, value] in a message and the messages nested in it. */
function params(m: MsgParam | undefined, out: [string, string, MsgParam][] = [], code = ''): [string, string, MsgParam][] {
  if (Array.isArray(m)) for (const v of m) params(v, out, code);
  else if (m && typeof m === 'object' && 'code' in m) {
    for (const [k, v] of Object.entries(m.params ?? {})) {
      out.push([m.code, k, v]);
      params(v, out, m.code);
    }
  }
  return out;
}

const described: Message[] = [
  ...ITEMS.flatMap((i) => {
    const info = itemInfo(i.id)!;
    const e = itemEffect(i.id);
    return [info.description, ...(e?.kind === 'buff' ? [e.desc] : [])];
  }),
  ...TECH_IDS.flatMap((id) => [techInfo(id).summary, ...Array.from({ length: 10 }, (_, l) => techEffect(id, l + 1)).filter((m): m is Message => !!m)]),
  ...BUILDINGS.filter((b) => b.level === 1).flatMap((b) => {
    const info = buildingInfo(b.typeId);
    return [info.summary, ...Array.from({ length: 10 }, (_, l) => buildingEffect(b.typeId, l + 1))].filter((m): m is Message => !!m);
  }),
  ...TROOPS.map((t) => troopDescription(t.troopId)).filter((m): m is Message => !!m),
  heroBuffDesc('power'),
];

describe('message percentages', () => {
  it('are sent as shares, never as percent numbers', () => {
    const found = described.flatMap((m) => params(m)).filter(([code, k]) => SHARE_PARAMS.has(k) || (code === 'techInfo.summary.medicine' && k === 'max'));
    expect(found.length).toBeGreaterThan(50);
    const numbers = found
      .filter(([, , v]) => typeof v !== 'object' || v === null || !('share' in v))
      .map(([code, k, v]) => `${code} ${k}=${JSON.stringify(v)}`);
    expect(numbers).toEqual([]);
  });

  // a bonus may pass 100% (10 levels of +10%), but a share of 25 is a percent passed by mistake (2,500%)
  it('are shares, not percents wrapped in share()', () => {
    for (const [code, k, v] of described.flatMap((m) => params(m)))
      if (v && typeof v === 'object' && 'share' in v) {
        expect(v.share, `${code} ${k}`).toBeGreaterThanOrEqual(0);
        expect(v.share, `${code} ${k}`).toBeLessThanOrEqual(5);
      }
  });
});
