import { useRef } from 'react';

/** The last non-null value, so a dialog keeps its content while its close animation runs. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value != null) last.current = value;
  return value ?? last.current;
}
