/* eslint-disable marchlands/no-string-value -- a made-up set of tabs, to test how a schema reads raw strings */
import { describe, expect, it } from 'vitest';
import { REPORT_KINDS, ReportKind } from '@marchlands/core';
import { defaultsOf, dropPrefix, followAddress, param, readSearch, searchBox, type SearchSchema, textToWrite, writeSearch } from '@/lib/search-state';

const TABS = ['all', 'army', 'trade'] as const;
const SCHEMA = {
  tab: param.oneOf(TABS, 'all'),
  q: param.text(10),
  kind: param.maybe(REPORT_KINDS),
  unread: param.flag(),
  page: param.page(),
  report: param.id(),
} satisfies SearchSchema;

const search = (s: string) => new URLSearchParams(s);

describe(param.oneOf.name, () => {
  const p = param.oneOf(TABS, 'all');

  it('reads a value from the list, and the fallback for anything else', () => {
    expect(p.read('army')).toBe('army');
    expect(p.read(null)).toBe('all');
    expect(p.read('')).toBe('all');
    expect(p.read('Army')).toBe('all');
  });

  it('leaves the fallback out of the address', () => {
    expect(p.write('trade')).toBe('trade');
    expect(p.write('all')).toBeNull();
  });
});

describe(param.maybe.name, () => {
  const p = param.maybe(REPORT_KINDS);

  it('reads a value from the list, and none for anything else', () => {
    expect(p.read(ReportKind.BATTLES)).toBe(ReportKind.BATTLES);
    expect(p.read(null)).toBeNull();
    expect(p.read('sieges')).toBeNull();
  });

  it('writes a value, and leaves none out', () => {
    expect(p.write(ReportKind.RETURNS)).toBe(ReportKind.RETURNS);
    expect(p.write(null)).toBeNull();
  });
});

describe(param.text.name, () => {
  const p = param.text(5);

  it('reads the text as written, cut to the longest the server takes', () => {
    expect(p.read('12,34')).toBe('12,34');
    expect(p.read(' a b ')).toBe(' a b ');
    expect(p.read('123456789')).toBe('12345');
    expect(p.read(null)).toBe('');
  });

  it('leaves blank text out of the address', () => {
    expect(p.write('ab')).toBe('ab');
    expect(p.write('   ')).toBeNull();
    expect(p.write('')).toBeNull();
    expect(p.write('abcdefg')).toBe('abcde');
  });
});

describe(param.flag.name, () => {
  const p = param.flag();

  it('is on only when written 1', () => {
    expect(p.read('1')).toBe(true);
    expect(p.read('true')).toBe(false);
    expect(p.read(null)).toBe(false);
  });

  it('writes 1 when on, and leaves it out when off', () => {
    expect(p.write(true)).toBe('1');
    expect(p.write(false)).toBeNull();
  });
});

describe(param.page.name, () => {
  const p = param.page();

  it('reads a page from 1, and 1 for anything that is not one', () => {
    expect(p.read('3')).toBe(3);
    expect(p.read('1')).toBe(1);
    expect(p.read('0')).toBe(1);
    expect(p.read('-2')).toBe(1);
    expect(p.read('2.5')).toBe(1);
    expect(p.read('03')).toBe(1);
    expect(p.read('abc')).toBe(1);
    expect(p.read('99999999999999999')).toBe(1);
    expect(p.read(null)).toBe(1);
  });

  it('leaves the first page out of the address', () => {
    expect(p.write(4)).toBe('4');
    expect(p.write(1)).toBeNull();
  });
});

describe(param.id.name, () => {
  const p = param.id();

  it('reads an id from 1, and none for anything that is not one', () => {
    expect(p.read('10234')).toBe(10234);
    expect(p.read('0')).toBeNull();
    expect(p.read('1e3')).toBeNull();
    expect(p.read('')).toBeNull();
    expect(p.read(null)).toBeNull();
  });

  it('writes an id, and leaves none out', () => {
    expect(p.write(7)).toBe('7');
    expect(p.write(null)).toBeNull();
  });
});

describe(param.key.name, () => {
  const p = param.key();

  it('reads a short id of letters and digits, and none for anything else', () => {
    expect(p.read('mhx2k9a1b')).toBe('mhx2k9a1b');
    expect(p.read('A1')).toBe('A1');
    expect(p.read('')).toBeNull();
    expect(p.read('a b')).toBeNull();
    expect(p.read('a'.repeat(33))).toBeNull();
    expect(p.read(null)).toBeNull();
  });

  it('writes an id, and leaves none out', () => {
    expect(p.write('abc')).toBe('abc');
    expect(p.write(null)).toBeNull();
  });
});

describe(param.point.name, () => {
  const p = param.point();

  it('reads a place written x,y', () => {
    expect(p.read('300,500')).toEqual({ x: 300, y: 500 });
    expect(p.read('0,0')).toEqual({ x: 0, y: 0 });
  });

  it('reads none for anything else', () => {
    expect(p.read('300')).toBeNull();
    expect(p.read('300, 500')).toBeNull();
    expect(p.read('-1,5')).toBeNull();
    expect(p.read('1.5,2')).toBeNull();
    expect(p.read('12345,1')).toBeNull();
    expect(p.read(null)).toBeNull();
  });

  it('writes a place x,y, and leaves none out', () => {
    expect(p.write({ x: 300, y: 500 })).toBe('300,500');
    expect(p.write(null)).toBeNull();
  });
});

describe(param.int.name, () => {
  const p = param.int((n) => n === -1 || (n >= 0 && n <= 10));

  it('reads a whole number the screen accepts, negative ones too', () => {
    expect(p.read('-1')).toBe(-1);
    expect(p.read('0')).toBe(0);
    expect(p.read('10')).toBe(10);
  });

  it('reads none for a number it does not accept, or anything that is not a whole number', () => {
    expect(p.read('-2')).toBeNull();
    expect(p.read('11')).toBeNull();
    expect(p.read('-0')).toBeNull();
    expect(p.read('1.5')).toBeNull();
    expect(p.read('007')).toBeNull();
    expect(p.read('--1')).toBeNull();
    expect(p.read(null)).toBeNull();
  });

  it('writes a number, and leaves none out', () => {
    expect(p.write(-1)).toBe('-1');
    expect(p.write(0)).toBe('0');
    expect(p.write(null)).toBeNull();
  });
});

describe(readSearch.name, () => {
  it('reads every parameter of the schema', () => {
    expect(readSearch(SCHEMA, search('tab=army&q=12,34&kind=battles&unread=1&page=3&report=99'))).toEqual({
      tab: 'army',
      q: '12,34',
      kind: ReportKind.BATTLES,
      unread: true,
      page: 3,
      report: 99,
    });
  });

  it('reads the defaults for what is missing or makes no sense', () => {
    expect(readSearch(SCHEMA, search('tab=nope&page=0&report=x&unread=yes&panel=items'))).toEqual(defaultsOf(SCHEMA));
  });

  it('reads the names under a prefix', () => {
    expect(readSearch(SCHEMA, search('tab=army&items.tab=trade'), 'items.')).toMatchObject({ tab: 'trade' });
  });
});

describe(dropPrefix.name, () => {
  it('drops every parameter under the prefix and keeps the rest', () => {
    expect(dropPrefix(search('panel=items&items.q=horn&items.owned=1&tab=army&itemsq=1'), 'items.').toString()).toBe('panel=items&tab=army&itemsq=1');
  });

  it('does not change the parameters it was given', () => {
    const before = search('items.q=horn');
    dropPrefix(before, 'items.');
    expect(before.toString()).toBe('items.q=horn');
  });
});

describe(defaultsOf.name, () => {
  it('is the schema read from an empty address', () => {
    expect(defaultsOf(SCHEMA)).toEqual({ tab: 'all', q: '', kind: null, unread: false, page: 1, report: null });
  });
});

describe(writeSearch.name, () => {
  it('writes the values given and keeps every other parameter', () => {
    const next = writeSearch(SCHEMA, search('panel=items&tab=army&page=2'), { page: 3, report: 5 });
    expect(next.toString()).toBe('panel=items&tab=army&page=3&report=5');
  });

  it('takes defaults out of the address', () => {
    const next = writeSearch(SCHEMA, search('tab=army&q=ab&unread=1&page=4'), { tab: 'all', q: '', unread: false, page: 1 });
    expect(next.toString()).toBe('');
  });

  it('leaves alone a value given as undefined, and names the schema does not have', () => {
    const next = writeSearch(SCHEMA, search('page=2&building=7'), { page: undefined, ...({ building: 3 } as object) });
    expect(next.toString()).toBe('page=2&building=7');
  });

  it('writes under a prefix', () => {
    expect(writeSearch(SCHEMA, search('tab=army'), { tab: 'trade' }, 'items.').toString()).toBe('tab=army&items.tab=trade');
  });

  it('does not change the parameters it was given', () => {
    const before = search('page=2');
    writeSearch(SCHEMA, before, { page: 5 });
    expect(before.toString()).toBe('page=2');
  });

  it('reads back what it wrote', () => {
    const values = { tab: 'trade', q: '1,2', kind: ReportKind.SCOUTING, unread: true, page: 6, report: 12 } as const;
    expect(readSearch(SCHEMA, writeSearch(SCHEMA, search(''), values))).toEqual(values);
  });
});

describe(followAddress.name, () => {
  it('keeps the box while the address has not moved', () => {
    const box = { ...searchBox('ab'), draft: 'abc' };
    expect(followAddress(box, 'ab')).toBe(box);
  });

  it('keeps keys typed since, when the address only caught up with what the box wrote', () => {
    const box = { draft: '412,8', seen: '', sent: '412' };
    expect(followAddress(box, '412')).toEqual({ draft: '412,8', seen: '412', sent: '412' });
  });

  it('shows the address when it moved some other way (Clear filters, the back button)', () => {
    const box = { draft: '412,8', seen: '412', sent: '412' };
    expect(followAddress(box, '')).toEqual({ draft: '', seen: '', sent: '412' });
    expect(followAddress(box, 'horn')).toEqual({ draft: 'horn', seen: 'horn', sent: '412' });
  });
});

describe(textToWrite.name, () => {
  it('writes what the box shows', () => {
    expect(textToWrite({ ...searchBox(''), draft: 'horn' }, '')).toBe('horn');
    expect(textToWrite({ ...searchBox('horn'), draft: '' }, 'horn')).toBe('');
  });

  it('writes nothing when the address already says it', () => {
    expect(textToWrite(searchBox('horn'), 'horn')).toBeNull();
  });
});

describe(searchBox.name, () => {
  it('starts showing the address', () => {
    expect(searchBox('12,34')).toEqual({ draft: '12,34', seen: '12,34', sent: '12,34' });
  });
});
