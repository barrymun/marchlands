import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { useNow } from '@/hooks/use-now';
import { duration } from '@/lib/format';

export function TimerBar({ startTime, endTime }: { startTime: number; endTime: number }) {
  const { t } = useTranslation('timer-bar');
  const now = useNow();
  const pct = endTime > startTime ? Math.min(100, ((now - startTime) / (endTime - startTime)) * 100) : 100;
  return (
    <div className="grid gap-1">
      <Progress value={pct} className="h-1.5" />
      <span className="text-xs text-muted-foreground tabular-nums">{t('left', { time: duration(endTime - now) })}</span>
    </div>
  );
}
