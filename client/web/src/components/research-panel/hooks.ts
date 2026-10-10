import { useQuery } from '@tanstack/react-query';
import { qk } from '@/hooks/use-game';
import { api, unwrap } from '@/lib/api';

export const useResearchList = (cityId: number) =>
  useQuery({ queryKey: qk.research(cityId), queryFn: () => unwrap(api.GET('/api/v1/cities/{cityId}/research', { params: { path: { cityId } } })) });
