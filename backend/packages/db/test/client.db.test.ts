import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { pgArray } from '#/index.ts';
import { testDb } from '#test/support/db.ts';

describe(pgArray.name, () => {
  it('Postgres reads back the strings it was given', async () => {
    const values = ['a', 'b c', 'say "hi"', 'back\\slash', '{x,y}', 'NULL', '', 'ünï'];
    const r = await testDb().execute<{ v: string[] }>(sql`select ${pgArray(values)}::text[] as v`);
    expect(r.rows[0].v).toEqual(values);
  });

  it('Postgres reads back the numbers it was given, and an empty array', async () => {
    const r = await testDb().execute<{ ints: number[]; none: number[] }>(sql`select ${pgArray([1, -2, 3])}::int[] as ints, ${pgArray([])}::int[] as none`);
    expect(r.rows[0]).toEqual({ ints: [1, -2, 3], none: [] });
  });

  it('works as one parameter in `= any(...)`', async () => {
    const r = await testDb().execute<{ hit: boolean }>(sql`select 'b' = any(${pgArray(['a', 'b'])}::text[]) as hit`);
    expect(r.rows[0].hit).toBe(true);
  });
});

describe('type parsers', () => {
  it('bigint and numeric values come back as numbers', async () => {
    const r = await testDb().execute<{ big: unknown; num: unknown }>(sql`select 1767225600000::bigint as big, 12.5::numeric as num`);
    expect(r.rows[0]).toEqual({ big: 1767225600000, num: 12.5 });
  });
});
