import { useState } from 'react';
import { getCitiesByCityIdQueryKey, putCitiesTaxMutation, type CityBean } from '@marchlands/api-client';
import { merchantBase, merchantFixed } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { signedRate } from '@/lib/format';
import { FIELD_LABEL, FIELD_RES } from '@/components/city-dialog/city-form/constants';

/**
 * (marchlands) The tax rate sells that share of the city's field output to the merchant as it is produced
 * (at its price, BALANCE.merchant); the people always pay the base tax on top.
 */
export function TaxRate({ city }: { city: CityBean }) {
  const r = city.resource;
  const [draft, setDraft] = useState<string | null>(null);
  const save = useCommand(putCitiesTaxMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], 'Tax rate saved');
  const rate = Math.min(100, Math.max(0, Number(draft ?? r.taxRate) || 0));
  // gross output per game hour: the net rate plus what upkeep and the current tax take
  const gross = Object.fromEntries(FIELD_RES.map((k) => [k, r[k].increaseRate - r[k].breakdown.upkeep - r[k].breakdown.tax])) as Record<
    (typeof FIELD_RES)[number],
    number
  >;
  const sold = FIELD_RES.reduce((g, k) => g + gross[k] * (rate / 100) * merchantBase(k), 0);
  const baseTax = r.taxIncome - r.taxConverted;
  return (
    <div className="grid gap-2">
      <Label htmlFor="tax-rate">Tax rate</Label>
      <p className="text-xs text-muted-foreground">
        This share of each hour&apos;s new food, lumber, stone and iron is sold to the merchant
        {merchantFixed() != null ? ` at ${merchantFixed()} gold each` : ''} as it is produced. Stored resources are never sold. The base tax (
        {signedRate(baseTax)} gold) is paid at any rate.
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="tax-rate"
          inputMode="numeric"
          className="h-8 w-24"
          value={draft ?? String(r.taxRate)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button
          size="sm"
          disabled={rate === r.taxRate || save.isPending}
          onClick={() => save.mutate({ path: { cityId: city.id }, body: { rate } }, { onSuccess: () => setDraft(null) })}
        >
          Save rate
        </Button>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        At {rate}%: {signedRate(sold)} gold from sold output
        {rate > 0 && (
          <>
            {' '}
            for{' '}
            {FIELD_RES.filter((k) => gross[k] > 0)
              .map((k) => `${signedRate(-gross[k] * (rate / 100))} ${FIELD_LABEL[k].toLowerCase()}`)
              .join(', ')}
          </>
        )}
        .
      </p>
    </div>
  );
}
