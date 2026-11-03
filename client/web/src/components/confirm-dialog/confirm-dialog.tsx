// The one way the client asks "are you sure?": a dialog with Cancel and a confirm button. Never the
// browser's confirm() or a click-twice button.

import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfirmProps } from '@/components/confirm-dialog/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** A controlled confirmation dialog; `children` (optional) go between the description and the buttons. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  focusConfirm = false,
  disabled = false,
  onConfirm,
  children,
}: ConfirmProps & { open: boolean; onOpenChange: (open: boolean) => void; disabled?: boolean; children?: ReactNode }) {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // the command already reported the error; keep the dialog open to try again
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          if (!focusConfirm) return;
          e.preventDefault();
          confirmButton.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button ref={confirmButton} variant={destructive ? 'destructive' : 'default'} disabled={busy || disabled} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
