import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getFactionsRulersOptions, type StateRuler } from '@marchlands/api-client';

/**
 * The states players rule by holding their capital (docs/features/historical-cities.md): their barbarian cities are cut
 * off from their faction. By zone, for the map's tint and tile cards and the Factions panel.
 */
export function useStateRulers(): ReadonlyMap<number, StateRuler> {
  const { data } = useQuery({ ...getFactionsRulersOptions(), staleTime: 60_000 });
  return useMemo(() => new Map((data ?? []).map((r) => [r.zoneId, r])), [data]);
}
