import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connect, pgArray } from '#/index.ts';

// a server nobody listens on: a pool only connects when first used
const URL = 'postgres://tester@127.0.0.1:1/none';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe(pgArray.name, () => {
  it('writes numbers as they are', () => {
    expect(pgArray([1, 2, 3])).toBe('{1,2,3}');
    expect(pgArray([-1.5, 0])).toBe('{-1.5,0}');
  });

  it('quotes strings, escaping quotes and backslashes', () => {
    expect(pgArray(['a', 'b c'])).toBe('{"a","b c"}');
    expect(pgArray(['say "hi"', 'back\\slash'])).toBe('{"say \\"hi\\"","back\\\\slash"}');
    expect(pgArray(['{x,y}', 'NULL', ''])).toBe('{"{x,y}","NULL",""}');
  });

  it('is an empty array for no values', () => {
    expect(pgArray([])).toBe('{}');
  });
});

describe(connect.name, () => {
  it('needs a database URL', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(() => connect()).toThrow('DATABASE_URL is not set');
  });

  it('makes a pool for the URL and size given, closed by close()', async () => {
    const database = connect(URL, 3);
    expect(database.pool).toBeInstanceOf(pg.Pool);
    expect(database.pool.options).toMatchObject({ connectionString: URL, max: 3 });
    expect(database.db).toBeDefined();
    await database.close();
    expect(database.pool.ended).toBe(true);
  });

  it('reads the URL and pool size from the environment by default (20 connections)', async () => {
    vi.stubEnv('DATABASE_URL', URL);
    vi.stubEnv('DB_POOL_SIZE', '7');
    const sized = connect();
    expect(sized.pool.options).toMatchObject({ connectionString: URL, max: 7 });
    await sized.close();

    vi.stubEnv('DB_POOL_SIZE', undefined);
    const plain = connect();
    expect(plain.pool.options.max).toBe(20);
    await plain.close();
  });
});

describe('type parsers', () => {
  it('reads bigint and numeric columns as numbers', () => {
    expect(pg.types.getTypeParser(pg.types.builtins.INT8)('1767225600000')).toBe(1767225600000);
    expect(pg.types.getTypeParser(pg.types.builtins.NUMERIC)('12.5')).toBe(12.5);
  });
});
