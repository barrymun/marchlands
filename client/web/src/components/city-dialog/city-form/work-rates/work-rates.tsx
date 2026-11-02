import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CityBean, getCitiesByCityIdQueryKey, putCitiesWorkRatesMutation } from '@marchlands/api-client';
import { BASIC_RESOURCES, type BasicResource } from '@marchlands/core';

import { FIELD_LABEL, PERCENT_RANGE } from '@/components/city-dialog/city-form/constants';
import { NumberField } from '@/components/number-field/number-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { fmtExact } from '@/lib/format';
import { textInRange } from '@/lib/ranges';

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
  // kept as typed: a rate out of range shows as invalid, and nothing is saved until every one is in
  const valid = BASIC_RESOURCES.every((r) => textInRange(value(r), PERCENT_RANGE));
  const parsed = Object.fromEntries(BASIC_RESOURCES.map((r) => [r, Number(value(r))])) as Record<BasicResource, number>;
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
            <NumberField className="h-8" range={PERCENT_RANGE} value={value(r)} onChange={(text) => setDraft({ ...draft, [r]: text })} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!valid || !dirty || save.isPending} onClick={() => saveRates(parsed)}>
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
