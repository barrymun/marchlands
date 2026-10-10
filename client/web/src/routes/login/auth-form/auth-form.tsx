import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { postAuthLogin, postAuthRegister } from '@marchlands/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, tokenStore } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(null);
    try {
      const { data: session } =
        mode === 'login'
          ? await postAuthLogin({ body: { username, password }, throwOnError: true })
          : await postAuthRegister({ body: { username, password, email: String(form.get('email') ?? '') }, throwOnError: true });
      qc.clear();
      tokenStore.set(session.token);
      navigate(session.hasPlayer ? '/' : '/create', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-username`}>Username</Label>
        <Input id={`${mode}-username`} name="username" autoComplete="username" required />
      </div>
      {mode === 'register' && (
        <div className="grid gap-2">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" name="email" type="email" autoComplete="email" required />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input id={`${mode}-password`} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={busy}>
        {mode === 'login' ? 'Log in' : 'Create account'}
      </Button>
    </form>
  );
}
