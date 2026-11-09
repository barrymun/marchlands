import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmButton } from '@/components/confirm-button/confirm-button';
import { Button } from '@/components/ui/button';
import { fmtExact } from '@/lib/format';
import { asksFirst } from '@/lib/gold';

/**
 * A button that spends a city's gold: from a tenth of the gold the city holds it asks first (lib/gold.ts, AGENTS.md, UI
 * conventions), saying what's spent and what's left, else it spends at a click. `title`, `description` and
 * `confirmLabel` replace the question's words for a spend that says more (an item bought, with its name).
 */
export function SpendGoldButton({
  cost,
  city,
  title,
  description,
  confirmLabel,
  onSpend,
  buttonTitle,
  ...button
}: {
  cost: number;
  /** the city paying, and its gold */
  city: { name: string; resource: { gold: number } };
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  onSpend: () => unknown;
  buttonTitle?: string;
} & Omit<ComponentProps<typeof Button>, 'title' | 'onClick'>) {
  const { t } = useTranslation('common');
  const have = city.resource.gold;
  if (!asksFirst(cost, have)) return <Button {...button} title={buttonTitle} onClick={() => void onSpend()} />;
  return (
    <ConfirmButton
      {...button}
      buttonTitle={buttonTitle}
      title={title ?? t('spendGold.title', { gold: fmtExact(cost) })}
      description={description ?? t('spendGold.description', { city: city.name, have: fmtExact(have), left: fmtExact(Math.max(0, have - cost)) })}
      confirmLabel={confirmLabel ?? t('spendGold.confirm')}
      destructive={false}
      onConfirm={onSpend}
    />
  );
}
