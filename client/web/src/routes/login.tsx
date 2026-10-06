import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, errorMessage, tokenStore, unwrap } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export function LoginPage() {
  const [tab, setTab] = useState('login');
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Evony</CardTitle>
          <CardDescription>Build your city, raise an army, rule the land.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <AuthForm mode="login" />
            </TabsContent>
            <TabsContent value="register">
              <AuthForm mode="register" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthForm({ mode }: { mode: 'login' | 'register' }) {
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
      const session =
        mode === 'login'
          ? await unwrap(api.POST('/api/v1/auth/login', { body: { username, password } }))
          : await unwrap(api.POST('/api/v1/auth/register', { body: { username, password, email: String(form.get('email') ?? '') } }));
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
