import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { deleteAuthSessionsMutation } from '@marchlands/api-client';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { useCommand } from '@/hooks/use-game';
import { tokenStore } from '@/lib/api';

/**
 * Log out everywhere: the server stops taking every login of the account, this browser's included, so the player
 * lands on the login page. For a login left on a device the player no longer trusts.
 */
export function SessionsSection() {
  const { t } = useTranslation('lord-dialog');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const end = useCommand(deleteAuthSessionsMutation(), () => []);

  async function logOutEverywhere() {
    await end.mutateAsync({});
    tokenStore.set(null);
    qc.clear();
    void navigate('/login', { replace: true });
  }

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{t('sessions.title')}</div>
      <p className="text-xs text-muted-foreground">{t('sessions.description')}</p>
      <div>
        <ConfirmButton
          size="sm"
          variant="outline"
          title={t('sessions.confirmTitle')}
          description={t('sessions.confirmDescription')}
          confirmLabel={t('sessions.button')}
          // nothing is lost: the player logs in again
          destructive={false}
          onConfirm={logOutEverywhere}
        >
          {t('sessions.button')}
        </ConfirmButton>
      </div>
    </div>
  );
}
