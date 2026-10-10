export function Unlocks({ list }: { list: { name: string; level: number }[] }) {
  if (!list.length) return null;
  return <p className="text-xs text-muted-foreground">Unlocks: {list.map((u) => `${u.name} (Lv ${u.level})`).join(', ')}</p>;
}
