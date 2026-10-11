import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlayerQueryKey, getWorldZonesOptions, postPlayer } from '@marchlands/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage, tokenStore } from '@/lib/api';
import { zoneName } from '@/lib/game-data';
import { GENDERS } from '@/lib/genders';
import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { percent } from '@/lib/format';

export function CreateLordPage() {
  const { t } = useTranslation(['create-lord', 'common']);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const zones = useQuery(getWorldZonesOptions());
  const [sex, setSex] = useState('0');
  const [zone, setZone] = useState('-1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { data: created } = await postPlayer({
        body: {
          userName: String(form.get('userName')),
          castleName: String(form.get('castleName')),
          flag: String(form.get('flag')),
          sex: Number(sex),
          zone: Number(zone),
        },
        throwOnError: true,
      });
      tokenStore.set(created.token);
      const { token: _token, ...state } = created;
      qc.setQueryData(getPlayerQueryKey(), state);
      navigate(`/cities/${state.castles[0]?.id ?? 0}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="userName">{t('playerName')}</Label>
              <Input id="userName" name="userName" required maxLength={20} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="castleName">{t('cityName')}</Label>
              <Input id="castleName" name="castleName" required maxLength={20} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="flag">{t('flag')}</Label>
                <Input id="flag" name="flag" required maxLength={4} placeholder={t('flagPlaceholder')} />
              </div>
              <div className="grid gap-2">
                <Label>{t('gender')}</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={String(g.value)}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t('state')}</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">{t('leastCrowded')}</SelectItem>
                  {zones.data?.map((z) => (
                    <SelectItem key={z.id} value={String(z.id)} disabled={z.openFlats === 0}>
                      {t('zone', { name: zoneName(z.id), count: z.playerCount, settled: percent(z.settled) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => tokenStore.set(null)}>
                {t('common:actions.logOut')}
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {t('submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
