import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { getPlayerQueryKey, getWorldZonesOptions, postPlayer } from '@marchlands/api-client';

import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage, tokenStore } from '@/lib/api';
import { percent } from '@/lib/format';
import { formText } from '@/lib/forms';
import { zoneName } from '@/lib/game-data';
import { GENDERS } from '@/lib/genders';

export function CreateLordPage() {
  const { t } = useTranslation(['create-lord', 'common']);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const zones = useQuery(getWorldZonesOptions());
  const [sex, setSex] = useState('0');
  const [zone, setZone] = useState('-1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { data: created } = await postPlayer({
        body: {
          userName: formText(form, 'userName'),
          castleName: formText(form, 'castleName'),
          flag: formText(form, 'flag'),
          sex: Number(sex),
          zone: Number(zone),
        },
        throwOnError: true,
      });
      tokenStore.set(created.token);
      const { token: _token, ...state } = created;
      qc.setQueryData(getPlayerQueryKey(), state);
      void navigate(`/cities/${state.castles[0]?.id ?? 0}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-3 end-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>{t('title')}</h1>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
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
                <Label htmlFor="sex">{t('gender')}</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger id="sex" className="w-full">
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
              <Label htmlFor="zone">{t('state')}</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger id="zone" className="w-full">
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
