import { useQuery } from '@tanstack/react-query';
import { deleteMarketOrdersByOrderIdMutation, getCitiesByCityIdQueryKey, getMarketOrdersMineOptions } from '@marchlands/api-client';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCommand } from '@/hooks/use-game';
import { allMarketQueries, allOf } from '@/lib/query-keys';
import { fmtExact } from '@/lib/format';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';

export function MyOrders() {
  const orders = useQuery(getMarketOrdersMineOptions());
  const cancel = useCommand(
    deleteMarketOrdersByOrderIdMutation(),
    () => [...allMarketQueries(), allOf(getCitiesByCityIdQueryKey)],
    'Order cancelled; held goods or gold returned',
  );
  const list = orders.data ?? [];
  if (list.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          My waiting orders <span className="font-normal text-muted-foreground">({list.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Filled</TableHead>
              <TableHead className="text-right">Placed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Badge variant={o.tradeType === 0 ? 'secondary' : 'outline'}>{o.tradeType === 0 ? 'Buy' : 'Sell'}</Badge> {fmtExact(o.amount)}{' '}
                  {resLabel(o.resType).toLowerCase()}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPrice(o.price)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtExact(o.dealedTotal)} / {fmtExact(o.amount)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Cancel order"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ path: { orderId: o.id } })}
                  >
                    <X />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
