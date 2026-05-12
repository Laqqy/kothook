'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import type { Address } from 'viem';
import { KingOfTheHillHookAbi } from '@/abis';
import { useContracts, useIsDeployed } from '@/hooks/use-contracts';
import {
  useThroneRoom,
  type DethronedEntry,
} from '@/hooks/use-throne-room';
import { useHasMounted } from '@/hooks/use-has-mounted';
import {
  formatInt,
  formatWeiETH,
  shortAddress,
} from '@/app/_components/format';
import {
  HairlineDivider,
  Asterism,
  Crown,
  Fleur,
} from '@/app/_components/ornaments';

export function ThroneRoom() {
  const hasMounted = useHasMounted();
  const room = useThroneRoom();
  const eligibleCount = room.entries.filter((e) => e.isForfeitable).length;
  const totalLocked = room.entries.reduce(
    (acc, e) => acc + e.earningsWei,
    0n,
  );

  return (
    <section className="relative">
      {/* Heading */}
      <div className="reveal flex items-center gap-3 text-bronze-bright text-[11px] font-mono uppercase tracking-[0.35em]">
        <span>Forfeit Writ</span>
        <span className="text-bronze">·</span>
        <span className="tnum text-stone">
          Block {hasMounted ? formatInt(room.blockNumber) : '—'}
        </span>
        {hasMounted && room.isDemo && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-crimson border border-crimson/40 px-2 py-0.5 rounded-sm">
            Demo
          </span>
        )}
      </div>
      <HairlineDivider
        ornament={<Asterism className="w-3 h-3 text-bronze-bright" />}
        className="reveal mt-3"
      />

      <h1
        className="reveal-ink mt-10 font-display font-light text-balance"
        style={{ animationDelay: '120ms' }}
      >
        <span className="block italic text-stone text-xl md:text-2xl mb-1 tracking-wide">
          The
        </span>
        <span className="block text-6xl md:text-7xl leading-[0.95] tracking-tight text-parchment">
          Throne <span className="italic text-gold-pale">Room</span>
        </span>
        <span className="block text-stone text-base md:text-lg max-w-2xl mt-4 tracking-wide leading-relaxed font-body">
          The vaults of all deposed sovereigns. Twelve hours after a dethrone,
          any keeper may bring the writ of forfeit — claiming{' '}
          <span className="text-gold">3%</span> as tip whilst the remainder is{' '}
          <span className="text-gold">cast to ash</span>.
        </span>
      </h1>

      {/* Top stats */}
      <div className="reveal mt-10 grid grid-cols-1 md:grid-cols-3 gap-px bg-bronze/60 rounded-sm overflow-hidden">
        <Stat
          icon={<Crown className="w-4 h-4" />}
          label="Deposed Vaults"
          value={String(room.entries.length)}
          tail={`${eligibleCount} ready to forfeit`}
        />
        <Stat
          icon={<Fleur className="w-4 h-4" />}
          label="ETH Locked"
          value={`${formatWeiETH(totalLocked, 3)} Ξ`}
          tail="Across all dethroned kings"
          accent
        />
        <Stat
          icon={<Asterism className="w-4 h-4" />}
          label="Forfeit Window"
          value="3,600"
          tail="Blocks · 3% keeper tip"
        />
      </div>

      {/* Table */}
      <div className="mt-12">
        {room.isLoading && room.entries.length === 0 ? (
          <EmptyMessage>Loading the ledger of the deposed…</EmptyMessage>
        ) : room.entries.length === 0 ? (
          <EmptyMessage>
            No coffers held. The realm is settled.
          </EmptyMessage>
        ) : (
          <ul className="space-y-px bg-bronze/60 rounded-sm overflow-hidden">
            {room.entries.map((entry, i) => (
              <DethronedRow key={entry.king} entry={entry} index={i} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DethronedRow({
  entry,
  index,
}: {
  entry: DethronedEntry;
  index: number;
}) {
  const blocksAgo = useBlocksAgo(entry.dethronedAt);
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(entry.king);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <li
      className="reveal bg-ash hover:bg-vellum-soft transition-colors px-5 py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
      style={{ animationDelay: `${index * 80 + 200}ms` }}
    >
      {/* Address */}
      <div className="md:col-span-3 flex items-center gap-3 min-w-0">
        <span className="w-2 h-2 rounded-sm bg-bronze-bright shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
            Deposed
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="block font-mono text-sm text-parchment hover:text-gold transition-colors tnum truncate text-left w-full"
            title={entry.king}
          >
            {copied ? '✓ copied' : shortAddress(entry.king, 6, 4)}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="md:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
          Coffers
        </div>
        <div className="font-display text-2xl tnum text-gold">
          {formatWeiETH(entry.earningsWei, 4)}{' '}
          <span className="text-bronze-bright text-base">Ξ</span>
        </div>
      </div>

      {/* When */}
      <div className="md:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
          Dethroned
        </div>
        <div className="font-mono text-sm text-parchment tnum">
          {blocksAgo > 0n ? `${formatInt(blocksAgo)} blocks ago` : 'this block'}
        </div>
        <div className="font-mono text-[10px] text-stone-soft tnum">
          Block {formatInt(entry.dethronedAt)}
        </div>
      </div>

      {/* Countdown */}
      <div className="md:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
          Writ
        </div>
        {entry.isForfeitable ? (
          <div className="font-display text-lg text-gold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold throb inline-block" />
            Ready
          </div>
        ) : (
          <div className="font-mono text-sm text-parchment tnum">
            {formatInt(entry.blocksUntilForfeit)} blocks
          </div>
        )}
        <div className="font-mono text-[10px] text-stone-soft">
          Keeper tip · {formatWeiETH(entry.keeperTipWei, 4)} Ξ
        </div>
      </div>

      {/* Action */}
      <div className="md:col-span-3 flex justify-end">
        <ForfeitButton entry={entry} />
      </div>
    </li>
  );
}

function ForfeitButton({ entry }: { entry: DethronedEntry }) {
  const { isConnected } = useAccount();
  const isDeployed = useIsDeployed();
  const { hook } = useContracts();
  const { writeContract, isPending, data: txHash } = useWriteContract();

  const callable = isConnected && isDeployed && entry.isForfeitable;

  const onClick = () => {
    if (!callable) return;
    writeContract({
      address: hook,
      abi: KingOfTheHillHookAbi,
      functionName: 'forfeit',
      args: [entry.king],
    });
  };

  let label = 'Forfeit';
  if (!isDeployed) label = 'Forfeit (demo)';
  else if (!isConnected) label = 'Connect to forfeit';
  else if (!entry.isForfeitable) label = 'Locked';
  if (isPending) label = 'Sealing writ…';
  if (txHash && !isPending) label = '✓ Submitted';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!callable || isPending}
      className={`font-display tracking-wide uppercase text-base px-5 py-2.5 rounded-sm transition-all duration-200 disabled:cursor-not-allowed ${
        entry.isForfeitable
          ? 'bg-gold text-ink hover:bg-flame border border-gold-soft disabled:opacity-50 disabled:hover:bg-gold'
          : 'bg-bronze/40 text-stone border border-bronze disabled:opacity-70'
      }`}
    >
      {label}
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
  tail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tail: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ash px-6 py-6">
      <div className="flex items-center gap-2.5 mb-3 text-bronze-bright">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.32em]">
          {label}
        </span>
      </div>
      <div
        className={`font-display tnum text-4xl leading-none ${
          accent ? 'text-gold' : 'text-parchment'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[11px] text-stone-soft tracking-wide">
        {tail}
      </div>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="engraved-inset rounded-sm px-8 py-16 text-center text-stone font-body">
      {children}
    </div>
  );
}

function useBlocksAgo(targetBlock: bigint): bigint {
  const room = useThroneRoom();
  const [now, setNow] = useState(room.blockNumber);

  useEffect(() => {
    setNow(room.blockNumber);
  }, [room.blockNumber]);

  if (now <= targetBlock) return 0n;
  return now - targetBlock;
}
