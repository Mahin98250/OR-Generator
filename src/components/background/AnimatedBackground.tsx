export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div className="absolute left-[-10%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/15 blur-3xl animate-float-slow" />
      <div className="absolute right-[-12%] top-[18%] h-[32rem] w-[32rem] rounded-full bg-violet-500/15 blur-3xl animate-float-medium" />
      <div className="absolute bottom-[-15%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-blue-400/10 blur-3xl animate-float-slow" />
    </div>
  );
}