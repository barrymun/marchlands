import { getGameSpeed } from '@marchlands/core';
import { signedRate } from '@/lib/format';
import type { Row } from '@/components/resource-bar/types';

export function Rows({ rows, total }: { rows: Row[]; total: number }) {
  return (
    <table className="text-xs tabular-nums">
      <tbody>
        {rows.map(([label, v, className]) => (
          <tr key={label} className={className}>
            <td className="pr-4">{label}</td>
            <td className="text-right">{signedRate(v)}</td>
          </tr>
        ))}
        <tr className="border-t font-medium">
          <td className="pr-4 pt-1">Total</td>
          <td className="pt-1 text-right">{signedRate(total)}</td>
        </tr>
        {getGameSpeed() !== 1 && (
          <tr>
            <td colSpan={2} className="pt-1 text-muted-foreground">
              Per real hour (game speed {getGameSpeed()}×)
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
