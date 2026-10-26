import { afterEach, describe, expect, it, vi } from 'vitest';
import { burstAt, onBurst, startBurst } from '@/components/hero-gear/utils';

afterEach(() => vi.unstubAllGlobals());

describe(startBurst.name, () => {
  it('notes when the burst starts and tells every listener which piece', () => {
    const heard = vi.fn();
    const off = onBurst(heard);
    startBurst('weapon', 1200);
    expect(burstAt('weapon')).toBe(1200);
    expect(heard).toHaveBeenCalledWith('weapon');
    off();
  });

  it('keeps the latest burst of a piece', () => {
    startBurst('ring', 100);
    startBurst('ring', 900);
    expect(burstAt('ring')).toBe(900);
  });

  it('starts now unless told when', () => {
    vi.stubGlobal('performance', { now: () => 4242 });
    startBurst('belt');
    expect(burstAt('belt')).toBe(4242);
  });
});

describe(burstAt.name, () => {
  it('knows of no burst on a piece that has had none', () => {
    expect(burstAt('feet')).toBeUndefined();
  });
});

describe(onBurst.name, () => {
  it('stops telling a listener once it stops listening', () => {
    const heard = vi.fn();
    onBurst(heard)();
    startBurst('head', 1);
    expect(heard).not.toHaveBeenCalled();
  });
});
