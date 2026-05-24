'use client';

import { useTokenStats } from '@/hooks/use-stats';
import { formatLarge, formatWeiETH } from './format';
import { Fleur, Crown, Asterism } from './ornaments';

export function StatCards() {
  const stats = useTokenStats();

  const totalSupplyKOTH = Number(stats.totalSupplyWei) / 1e18;
  const maxSupplyKOTH = Number(stats.maxSupplyWei) / 1e18;
  const burnedKOTH = Number(stats.burnedWei) / 1e18;
  const burnedPct = maxSupplyKOTH > 0 ? (burnedKOTH / maxSupplyKOTH) * 100 : 0;

  return (
    <section className="relative">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 3xl:gap-5">
        <Card
          icon={<Crown className="w-4 h-4" />}
          label="Token Supply"
          primary={formatLarge(totalSupplyKOTH, 3)}
          unit="KOTH"
          tail={`Cap ${formatLarge(maxSupplyKOTH, 0)} · ${
            maxSupplyKOTH > 0
              ? ((totalSupplyKOTH / maxSupplyKOTH) * 100).toFixed(2)
              : '0.00'
          }% remaining`}
          delay={0}
        />
        <Card
          icon={<Fleur className="w-4 h-4" />}
          label="Royal Treasury"
          primary={formatWeiETH(stats.treasuryWei)}
          unit="Ξ"
          tail="1% of every swap · withdrawn by treasurer"
          accent
          delay={100}
        />
        <Card
          icon={<Asterism className="w-4 h-4" />}
          label="Cast to Ash"
          primary={formatLarge(burnedKOTH, 2)}
          unit="KOTH"
          tail={`${burnedPct.toFixed(2)}% of cap incinerated`}
          delay={200}
        />
      </div>
    </section>
  );
}

function Card({
  icon,
  label,
  primary,
  unit,
  tail,
  accent,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  unit: string;
  tail: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <div
      className="reveal relative vellum-card rounded-sm px-6 py-7 3xl:px-9 3xl:py-10 group hover:border-gold-leaf/45 transition-colors"
      style={{ animationDelay: `${delay + 900}ms` }}
    >
      <span aria-hidden className="absolute top-2 left-2 w-2.5 h-px bg-gold-leaf" />
      <span aria-hidden className="absolute top-2 left-2 w-px h-2.5 bg-gold-leaf" />
      <span aria-hidden className="absolute bottom-2 right-2 w-2.5 h-px bg-gold-leaf" />
      <span aria-hidden className="absolute bottom-2 right-2 w-px h-2.5 bg-gold-leaf" />

      <div className="flex items-center gap-2.5 mb-4 text-gold-leaf">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.32em]">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`font-display tnum text-5xl 3xl:text-6xl 4xl:text-7xl leading-none tracking-tight ${
            accent ? 'text-gold' : 'text-parchment'
          }`}
        >
          {primary}
        </span>
        <span className="font-mono text-sm 3xl:text-base text-stone tracking-widest">
          {unit}
        </span>
      </div>

      <div className="mt-3 font-mono text-[11px] 3xl:text-xs text-stone tracking-wide">
        {tail}
      </div>
    </div>
  );
}
