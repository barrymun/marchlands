import { afterEach, describe, expect, it, vi } from 'vitest';
import { GearPieceId } from '@marchlands/core';
import { burstAt, onBurst, startBurst } from '@/components/hero-gear/utils';

afterEach(() => vi.unstubAllGlobals());

describe(startBurst.name, () => {
  it('notes when the burst starts and tells every listener which piece', () => {
    const heard = vi.fn();
    const off = onBurst(heard);
    startBurst(GearPieceId.WEAPON, 1200);
    expect(burstAt(GearPieceId.WEAPON)).toBe(1200);
    expect(heard).toHaveBeenCalledWith(GearPieceId.WEAPON);
    off();
  });

  it('keeps the latest burst of a piece', () => {
    startBurst(GearPieceId.RING, 100);
    startBurst(GearPieceId.RING, 900);
    expect(burstAt(GearPieceId.RING)).toBe(900);
  });

  it('starts now unless told when', () => {
    vi.stubGlobal('performance', { now: () => 4242 });
    startBurst(GearPieceId.BELT);
    expect(burstAt(GearPieceId.BELT)).toBe(4242);
  });
});

describe(burstAt.name, () => {
  it('knows of no burst on a piece that has had none', () => {
    expect(burstAt(GearPieceId.FEET)).toBeUndefined();
  });
});

describe(onBurst.name, () => {
  it('stops telling a listener once it stops listening', () => {
    const heard = vi.fn();
    onBurst(heard)();
    startBurst(GearPieceId.HEAD, 1);
    expect(heard).not.toHaveBeenCalled();
  });
});
