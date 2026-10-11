import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCitiesByCityIdQueryKey, putCitiesTaxMutation, type CityBean } from '@marchlands/api-client';
import { merchantBase, merchantFixed, BASIC_RESOURCES, type BasicResource } from '@marchlands/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCommand } from '@/hooks/use-game';
import { signedRate } from '@/lib/format';

/**
 * (marchlands) The tax rate sells that share of the city's field output to the merchant as it is produced
 * (at its price, BALANCE.merchant); the people always pay the base tax on top.
 */
export function TaxRate({ city }: { city: CityBean }) {
  const { t } = useTranslation(['city-dialog', 'common']);
  const r = city.resource;
  const [draft, setDraft] = useState<string | null>(null);
  const save = useCommand(putCitiesTaxMutation(), () => [getCitiesByCityIdQueryKey({ path: { cityId: city.id } })], t('taxRate.saved'));
  const rate = Math.min(100, Math.max(0, Number(draft ?? r.taxRate) || 0));
  // gross output per game hour: the net rate plus what upkeep and the current tax take
  const gross = Object.fromEntries(BASIC_RESOURCES.map((k) => [k, r[k].increaseRate - r[k].breakdown.upkeep - r[k].breakdown.tax])) as Record<
    BasicResource,
    number
  >;
  const sold = BASIC_RESOURCES.reduce((g, k) => g + gross[k] * (rate / 100) * merchantBase(k), 0);
  const baseTax = r.taxIncome - r.taxConverted;
  return (
    <div className="grid gap-2">
      <Label htmlFor="tax-rate">{t('taxRate.label')}</Label>
      <p className="text-xs text-muted-foreground">
        {merchantFixed() != null
          ? t('taxRate.descriptionFixed', { price: merchantFixed(), baseTax: signedRate(baseTax) })
          : t('taxRate.description', { baseTax: signedRate(baseTax) })}
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
          {t('taxRate.save')}
        </Button>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {rate > 0
          ? t('taxRate.previewFor', {
              rate,
              sold: signedRate(sold),
              list: BASIC_RESOURCES.filter((k) => gross[k] > 0)
                .map((k) => t('common:amountOf', { amount: signedRate(-gross[k] * (rate / 100)), resource: t(`common:resourcesInline.${k}`) }))
                .join(t('common:list.separator')),
            })
          : t('taxRate.preview', { rate, sold: signedRate(sold) })}
      </p>
    </div>
  );
}
