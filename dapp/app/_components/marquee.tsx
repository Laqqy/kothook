const PHRASES = [
  'Succession requires tribute above the decayed record × 1.03',
  'Dump protection · selling whilst crowned triggers automatic dethrone',
  'Forfeit writ · unclaimed coffers cast to ash after twelve hours',
  '3% keeper tip on forfeited treasuries',
  '2% of every swap flows to the reigning sovereign',
  '5% royalty on every Chronicle Scroll resale',
  'Chronicle Soul · soulbound testimony of every overthrow',
];

export function Marquee() {
  // Duplicate twice to make the seamless scroll loop.
  const tokens = [...PHRASES, ...PHRASES];
  return (
    <div className="relative border-y border-bronze/60 bg-ash overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-32 z-10"
        style={{
          background:
            'linear-gradient(90deg, var(--color-ash) 0%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-32 z-10"
        style={{
          background:
            'linear-gradient(270deg, var(--color-ash) 0%, transparent 100%)',
        }}
      />
      <div className="flex marquee-track py-3 whitespace-nowrap will-change-transform">
        {tokens.map((p, i) => (
          <span
            key={i}
            className="px-6 font-mono text-[11px] uppercase tracking-[0.35em] text-stone-soft flex items-center gap-6"
          >
            {p}
            <span className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
