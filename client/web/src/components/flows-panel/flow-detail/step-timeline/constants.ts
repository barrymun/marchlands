import { Clock, Crosshair, Crown, HeartPulse, type LucideIcon, Shield, UserPlus } from 'lucide-react';
import type { FlowAction } from '@marchlands/api-client';

/** Each kind of action's icon on the timeline. */
export const ACTION_ICON: Record<FlowAction['type'], LucideIcon> = {
  setMayor: Crown,
  trainTroops: Shield,
  attackTargets: Crosshair,
  healTroops: HeartPulse,
  wait: Clock,
  hireHeroes: UserPlus,
};
