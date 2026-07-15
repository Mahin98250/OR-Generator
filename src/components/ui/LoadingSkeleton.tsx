export function LoadingSkeleton() {
  return (
    <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-glass backdrop-blur-xl">
      <div className="h-5 w-32 rounded-full bg-white/10 animate-shimmer" />
      <div className="h-28 rounded-[20px] bg-white/10 animate-shimmer" />
      <div className="grid gap-2">
        <div className="h-3 w-full rounded-full bg-white/10 animate-shimmer" />
        <div className="h-3 w-5/6 rounded-full bg-white/10 animate-shimmer" />
      </div>
    </div>
  );
}