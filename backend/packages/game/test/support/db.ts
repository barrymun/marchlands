// The test database (prepared by global-setup.ts), one pool per test file.

import { afterAll, inject } from 'vitest';
import { connect, type Database } from '@marchlands/db';

let database: Database | undefined;

export function testDb(): Database['db'] {
  database ??= connect(inject('databaseUrl'), 4);
  return database.db;
}

afterAll(async () => {
  await database?.close();
  database = undefined;
});
