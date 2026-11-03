import { describe, expect, it } from 'vitest';
import { troopBar, troopRows } from '@/components/stats-panel/troops/utils';

const none = { trained: 0, died: 0, injured: 0, healed: 0, deserted: 0, disbanded: 0 };

describe(troopRows.name, () => {
  it('reads each unit, the fallen less those that came home injured', () => {
    const c = { 'trained.archer': 129, 'lost.archer': 58, 'injured.archer': 29, 'healed.archer': 29, 'disbanded.archer': 40, 'deserted.archer': 1 };
    expect(troopRows(c)).toEqual([{ key: 'archer', trained: 129, died: 29, injured: 29, healed: 29, deserted: 1, disbanded: 40 }]);
  });

  it('puts the biggest bar first, fortifications among the troops', () => {
    const c = { 'trained.militia': 22, 'trained.archer': 129, 'trained.trap': 50, 'lost.pikemen': 60 };
    expect(troopRows(c).map((r) => r.key)).toEqual(['archer', 'pikemen', 'trap', 'militia']);
  });

  it('keeps a unit with only injuries or disbandings, and leaves out units with nothing', () => {
    expect(troopRows({ 'injured.scouter': 3, 'lost.scouter': 3 })).toEqual([{ ...none, key: 'scouter', injured: 3 }]);
    expect(troopRows({ 'disbanded.militia': 2, 'trained.archer': 0 })).toEqual([{ ...none, key: 'militia', disbanded: 2 }]);
    expect(troopRows({})).toEqual([]);
  });
});

describe(troopBar.name, () => {
  it('is as long as the troops trained, the fallen part of it', () => {
    expect(troopBar({ ...none, key: 'archer', trained: 129, died: 29 })).toEqual({ total: 129, fell: 29 });
  });

  it('is as long as the fallen when more fell than were trained', () => {
    expect(troopBar({ ...none, key: 'pikemen', trained: 10, died: 60 })).toEqual({ total: 60, fell: 60 });
  });
});
