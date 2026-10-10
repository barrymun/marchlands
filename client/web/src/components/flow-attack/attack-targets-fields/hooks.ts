import { useQuery } from '@tanstack/react-query';
import { getPlayerArmyPresetsOptions } from '@marchlands/api-client';

export const usePresets = () => useQuery(getPlayerArmyPresetsOptions());
