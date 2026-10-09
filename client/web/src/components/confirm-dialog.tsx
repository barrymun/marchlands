// The one way the client asks "are you sure?": a dialog with Cancel and a confirm button. Never the
// browser's confirm() or a click-twice button.

import { useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ConfirmProps {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  /** red confirm button, for things that cannot be undone (default) */
  destructive?: boolean;
  /** may return a promise: the dialog stays open (busy) until it settles, and only closes if it succeeds */
  onConfirm: () => unknown;
}

/** A controlled confirmation dialog. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
}: ConfirmProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A button that asks first: clicking it opens a ConfirmDialog, which runs `onConfirm`. */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  ...button
}: ConfirmProps & Omit<ComponentProps<typeof Button>, 'title' | 'onClick'> & { buttonTitle?: string }) {
  const [open, setOpen] = useState(false);
  const { buttonTitle, ...rest } = button;
  return (
    <>
      <Button {...rest} title={buttonTitle} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onConfirm={onConfirm}
      />
    </>
  );
}
