import { troopDescription } from '@marchlands/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { troopName } from '@/lib/game-data';
import { translateMessage } from '@/lib/messages';

export function UnitName({ id }: { id: number }) {
  const description = troopDescription(id);
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
        {troopName(id)}
      </TooltipTrigger>
      {description && <TooltipContent className="max-w-72">{translateMessage(description)}</TooltipContent>}
    </Tooltip>
  );
}
