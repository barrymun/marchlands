import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getReportsSettingsOptions, getReportsSettingsQueryKey, postReportsSettingsMutation } from '@marchlands/api-client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCommand } from '@/hooks/use-game';

/** The player's setting to file the reports of armies coming home as read: they still arrive, without adding to the unread count. */
export function AutoReadSwitch() {
  const { t } = useTranslation('reports-panel');
  const settings = useQuery(getReportsSettingsOptions());
  const save = useCommand(postReportsSettingsMutation(), () => [getReportsSettingsQueryKey()]);
  // shows what was asked for while it saves
  const on = save.isPending ? save.variables.body.autoReadReturns : (settings.data?.autoReadReturns ?? false);
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="report-auto-read"
        checked={on}
        disabled={!settings.data || save.isPending}
        aria-describedby="report-auto-read-hint"
        onCheckedChange={(autoReadReturns) => save.mutate({ body: { autoReadReturns } })}
      />
      <div className="grid">
        <Label htmlFor="report-auto-read">{t('autoRead.label')}</Label>
        <span id="report-auto-read-hint" className="text-xs text-muted-foreground">
          {t('autoRead.hint')}
        </span>
      </div>
    </div>
  );
}
