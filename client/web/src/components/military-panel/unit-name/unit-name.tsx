import { troopDescription } from '@marchlands/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { troopName } from '@/lib/format';

export function UnitName({ id }: { id: number }) {
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
        {troopName(id)}
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{troopDescription(id)}</TooltipContent>
    </Tooltip>
  );
}
