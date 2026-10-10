import { useState } from 'react';

/** The last non-null value, so a dialog keeps its content while its close animation runs. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(null);
  // remember a new value during render (React's pattern for state derived from props)
  if (value != null && value !== last) setLast(value);
  return value ?? last;
}
