import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { fmtExact } from '@/lib/format';
import { type NumberRange, textInRange } from '@/lib/ranges';

/**
 * A whole number typed by the player, kept as typed: digits only, nothing clamped, so it can be cleared or go past its
 * range while they type (`max` may be a live count, such as the troops at home). Out of range it shows as invalid with
 * the range in its title; the screen holds its action back until it's in range (textInRange, lib/ranges.ts). `blank`:
 * an empty box is fine (it means none, or all).
 */
export function NumberField({
  value,
  range,
  blank = false,
  onChange,
  className,
  ...input
}: {
  value: string;
  range: NumberRange;
  blank?: boolean;
  onChange: (text: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  'aria-label'?: string;
}) {
  const { t } = useTranslation('common');
  const ok = textInRange(value, range, { blank });
  const allowed =
    range.max == null ? t('range.atLeast', { min: fmtExact(range.min) }) : t('range.between', { min: fmtExact(range.min), max: fmtExact(range.max) });
  return (
    <Input
      {...input}
      className={className}
      inputMode="numeric"
      aria-invalid={!ok}
      title={ok ? undefined : allowed}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );
}
