'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useBlockNumber } from 'wagmi';
import { useIsDeployed } from '@/hooks/use-contracts';
import { useKing } from '@/hooks/use-king';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { formatInt } from './format';
import { Crown } from './ornaments';

export function Header() {
  const hasMounted = useHasMounted();
  const isDeployed = useIsDeployed();
  const blockQ = useBlockNumber({
    watch: { enabled: isDeployed, pollingInterval: 12_000 },
    query: { enabled: isDeployed },
  });
  const king = useKing();

  // Resolved on the client only — both SSR and the first client render show "—"
  // so React doesn't trip on a hydration mismatch when the wallet connects to
  // a chain different from the SSR default.
  const displayBlock = hasMounted
    ? isDeployed
      ? blockQ.data
      : king.blockNumber
    : undefined;

  return (
    <header className="relative z-20 border-b border-bronze/60 bg-ink/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 group">
          <Crown className="w-7 h-7 text-gold transition-colors group-hover:text-parchment" />
          <div className="leading-none">
            <div className="font-display text-xl tracking-wide text-parchment">
              King of the Hill
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone mt-0.5">
              $KOTH · v4 Hook
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-stone font-body ml-8">
          <Link href="/" className="hover:text-gold transition-colors">
            Court
          </Link>
          <Link href="/throne-room" className="hover:text-gold transition-colors">
            Throne Room
          </Link>
          <Link href="/lore" className="hover:text-gold transition-colors">
            Lore
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft hidden sm:block">
          <span className="text-bronze-bright">▲</span>{' '}
          <span className="tnum">
            Block {displayBlock ? formatInt(displayBlock) : '—'}
          </span>
        </div>

        <ConnectButton
          showBalance={false}
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
          chainStatus="icon"
        />
      </div>
    </header>
  );
}
