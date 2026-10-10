// The one way the client asks "are you sure?": a dialog with Cancel and a confirm button. Never the
// browser's confirm() or a click-twice button.

import { useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog/confirm-dialog';
import type { ConfirmProps } from '@/components/confirm-dialog/types';

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
