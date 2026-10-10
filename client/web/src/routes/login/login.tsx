import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { AuthForm } from '@/routes/login/auth-form/auth-form';

export function LoginPage() {
  const [tab, setTab] = useState('login');
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Marchlands</CardTitle>
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
