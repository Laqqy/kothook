'use client';

import { useState } from 'react';
import { useContracts, useIsDeployed } from '@/hooks/use-contracts';
import { Crown } from './ornaments';

/**
 * Token contract address + outbound links to scanners and aggregators.
 * Lives under the swap widget on the home page — visible to anyone who
 * wants to verify the address or pull KOTH up on a third-party tool.
 */
export function TokenCodex() {
  const { koth } = useContracts();
  const isDeployed = useIsDeployed();
  const [copied, setCopied] = useState(false);

  if (!isDeployed) return null;

  const onCopy = () => {
    void navigator.clipboard.writeText(koth);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const short = `${koth.slice(0, 6)}…${koth.slice(-4)}`;
  const etherscan = `https://etherscan.io/token/${koth}`;
  // DexScreener accepts a bare token address and resolves the deepest pool.
  const dexScreener = `https://dexscreener.com/ethereum/${koth}`;
  // Uniswap app — pre-fills KOTH as the output token of an ETH → KOTH swap.
  const uniswap = `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${koth}&chain=mainnet`;

  return (
    <div className="vellum-card rounded-sm px-5 py-4 relative">
      <div className="absolute top-3 right-3 text-gold-leaf opacity-70">
        <Crown className="w-4 h-4" />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf mb-2">
        Sovereign Contract
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="font-mono text-sm text-parchment tnum truncate"
          title={koth}
        >
          <span className="md:hidden">{short}</span>
          <span className="hidden md:inline">{koth}</span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy contract address"
          className="ml-auto shrink-0 text-gold-leaf hover:text-gold text-[10px] font-mono uppercase tracking-[0.2em] transition-colors px-2 py-1"
        >
          {copied ? '✓ COPIED' : '⎘ COPY'}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.25em]">
        <ExternalChip href={etherscan} label="Etherscan" />
        <span className="text-bronze-bright">·</span>
        <ExternalChip href={dexScreener} label="DexScreener" />
        <span className="text-bronze-bright">·</span>
        <ExternalChip href={uniswap} label="Uniswap" />
      </div>
    </div>
  );
}

function ExternalChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-stone hover:text-gold transition-colors inline-flex items-center gap-1"
    >
      {label}
      <span aria-hidden className="opacity-60">↗</span>
    </a>
  );
}
