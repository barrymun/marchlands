import { BASIC_RESOURCES, type BasicResource } from '@marchlands/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCitiesByCityIdQueryKey, putCitiesWorkRatesMutation, type CityBean } from '@marchlands/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { fmtExact } from '@/lib/format';
import { FIELD_LABEL } from '@/components/city-dialog/city-form/constants';

/**
 * Work rates (interior.modifyCommenceRate): the share of each field type's workers this city
 * employs. Lower rates produce less but free people as idle population, which barracks train from.
 */
export function WorkRates({ city }: { city: CityBean }) {
  const { t } = useTranslation('city-dialog');
  const current = Object.fromEntries(BASIC_RESOURCES.map((r) => [r, city.resource[r].workRate])) as Record<BasicResource, number>;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const value = (r: BasicResource) => draft[r] ?? String(current[r]);
  const save = useCommand(putCitiesWorkRatesMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], t('workRates.saved'));
  const saveRates = (rates: Partial<Record<BasicResource, number>>) =>
    save.mutate({ path: { cityId: city.id }, body: rates }, { onSuccess: () => setDraft({}) });
  const setAll = (n: number) => saveRates(Object.fromEntries(BASIC_RESOURCES.map((r) => [r, n])));
  const parsed = Object.fromEntries(BASIC_RESOURCES.map((r) => [r, Math.min(100, Math.max(0, Number(value(r)) || 0))])) as Record<BasicResource, number>;
  const dirty = BASIC_RESOURCES.some((r) => parsed[r] !== current[r]);
  const workers = BASIC_RESOURCES.reduce((t, r) => t + city.resource[r].workPeople, 0);
  return (
    <div className="grid gap-2">
      <Label>{t('workRates.label')}</Label>
      <p className="text-xs text-muted-foreground">
        {t('workRates.description', { idle: fmtExact(city.resource.idlePopulation), workers: fmtExact(workers) })}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BASIC_RESOURCES.map((r) => (
          <label key={r} className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('workRates.field', { resource: FIELD_LABEL[r] })}</span>
            <Input
              inputMode="numeric"
              className="h-8"
              value={value(r)}
              onChange={(e) => setDraft({ ...draft, [r]: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => saveRates(parsed)}>
          {t('workRates.save')}
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(0)}>
          {t('workRates.allIdle')}
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(100)}>
          {t('workRates.allFull')}
        </Button>
      </div>
    </div>
  );
}
