import { describe, expect, it } from 'vitest';
import { MAX_SUGGESTIONS } from '@/components/send-army-dialog/send-form/destination/constants';
import { destinationOptions, matchOptions, resolveDestination } from '@/components/send-army-dialog/send-form/destination/utils';

const MAP = 800;
const OAKMERE = { name: 'Oakmere', x: 300, y: 120, fieldId: 120 * MAP + 300 };
const FENWICK = { name: 'Fenwick', x: 10, y: 20, fieldId: 20 * MAP + 10 };
const FARM = 50 * MAP + 40;

describe(destinationOptions.name, () => {
  it('lists the other cities, then the farm targets', () => {
    expect(destinationOptions([OAKMERE, FENWICK], [FARM], OAKMERE.fieldId, MAP)).toEqual([
      { tileId: FENWICK.fieldId, x: 10, y: 20, name: 'Fenwick' },
      { tileId: FARM, x: 40, y: 50 },
    ]);
  });

  it('lists a place once, however many lists hold it', () => {
    const options = destinationOptions([OAKMERE, FENWICK], [FARM, FARM, FENWICK.fieldId, OAKMERE.fieldId], OAKMERE.fieldId, MAP);
    expect(options.map((o) => o.tileId)).toEqual([FENWICK.fieldId, FARM]);
  });

  it('has nothing for one city with no farm targets', () => {
    expect(destinationOptions([OAKMERE], [], OAKMERE.fieldId, MAP)).toEqual([]);
  });
});

describe(matchOptions.name, () => {
  const options = destinationOptions([OAKMERE, FENWICK], [FARM], 0, MAP);

  it('gives everything for no text', () => {
    expect(matchOptions(options, '  ')).toEqual(options);
  });

  it('matches part of a name, whatever its case', () => {
    expect(matchOptions(options, 'WICK').map((o) => o.name)).toEqual(['Fenwick']);
  });

  it('matches coordinates in any of the usual forms', () => {
    for (const text of ['300, 12', '300 12', '(300,120)', '300,1']) expect(matchOptions(options, text).map((o) => o.name)).toEqual(['Oakmere']);
  });

  it('matches a farm target by its coordinates', () => {
    expect(matchOptions(options, '40,50').map((o) => o.tileId)).toEqual([FARM]);
  });

  it('gives nothing when nothing fits', () => {
    expect(matchOptions(options, 'Atlantis')).toEqual([]);
  });

  it(`gives at most ${MAX_SUGGESTIONS}`, () => {
    const many = Array.from({ length: MAX_SUGGESTIONS + 5 }, (_, i) => ({ tileId: i, x: i, y: 0 }));
    expect(matchOptions(many, '')).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe(resolveDestination.name, () => {
  const options = destinationOptions([FENWICK], [], 0, MAP);

  it('reads coordinates', () => {
    expect(resolveDestination('(300, 120)', options, MAP)).toBe(OAKMERE.fieldId);
  });

  it('wraps coordinates round the map, as the map does', () => {
    expect(resolveDestination(`${MAP + 300}, 120`, options, MAP)).toBe(OAKMERE.fieldId);
  });

  it('reads the exact name of a place it suggests', () => {
    expect(resolveDestination(' fenwick ', options, MAP)).toBe(FENWICK.fieldId);
  });

  it('refuses part of a name, and anything else', () => {
    expect(resolveDestination('Fen', options, MAP)).toBeNull();
    expect(resolveDestination('300', options, MAP)).toBeNull();
    expect(resolveDestination('', options, MAP)).toBeNull();
  });
});
