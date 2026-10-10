import { useQuery } from '@tanstack/react-query';
import { getReportsUnreadOptions } from '@marchlands/api-client';

export function useUnreadReports() {
  return useQuery(getReportsUnreadOptions());
}
