import type { SendTarget } from '@/components/send-army-dialog/types';

/** What a scouting mission does at this kind of target (combat.ts arriveScout). */
export function ScoutNote({ kind }: { kind?: SendTarget['kind'] }) {
  const text =
    kind === 'city'
      ? "Your scouts fight the city's scouts (a hero helps). If any survive, the report shows its resources, troops, fortifications and loyalty; Informatics adds heroes (level 1) and buildings (level 2). If none survive, you learn nothing."
      : kind === 'npc'
        ? 'Barbarian cities never stop scouts: one is enough. The report shows their troops, fortifications, walls, resources, loyalty, buildings and hero.'
        : kind === 'valley'
          ? 'Valleys never stop scouts: one is enough. The report shows the troops guarding it and who holds it.'
          : 'Only scouts go on a scouting mission.';
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
