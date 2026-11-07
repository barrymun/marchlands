// Runs before each service test file (vitest.db.config.ts): the tests check the whole game, whatever a release leaves
// off by default, and a test of a part being off switches it off itself (setFeatureFlags, and back on afterwards).

import { Feature, setFeatureFlags } from '@marchlands/core';

setFeatureFlags({ [Feature.PVP]: true });
