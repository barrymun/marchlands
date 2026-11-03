import type { ReactNode } from 'react';

export interface ConfirmProps {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  /** red confirm button, for things that cannot be undone (default) */
  destructive?: boolean;
  /** the confirm button takes the focus when it opens, so Enter confirms (for an action repeated often); else the first button does */
  focusConfirm?: boolean;
  /** may return a promise: the dialog stays open (busy) until it settles, and only closes if it succeeds */
  onConfirm: () => unknown;
}
