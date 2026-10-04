export function LegoPctBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="space-y-0.5" role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
      <div className="flex justify-between text-[10px] text-white/50"><span>{label}</span><span className="font-semibold text-white/80">{Math.round(pct * 100)}%</span></div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct * 100)}%` }} />
      </div>
    </div>
  );
}
