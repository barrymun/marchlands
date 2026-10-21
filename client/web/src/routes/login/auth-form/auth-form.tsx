import { useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { postAuthLogin, postAuthRegister } from '@marchlands/api-client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, tokenStore } from '@/lib/api';
import { formText } from '@/lib/forms';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation('login');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = formText(form, 'username');
    const password = formText(form, 'password');
    setBusy(true);
    setError(null);
    try {
      const { data: session } =
        mode === 'login'
          ? await postAuthLogin({ body: { username, password }, throwOnError: true })
          : await postAuthRegister({ body: { username, password, email: formText(form, 'email') }, throwOnError: true });
      qc.clear();
      tokenStore.set(session.token);
      void navigate(session.hasPlayer ? '/' : '/create', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-username`}>{t('form.username')}</Label>
        <Input id={`${mode}-username`} name="username" autoComplete="username" required />
      </div>
      {mode === 'register' && (
        <div className="grid gap-2">
          <Label htmlFor="register-email">{t('form.email')}</Label>
          <Input id="register-email" name="email" type="email" autoComplete="email" required />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-password`}>{t('form.password')}</Label>
        <Input id={`${mode}-password`} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={busy}>
        {mode === 'login' ? t('form.logIn') : t('form.createAccount')}
      </Button>
    </form>
  );
}
