export function GlimpseOrb({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full opacity-[0.07] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-48 -left-32 h-[360px] w-[360px] rounded-full opacity-[0.05] blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
