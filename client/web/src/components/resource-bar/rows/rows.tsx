import { useTranslation } from 'react-i18next';

import { getGameSpeed } from '@marchlands/core';

import type { Row } from '@/components/resource-bar/types';
import { signedRate } from '@/lib/format';

export function Rows({ rows, total }: { rows: Row[]; total: number }) {
  const { t } = useTranslation(['resource-bar', 'common']);
  return (
    <table className="text-xs tabular-nums">
      <tbody>
        {rows.map(([label, v, className]) => (
          <tr key={label} className={className}>
            <td className="pe-4">{label}</td>
            <td className="text-end">{signedRate(v)}</td>
          </tr>
        ))}
        <tr className="border-t font-medium">
          <td className="pe-4 pt-1">{t('common:table.total')}</td>
          <td className="pt-1 text-end">{signedRate(total)}</td>
        </tr>
        {getGameSpeed() !== 1 && (
          <tr>
            <td colSpan={2} className="pt-1 text-muted-foreground">
              {t('rows.perRealHour', { speed: getGameSpeed() })}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
