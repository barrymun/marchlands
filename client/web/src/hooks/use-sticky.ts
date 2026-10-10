import { useRef } from 'react';

/** The last non-null value, so a dialog keeps its content while its close animation runs. */
export function useSticky<T>(value: T | null | undefined): T | null {
  // A ref, not state: callers often pass a freshly built object each render, and setting state
  // during render for that would loop forever (React error #301). Reading and writing the ref here
  // is safe because it only ever mirrors the latest non-null prop.
  const last = useRef<T | null>(null);
  // eslint-disable-next-line react-hooks/refs -- see above
  if (value != null) last.current = value;
  // eslint-disable-next-line react-hooks/refs -- see above
  return value ?? last.current;
}
