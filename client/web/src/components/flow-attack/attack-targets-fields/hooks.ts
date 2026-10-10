import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export const usePresets = () => useQuery({ queryKey: ['army-presets'], queryFn: () => unwrap(api.GET('/api/v1/player/army-presets')) });
