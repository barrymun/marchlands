import { useSyncExternalStore } from 'react';
import { tokenStore } from '@/lib/api';

export function useToken(): string | null {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get);
}
