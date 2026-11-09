import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthForm } from '@/routes/login/auth-form/auth-form';
import { AuthMode } from '@/routes/login/constants';

export function LoginPage() {
  const { t } = useTranslation('login');
  const [tab, setTab] = useState<string>(AuthMode.LOGIN);
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 end-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Marchlands</h1>
          </CardTitle>
          <CardDescription>{t('tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value={AuthMode.LOGIN}>{t('tabs.login')}</TabsTrigger>
              <TabsTrigger value={AuthMode.REGISTER}>{t('tabs.register')}</TabsTrigger>
            </TabsList>
            <TabsContent value={AuthMode.LOGIN}>
              <AuthForm mode={AuthMode.LOGIN} />
            </TabsContent>
            <TabsContent value={AuthMode.REGISTER}>
              <AuthForm mode={AuthMode.REGISTER} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
