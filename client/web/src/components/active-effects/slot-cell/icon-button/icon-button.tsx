import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function IconButton({
  label,
  detail,
  disabled,
  onClick,
  children,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0 [&_svg]:size-3.5" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        <span>{detail}</span>
      </TooltipContent>
    </Tooltip>
  );
}
