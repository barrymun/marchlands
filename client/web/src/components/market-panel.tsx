import { useDeferredValue, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { CityBean, MarketMerchant, MarketPriceLevel } from '@evony/api-client';
import { BALANCE, BuildingType, coinsForSpeedup } from '@evony/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Countdown } from '@/components/countdown';
import { qk, useCommand } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { useNow } from '@/hooks/use-now';
import { api, unwrap } from '@/lib/api';
import { fmtExact } from '@/lib/format';
import { cn } from '@/lib/utils';

const RESOURCES = [
  { type: 0, key: 'food', label: 'Food' },
  { type: 1, key: 'wood', label: 'Lumber' },
  { type: 2, key: 'stone', label: 'Stone' },
  { type: 3, key: 'iron', label: 'Iron' },
] as const;
const resLabel = (t: number) => (t === 4 ? 'Gold' : (RESOURCES[t]?.label ?? `#${t}`));
const fmtPrice = (p: number) => p.toLocaleString('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const mk = {
  book: (t: number) => ['market', 'book', t] as const,
  history: (t: number) => ['market', 'history', t] as const,
  orders: ['market', 'orders'] as const,
  shipments: ['market', 'shipments'] as const,
};

type Side = 0 | 1;
type Mode = 'market' | 'limit';

export function MarketPanel({ city }: { city: CityBean }) {
  const market = city.buildings.filter((b) => b.typeId === BuildingType.MARKETPLACE).reduce((m, b) => Math.max(m, b.level), 0);
  const [resType, setResType] = useState(0);
  const [side, setSide] = useState<Side>(0);
  const [mode, setMode] = useState<Mode>('market');
  const [price, setPrice] = useState('');
  const book = useQuery({
    queryKey: mk.book(resType),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/api/v1/market/{resType}', { params: { path: { resType } } })),
  });

  if (market < 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Marketplace</CardTitle>
          <CardDescription>Build a Marketplace in the city to trade food, lumber, stone and iron for gold.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  // clicking a level of the book prepares the opposite order at that price
  const pickLevel = (level: MarketPriceLevel, levelSide: Side) => {
    setSide(levelSide === 1 ? 0 : 1);
    setMode('limit');
    setPrice(String(level.price));
  };
  const pickMerchant = (merchantSells: boolean) => {
    setSide(merchantSells ? 0 : 1);
    setMode('market');
  };

  return (
    <div className="grid gap-4">
      <Tabs value={String(resType)} onValueChange={(v) => setResType(Number(v))}>
        <TabsList>
          {RESOURCES.map((r) => (
            <TabsTrigger key={r.type} value={String(r.type)}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <OrderBook resType={resType} buyers={book.data?.buyers ?? []} sellers={book.data?.sellers ?? []} merchant={book.data?.merchant} onLevel={pickLevel} onMerchant={pickMerchant} />
        <TradeForm
          key={resType}
          city={city}
          market={market}
          resType={resType}
          merchant={book.data?.merchant}
          side={side}
          setSide={setSide}
          mode={mode}
          setMode={setMode}
          price={price}
          setPrice={setPrice}
        />
      </div>
      <PriceHistory resType={resType} />
      <MyOrders />
      <Shipments />
    </div>
  );
}

function OrderBook({
  resType,
  buyers,
  sellers,
  merchant,
  onLevel,
  onMerchant,
}: {
  resType: number;
  buyers: MarketPriceLevel[];
  sellers: MarketPriceLevel[];
  merchant?: MarketMerchant;
  onLevel: (level: MarketPriceLevel, side: Side) => void;
  onMerchant: (merchantSells: boolean) => void;
}) {
  const row = (l: MarketPriceLevel, s: Side) => (
    <TableRow key={`${s}-${l.price}`} className="cursor-pointer" onClick={() => onLevel(l, s)}>
      <TableCell className={cn('tabular-nums', s === 1 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>{fmtPrice(l.price)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtExact(l.amount)}</TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">lord</TableCell>
    </TableRow>
  );
  const merchantRow = (sells: boolean) =>
    merchant && (
      <TableRow key={sells ? 'm-ask' : 'm-bid'} className="cursor-pointer bg-amber-500/5" onClick={() => onMerchant(sells)}>
        <TableCell className={cn('tabular-nums font-medium', sells ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
          {fmtPrice(sells ? merchant.ask : merchant.bid)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">unlimited</TableCell>
        <TableCell className="text-right">
          <Badge variant="outline" className="gap-1 font-normal">
            <Bot className="size-3" /> merchant
          </Badge>
        </TableCell>
      </TableRow>
    );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Order book · {resLabel(resType)}</CardTitle>
        <CardDescription>
          Gold per unit. The merchant always trades; its price rises as people buy and falls as they sell, then drifts back to{' '}
          {merchant ? fmtPrice(merchant.base) : '…'}. Click a row to trade at it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">From</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchantRow(true)}
            {[...sellers].reverse().map((l) => row(l, 1))}
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                sellers above · buyers below{merchant && ` · reference ${fmtPrice(merchant.reference)}`}
              </TableCell>
            </TableRow>
            {buyers.map((l) => row(l, 0))}
            {merchantRow(false)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TradeForm({
  city,
  market,
  resType,
  merchant,
  side,
  setSide,
  mode,
  setMode,
  price,
  setPrice,
}: {
  city: CityBean;
  market: number;
  resType: number;
  merchant?: MarketMerchant;
  side: Side;
  setSide: (s: Side) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  price: string;
  setPrice: (p: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const res = RESOURCES[resType];
  const qty = Number(amount) || 0;
  const unit = Number(price) || 0;
  const ready = qty >= 1 && (mode === 'market' || unit >= 0.001);
  const deferred = useDeferredValue({ qty, unit, side, mode });
  const quote = useQuery({
    queryKey: ['market', 'quote', resType, deferred],
    enabled: ready,
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/market/{resType}/quote', {
          params: { path: { resType }, query: { side: deferred.side, amount: deferred.qty, type: deferred.mode, price: deferred.mode === 'limit' ? deferred.unit : undefined } },
        }),
      ),
  });
  const orders = useQuery({ queryKey: mk.orders, queryFn: () => unwrap(api.GET('/api/v1/market/orders/mine')) });
  const place = useCommand(
    () =>
      unwrap(
        api.POST('/api/v1/cities/{cityId}/market/orders', {
          params: { path: { cityId: city.id } },
          body: { resType, side, amount: qty, type: mode, price: mode === 'limit' ? unit : undefined },
        }),
      ),
    () => [['market'], qk.city(city.id)],
  );

  const have = side === 0 ? city.resource.gold : city.resource[res.key].amount;
  const fee = 1 + BALANCE.marketFee;
  // instant buy: what the gold buys along the merchant's curve (a lower bound: cheaper offers from lords only add to it)
  const maxQty =
    side === 1
      ? Math.floor(have)
      : mode === 'limit'
        ? unit > 0
          ? Math.floor(have / (unit * fee))
          : 0
        : merchant
          ? Math.floor(BALANCE.merchant.depth * Math.log1p(have / (fee * merchant.ask * BALANCE.merchant.depth)))
          : 0;
  const cap = market * BALANCE.marketMaxOrdersPerLevel;
  const openHere = (orders.data ?? []).filter((o) => o.cityId === city.id).length;
  const q = quote.data && ready ? quote.data : undefined;
  const cost = q ? (side === 0 ? q.gold + q.escrow : q.filled + q.escrow) : 0;
  const affordable = cost <= have;
  const wouldRest = !!q && q.rest > 0;
  const valid = ready && !!q && affordable && (!wouldRest || openHere < cap) && (mode === 'limit' || q.filled > 0);
  const word = res.label.toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Trade {word}</CardTitle>
        <CardDescription>
          Trades settle instantly. {BALANCE.marketFee * 100}% fee on purchases. Marketplace Lv {market}: {openHere}/{cap} resting orders here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={side === 0 ? 'default' : 'outline'} onClick={() => setSide(0)}>
            Buy
          </Button>
          <Button variant={side === 1 ? 'default' : 'outline'} onClick={() => setSide(1)}>
            Sell
          </Button>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="market">Instant</TabsTrigger>
            <TabsTrigger value="limit">Set my price</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className={cn('grid gap-3', mode === 'limit' && 'grid-cols-2')}>
          <div className="grid gap-1.5">
            <Label htmlFor="mk-amount">Amount</Label>
            <div className="flex gap-1">
              <Input id="mk-amount" inputMode="numeric" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              <Button size="sm" variant="ghost" disabled={maxQty < 1} onClick={() => setAmount(String(maxQty))}>
                Max
              </Button>
            </div>
          </div>
          {mode === 'limit' && (
            <div className="grid gap-1.5">
              <Label htmlFor="mk-price">{side === 0 ? 'Highest price' : 'Lowest price'} (gold each)</Label>
              <Input id="mk-price" inputMode="decimal" value={price} placeholder="0.000" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
            </div>
          )}
        </div>
        <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-sm tabular-nums">
          {!q ? (
            <span className="text-muted-foreground">Enter an amount{mode === 'limit' ? ' and a price' : ''} to see a quote.</span>
          ) : (
            <>
              {q.filled > 0 ? (
                <div className="flex justify-between gap-2">
                  <span>
                    {side === 0 ? 'Buy' : 'Sell'} {fmtExact(q.filled)} now · avg {fmtPrice(q.avgPrice ?? 0)}
                  </span>
                  <span className="font-medium">
                    {side === 0 ? '−' : '+'}
                    {fmtExact(q.gold)} gold
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">Nothing trades at this price right now.</span>
              )}
              {q.filled > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {q.merchantFilled > 0 && `${fmtExact(q.merchantFilled)} with the merchant`}
                    {q.merchantFilled > 0 && q.playerFilled > 0 && ' · '}
                    {q.playerFilled > 0 && `${fmtExact(q.playerFilled)} with other lords`}
                  </span>
                  {q.fee > 0 && <span>incl. fee {fmtExact(q.fee)}</span>}
                </div>
              )}
              {q.rest > 0 && (
                <div className="flex justify-between text-xs">
                  <span>
                    {fmtExact(q.rest)} waits on the book at {fmtPrice(unit)}
                  </span>
                  <span>
                    holds {fmtExact(q.escrow)} {side === 0 ? 'gold' : word}
                  </span>
                </div>
              )}
              <div className={cn('flex justify-between text-xs', affordable ? 'text-muted-foreground' : 'text-destructive')}>
                <span>{side === 0 ? 'Gold' : res.label} available</span>
                <span>{fmtExact(have)}</span>
              </div>
            </>
          )}
        </div>
        {wouldRest && openHere >= cap && <p className="text-xs text-destructive">Resting-order limit reached: upgrade the Marketplace or cancel an order.</p>}
        <Button
          disabled={!valid || place.isPending}
          onClick={() =>
            place.mutate(undefined, {
              onSuccess: (r) => {
                setAmount('');
                const parts = [];
                if (r.filled > 0) parts.push(`${side === 0 ? 'Bought' : 'Sold'} ${fmtExact(r.filled)} ${word} for ${fmtExact(r.gold)} gold (avg ${fmtPrice(r.avgPrice ?? 0)})`);
                if (r.rest > 0) parts.push(`${fmtExact(r.rest)} waiting on the book`);
                toast.success(parts.join('; '));
              },
            })
          }
        >
          {mode === 'market' ? `${side === 0 ? 'Buy' : 'Sell'} now` : `Place ${side === 0 ? 'buy' : 'sell'} order`}
        </Button>
      </CardContent>
    </Card>
  );
}

const chartConfig = { close: { label: 'Price', color: 'var(--chart-1)' } } satisfies ChartConfig;

function PriceHistory({ resType }: { resType: number }) {
  const history = useQuery({
    queryKey: mk.history(resType),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.GET('/api/v1/market/{resType}/history', { params: { path: { resType } } })),
  });
  const h = history.data;
  const data = (h?.candles ?? []).map((c) => ({ ...c, label: new Date(c.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Price · {resLabel(resType)}</CardTitle>
          <CardDescription>Closing price of each game hour (last 24).</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No trades yet.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis width={48} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(2)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtPrice(Number(v))} />} />
                <Line dataKey="close" type="monotone" stroke="var(--color-close)" strokeWidth={2} dot={data.length < 3} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent trades</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 overflow-y-auto">
          {(h?.trades ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <Table>
              <TableBody>
                {h!.trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className={cn('tabular-nums', t.takerSide === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>{fmtPrice(t.price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtExact(t.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.merchant ? 'merchant' : 'lords'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyOrders() {
  const orders = useQuery({ queryKey: mk.orders, queryFn: () => unwrap(api.GET('/api/v1/market/orders/mine')) });
  const cancel = useCommand(
    (orderId: number) => unwrap(api.DELETE('/api/v1/market/orders/{orderId}', { params: { path: { orderId } } })),
    () => [['market'], ['city']],
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
                  <Badge variant={o.tradeType === 0 ? 'secondary' : 'outline'}>{o.tradeType === 0 ? 'Buy' : 'Sell'}</Badge> {fmtExact(o.amount)} {resLabel(o.resType).toLowerCase()}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtPrice(o.price)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtExact(o.dealedTotal)} / {fmtExact(o.amount)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon-xs" variant="ghost" aria-label="Cancel order" disabled={cancel.isPending} onClick={() => cancel.mutate(o.id)}>
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

/** Only relevant if travel times are re-enabled (BALANCE.marketShipmentBaseMs > 0). */
function Shipments() {
  const now = useNow();
  const inv = useInventory();
  const shipments = useQuery({ queryKey: mk.shipments, queryFn: () => unwrap(api.GET('/api/v1/market/shipments')) });
  const rush = useCommand(
    (shipmentId: number) => unwrap(api.POST('/api/v1/market/shipments/{shipmentId}/speedup', { params: { path: { shipmentId } } })),
    () => [mk.shipments, qk.player],
    'Delivered',
  );
  const list = (shipments.data ?? []).filter((s) => s.endTime > now + 1000);
  if (list.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Goods in transit</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {list.map((s) => {
          const cents = coinsForSpeedup(Math.max(0, s.endTime - now));
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span className="tabular-nums">
                {fmtExact(s.amount)} {resLabel(s.resType).toLowerCase()}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                arrives in <Countdown endTime={s.endTime} />
                <Button size="xs" variant="outline" disabled={rush.isPending || inv.cents < cents} onClick={() => rush.mutate(s.id)}>
                  Deliver now · {fmtExact(cents)} cents
                </Button>
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
