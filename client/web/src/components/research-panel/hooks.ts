import { useQuery } from '@tanstack/react-query';
import { getCitiesResearchOptions } from '@marchlands/api-client';

export const useResearchList = (cityId: number) => useQuery(getCitiesResearchOptions({ path: { cityId } }));
