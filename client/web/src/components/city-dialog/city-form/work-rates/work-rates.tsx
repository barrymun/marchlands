import { useState } from 'react';
import { getCitiesByCityIdQueryKey, putCitiesWorkRatesMutation, type CityBean } from '@marchlands/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { FIELD_LABEL, FIELD_RES } from '@/components/city-dialog/city-form/constants';

/**
 * Work rates (interior.modifyCommenceRate): the share of each field type's workers this city
 * employs. Lower rates produce less but free people as idle population, which barracks train from.
 */
export function WorkRates({ city }: { city: CityBean }) {
  const current = Object.fromEntries(FIELD_RES.map((r) => [r, city.resource[r].workRate])) as Record<(typeof FIELD_RES)[number], number>;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const value = (r: (typeof FIELD_RES)[number]) => draft[r] ?? String(current[r]);
  const save = useCommand(putCitiesWorkRatesMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], 'Work rates saved');
  const saveRates = (rates: Partial<Record<(typeof FIELD_RES)[number], number>>) =>
    save.mutate({ path: { cityId: city.id }, body: rates }, { onSuccess: () => setDraft({}) });
  const setAll = (n: number) => saveRates(Object.fromEntries(FIELD_RES.map((r) => [r, n])));
  const parsed = Object.fromEntries(FIELD_RES.map((r) => [r, Math.min(100, Math.max(0, Number(value(r)) || 0))])) as Record<(typeof FIELD_RES)[number], number>;
  const dirty = FIELD_RES.some((r) => parsed[r] !== current[r]);
  const workers = FIELD_RES.reduce((t, r) => t + city.resource[r].workPeople, 0);
  return (
    <div className="grid gap-2">
      <Label>Production work rates</Label>
      <p className="text-xs text-muted-foreground">
        Lower a rate to free that field type&apos;s workers: they become idle population you can train troops from. At 0% the fields produce nothing. Idle now:{' '}
        {city.resource.idlePopulation.toLocaleString('en')} · in the fields: {workers.toLocaleString('en')}.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELD_RES.map((r) => (
          <label key={r} className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{FIELD_LABEL[r]} %</span>
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
          Save rates
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(0)}>
          All 0% (everyone idle)
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => setAll(100)}>
          All 100%
        </Button>
      </div>
    </div>
  );
}
