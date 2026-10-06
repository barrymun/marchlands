import { useState } from 'react';
import { itemConfig, TITLES, titleOf } from '@evony/core';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Countdown } from '@/components/countdown';
import { qk, useCommand, usePlayer } from '@/hooks/use-game';
import { useInventory } from '@/hooks/use-inventory';
import { api, unwrap } from '@/lib/api';

const NEW_ID = 'player.name.1.a';
const FLAG = 'consume.changeflag.1';
const TRUCES = ['player.peace.1', 'player.truce.dream'];
const TRUCE_CENTS = 30;

/** Lord-wide item actions: rename (New ID), change flag (National Flag), truce. */
export function LordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <LordForm />
      </DialogContent>
    </Dialog>
  );
}

function LordForm() {
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const [name, setName] = useState('');
  const [flag, setFlag] = useState('');
  const refresh = () => [qk.player];
  const rename = useCommand(() => unwrap(api.POST('/api/v1/player/rename', { body: { userName: name.trim() } })), refresh, 'Lord renamed');
  const changeFlag = useCommand(() => unwrap(api.POST('/api/v1/player/flag', { body: { flag: flag.trim() } })), refresh, 'Flag changed');
  const truce = useCommand((itemId: string) => unwrap(api.POST('/api/v1/player/truce', { body: { itemId } })), refresh, 'Truce in effect');
  const now = Date.now();
  const truceBuff = player.data?.buffs.find((b) => b.id === 'PlayerPeaceBuff' && b.endTime > now);
  const truceCooldown = player.data?.buffs.find((b) => b.id === 'PlayerPeaceCoolDownBuff' && b.endTime > now);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Lord {info?.userName}</DialogTitle>
        <DialogDescription>
          {info?.titleName} · flag {info?.flag} · {info?.cents ?? 0} cents
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <TitleSection />
        <Separator />
        <div className="grid gap-2">
          <Label htmlFor="lord-name">
            New name · {itemConfig(NEW_ID)?.name} ×{inv.count(NEW_ID)}
          </Label>
          <div className="flex gap-2">
            <Input id="lord-name" value={name} maxLength={20} placeholder={info?.userName} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name.trim() || inv.count(NEW_ID) === 0 || rename.isPending}
              onClick={() => rename.mutate(undefined, { onSuccess: () => setName('') })}
            >
              Rename
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lord-flag">
            New flag · {itemConfig(FLAG)?.name} ×{inv.count(FLAG)}
          </Label>
          <div className="flex gap-2">
            <Input id="lord-flag" value={flag} maxLength={5} placeholder={info?.flag} onChange={(e) => setFlag(e.target.value)} />
            <Button
              disabled={!flag.trim() || inv.count(FLAG) === 0 || changeFlag.isPending}
              onClick={() => changeFlag.mutate(undefined, { onSuccess: () => setFlag('') })}
            >
              Change
            </Button>
          </div>
        </div>
        <Separator />
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            Truce
            {truceBuff && (
              <Badge variant="secondary">
                active · <Countdown endTime={truceBuff.endTime} />
              </Badge>
            )}
            {!truceBuff && truceCooldown && (
              <Badge variant="outline">
                cooldown · <Countdown endTime={truceCooldown.endTime} />
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Your cities cannot be attacked for 12 hours, and you cannot attack either. A cooldown follows.</p>
          <div className="flex flex-wrap gap-2">
            {TRUCES.map((id) => {
              const owned = inv.count(id);
              if (id === 'player.truce.dream' && owned === 0) return null;
              return (
                <Button
                  key={id}
                  size="sm"
                  variant={owned > 0 ? 'default' : 'outline'}
                  disabled={!!truceBuff || !!truceCooldown || truce.isPending || (owned === 0 && inv.cents < TRUCE_CENTS)}
                  onClick={() => truce.mutate(id)}
                >
                  {itemConfig(id)?.name} · {owned > 0 ? `×${owned}` : `${TRUCE_CENTS} cents`}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Nobility titles: each raises how many cities the lord may own (Civilian 1 … Prince 10) and needs
 * prestige plus medals, which the promotion uses up.
 */
function TitleSection() {
  const player = usePlayer();
  const inv = useInventory();
  const info = player.data?.playerInfo;
  const promote = useCommand(
    () => unwrap(api.POST('/api/v1/player/title/promote')),
    () => [qk.player],
    'Promoted',
  );
  if (!info) return null;
  const current = titleOf(info.titleId);
  const next = TITLES[info.titleId + 1];
  const cities = player.data?.castles.length ?? 1;
  const req = next
    ? [
        {
          label: `${next.prestige.toLocaleString('en')} prestige`,
          have: `${Math.floor(info.prestige).toLocaleString('en')}`,
          ok: info.prestige >= next.prestige,
        },
        ...Object.entries(next.medals).map(([id, n]) => ({
          label: `${n} × ${itemConfig(id)?.name ?? id}`,
          have: `${inv.count(id)}`,
          ok: inv.count(id) >= n,
        })),
      ]
    : [];
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Title: {current.name}
        <Badge variant="secondary">
          {cities} / {current.maxCities} cit{current.maxCities === 1 ? 'y' : 'ies'}
        </Badge>
      </div>
      {next ? (
        <>
          <p className="text-xs text-muted-foreground">
            {next.name} raises your city limit to {next.maxCities}. The medals are used up.
          </p>
          <ul className="grid gap-1 text-sm">
            {req.map((r) => (
              <li key={r.label} className="flex items-center gap-1.5">
                {r.ok ? <Check className="size-3.5 text-emerald-600" /> : <X className="size-3.5 text-destructive" />}
                {r.label} <span className="text-xs text-muted-foreground">(have {r.have})</span>
              </li>
            ))}
          </ul>
          <Button size="sm" className="justify-self-start" disabled={!req.every((r) => r.ok) || promote.isPending} onClick={() => promote.mutate(undefined)}>
            Promote to {next.name}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">The highest title: up to {current.maxCities} cities.</p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">All titles</summary>
        <table className="mt-1 w-full tabular-nums">
          <tbody>
            {TITLES.slice(1).map((t) => (
              <tr key={t.id} className={t.id === info.titleId ? 'font-medium text-foreground' : ''}>
                <td className="pr-2">{t.name}</td>
                <td className="pr-2">{t.maxCities} cities</td>
                <td className="pr-2">{t.prestige.toLocaleString('en')} prestige</td>
                <td>
                  {Object.entries(t.medals)
                    .map(([id, n]) => `${n} × ${itemConfig(id)?.name ?? id}`)
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
