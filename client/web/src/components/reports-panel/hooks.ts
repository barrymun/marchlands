import { useQuery } from '@tanstack/react-query';
import { rk } from '@/components/reports-panel/constants';
import { api, unwrap } from '@/lib/api';

export function useUnreadReports() {
  return useQuery({ queryKey: rk.unread, queryFn: () => unwrap(api.GET('/api/v1/reports/unread')) });
}
