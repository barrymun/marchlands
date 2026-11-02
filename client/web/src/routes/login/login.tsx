import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthForm } from '@/routes/login/auth-form/auth-form';

export function LoginPage() {
  const { t } = useTranslation('login');
  const [tab, setTab] = useState('login');
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 end-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Marchlands</CardTitle>
          <CardDescription>{t('tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('tabs.login')}</TabsTrigger>
              <TabsTrigger value="register">{t('tabs.register')}</TabsTrigger>
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
