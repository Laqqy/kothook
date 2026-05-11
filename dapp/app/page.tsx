'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-12 text-center">
      <header className="absolute top-0 right-0 p-6">
        <ConnectButton />
      </header>

      <div className="max-w-2xl space-y-6">
        <p className="text-amber-400 font-mono uppercase tracking-widest text-sm">
          King of the Hill · $KOTH
        </p>
        <h1 className="text-5xl md:text-6xl font-semibold leading-tight">
          A throne that pays you 2% of every swap.
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Buy $KOTH above the decayed record to crown yourself. Earn ETH on every
          subsequent swap until someone pays more — or until you sell.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/throne-room"
          className="rounded-md bg-amber-500 text-zinc-950 font-semibold px-5 py-3 hover:bg-amber-400 transition-colors"
        >
          Enter the Throne Room
        </Link>
        <a
          href="https://github.com/anthropics/claude-code/issues"
          className="rounded-md border border-zinc-700 px-5 py-3 hover:border-amber-400 transition-colors"
        >
          Read the rules
        </a>
      </div>

      <p className="text-xs text-zinc-500 font-mono">
        Phase 1 scaffolding · v4 hook deployed on local Anvil
      </p>
    </main>
  );
}
