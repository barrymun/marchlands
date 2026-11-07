import { afterEach, describe, expect, it } from 'vitest';
import {
  Feature,
  featureEnvName,
  featureFlagsFromEnv,
  getFeatureFlags,
  heldTilePermissions,
  isFeatureOn,
  Relation,
  relationPermissions,
  setFeatureFlags,
} from '#/index.ts';

const defaults = featureFlagsFromEnv({});

afterEach(() => setFeatureFlags(defaults));

describe(featureFlagsFromEnv.name, () => {
  it('leaves PvP off when nothing sets it', () => {
    expect(featureFlagsFromEnv({})).toEqual({ pvp: false });
    expect(featureFlagsFromEnv({ FEATURE_PVP: '' })).toEqual({ pvp: false });
  });

  it('reads true and false', () => {
    expect(featureFlagsFromEnv({ FEATURE_PVP: 'true' })).toEqual({ pvp: true });
    expect(featureFlagsFromEnv({ FEATURE_PVP: 'false' })).toEqual({ pvp: false });
  });

  it.each(['TRUE', '1', 'on', 'ture', ' true'])('stops the service on %j rather than guess', (value) => {
    expect(() => featureFlagsFromEnv({ FEATURE_PVP: value })).toThrow('FEATURE_PVP must be true or false');
  });
});

describe(featureEnvName.name, () => {
  it('names the setting after the flag', () => {
    expect(featureEnvName(Feature.PVP)).toBe('FEATURE_PVP');
  });
});

describe(setFeatureFlags.name, () => {
  it('changes what isFeatureOn and getFeatureFlags say', () => {
    setFeatureFlags({ [Feature.PVP]: true });
    expect(isFeatureOn(Feature.PVP)).toBe(true);
    expect(getFeatureFlags()).toEqual({ pvp: true });
    setFeatureFlags({ [Feature.PVP]: false });
    expect(isFeatureOn(Feature.PVP)).toBe(false);
  });

  it('hands out a copy, which can change nothing', () => {
    setFeatureFlags({ [Feature.PVP]: false });
    getFeatureFlags().pvp = true;
    expect(isFeatureOn(Feature.PVP)).toBe(false);
  });
});

describe(heldTilePermissions.name, () => {
  const STRANGERS = [Relation.NO_RELATION, Relation.NEUTRAL, Relation.ENEMY];

  it.each(STRANGERS)('with PvP off, offers no attack or scout at relation %i', (relation) => {
    setFeatureFlags({ [Feature.PVP]: false });
    expect(heldTilePermissions(relation)).toMatchObject({ canLoot: false, canOccupy: false, canScout: false });
  });

  it.each(STRANGERS)('with PvP on, is relationPermissions at relation %i', (relation) => {
    setFeatureFlags({ [Feature.PVP]: true });
    expect(heldTilePermissions(relation)).toEqual(relationPermissions(relation));
  });

  it.each([Relation.SELF, Relation.ALLIANCE, Relation.ALLY])('with PvP off, still lets relation %i send and supply', (relation) => {
    setFeatureFlags({ [Feature.PVP]: false });
    expect(heldTilePermissions(relation)).toEqual({ canLoot: false, canOccupy: false, canScout: false, canSend: true, canTrans: true });
  });
});
