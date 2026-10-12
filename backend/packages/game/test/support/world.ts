// Helpers for the world tests (services/world.db.test.ts, engine/world.db.test.ts).

import { BALANCE } from '@marchlands/core';
import { type Db } from '@marchlands/db';
import { type TestGame } from '#test/support/game.ts';

export const SIZE = BALANCE.mapSize;

export const asDb = (g: TestGame) => g.tx as unknown as Db;
