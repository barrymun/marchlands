// Prepares the database for the service tests (npm run test:db): creates it next to the dev database if it is
// missing, applies the migrations and seeds the world map once (later runs reuse it). Tests never commit (see
// game.ts), so the database stays as the setup left it.

import pg from 'pg';
import type { TestProject } from 'vitest/node';

import { WorldMapSource } from '@marchlands/core';
import { connect, runMigrations } from '@marchlands/db';

import { world } from '#/index.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env: DATABASE_URL comes from the environment
  }
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error('DATABASE_URL is not set: the service tests need the Postgres container (docker compose up -d postgres)');
  const name = process.env.TEST_DB_NAME ?? 'marchlands_test';
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`invalid TEST_DB_NAME ${name}`);
  const url = new URL(devUrl);
  url.pathname = `/${name}`;

  const admin = new pg.Client({ connectionString: devUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (!rowCount) await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }

  await runMigrations(url.toString());
  const { db, close } = connect(url.toString(), 2);
  try {
    await world.ensureWorld(db, { source: WorldMapSource.GENERATED, seed: 'test' });
  } finally {
    await close();
  }
  project.provide('databaseUrl', url.toString());
}
