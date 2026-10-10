export function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
