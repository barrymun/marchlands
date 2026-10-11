import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getArmiesOptions, getArmiesQueryKey, postArmiesRecallMutation } from '@marchlands/api-client';
import { ArmyDirection } from '@marchlands/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommand } from '@/hooks/use-game';
import { ArmyRow } from '@/components/armies-panel/army-row/army-row';

export function ArmiesPanel() {
  const { t } = useTranslation('armies-panel');
  const armies = useQuery(getArmiesOptions());
  const recall = useCommand(postArmiesRecallMutation(), () => [getArmiesQueryKey()], t('recalled'));
  const sections = [
    { id: 'hostile', title: t('sections.hostile'), list: armies.data?.enemy ?? [], tone: 'destructive' as const },
    { id: 'own', title: t('sections.own'), list: armies.data?.self ?? [], own: true },
    { id: 'allied', title: t('sections.allied'), list: armies.data?.friend ?? [] },
  ];
  return (
    <div className="grid gap-4">
      {sections.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {s.title} <span className="font-normal text-muted-foreground">({s.list.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {s.list.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
            {s.list.map((a) => (
              <ArmyRow
                key={a.armyId}
                army={a}
                tone={s.tone}
                onRecall={s.own && a.direction !== ArmyDirection.BACKWARD ? () => recall.mutate({ path: { armyId: a.armyId } }) : undefined}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
