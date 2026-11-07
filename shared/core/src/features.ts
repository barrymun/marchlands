// Feature flags: parts of the game a release can leave switched off. The API and the worker set them at boot from
// FEATURE_<NAME> in their environment, and the API sends them to the client (PlayerState and /config/static).

export const Feature = {
  /** players attacking and scouting each other, their cities, valleys and historic cities (docs/deviations.md) */
  PVP: 'pvp',
} as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

export type FeatureFlags = Record<Feature, boolean>;

/** What a release is without any setting: a part that isn't ready stays off if a setting goes missing. */
const DEFAULT_FEATURES: FeatureFlags = { [Feature.PVP]: false };

let flags: FeatureFlags = { ...DEFAULT_FEATURES };

export function setFeatureFlags(next: Partial<FeatureFlags>): void {
  flags = { ...flags, ...next };
}

export function getFeatureFlags(): FeatureFlags {
  return { ...flags };
}

export function isFeatureOn(feature: Feature): boolean {
  return flags[feature];
}

/** A flag's environment variable: FEATURE_PVP. */
export const featureEnvName = (feature: Feature) => `FEATURE_${feature.toUpperCase()}`;

/**
 * The flags an environment sets. Anything but `true` or `false` stops the service starting, as a misspelt setting
 * would otherwise run the game with a part on or off that nobody chose. Left out or empty, a flag keeps its default.
 */
export function featureFlagsFromEnv(env: Record<string, string | undefined>): FeatureFlags {
  const out = { ...DEFAULT_FEATURES };
  for (const feature of Object.values(Feature)) {
    const name = featureEnvName(feature);
    const value = env[name];
    if (value == null || value === '') continue;
    // eslint-disable-next-line marchlands/no-string-compare -- the settings' own spelling, read from the environment
    if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false, not ${value}`);
    // eslint-disable-next-line marchlands/no-string-compare -- as above
    out[feature] = value === 'true';
  }
  return out;
}
