'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useBlockNumber } from 'wagmi';
import { useIsDeployed } from '@/hooks/use-contracts';
import { useKing } from '@/hooks/use-king';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { formatInt } from './format';
import { Crown } from './ornaments';

const SOCIAL = {
  twitter: 'https://x.com/KOTHook',
  github: 'https://github.com/Laqqy/kothook',
};

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
      <div className="mx-auto max-w-7xl 2xl:max-w-[88rem] 3xl:max-w-[124rem] 4xl:max-w-[168rem] px-6 2xl:px-10 3xl:px-12 4xl:px-16 py-4 flex items-center gap-6">
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
          <Link href="/chronicle" className="hover:text-gold transition-colors">
            Chronicle
          </Link>
          <Link href="/whitepaper" className="hover:text-gold transition-colors">
            Whitepaper
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-1.5 mr-1">
          <SocialLink href={SOCIAL.twitter} label="X">
            <TwitterIcon className="w-4 h-4" />
          </SocialLink>
          <SocialLink href={SOCIAL.github} label="GitHub">
            <GithubIcon className="w-4 h-4" />
          </SocialLink>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone hidden lg:block">
          <span className="text-gold-leaf">▲</span>{' '}
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

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-sm text-stone hover:text-gold hover:bg-vellum-soft transition-colors"
    >
      {children}
    </a>
  );
}

function TwitterIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.91l-5.41-7.06L4.4 22H1.14l8.02-9.16L1 2h7.08l4.89 6.46L18.244 2Zm-1.21 18h1.92L7.06 4H5.04L17.034 20Z" />
    </svg>
  );
}

function GithubIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 1.5C6.2 1.5 1.5 6.3 1.5 12.1c0 4.7 3 8.6 7.1 10 .5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.2.7-1.5-2.3-.3-4.7-1.2-4.7-5.2 0-1.2.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 2.9 1.1.9-.2 1.8-.3 2.7-.3.9 0 1.8.1 2.7.3 2-1.4 2.9-1.1 2.9-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.7 1.1 2.8 0 4-2.4 4.9-4.7 5.2.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 4.1-1.4 7.1-5.3 7.1-10C22.5 6.3 17.8 1.5 12 1.5Z" />
    </svg>
  );
}
