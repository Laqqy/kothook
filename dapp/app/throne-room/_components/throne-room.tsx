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
  const eligibleCount = room.entries.filter(
    (e) => e.status === 'forfeitable',
  ).length;
  const releasedCount = room.entries.filter(
    (e) => e.status === 'released',
  ).length;
  const totalLocked = room.entries.reduce(
    (acc, e) => acc + e.remainingWei,
    0n,
  );

  return (
    <section className="relative">
      {/* Heading */}
      <div className="reveal flex items-center gap-3 text-gold-leaf text-[11px] font-mono uppercase tracking-[0.35em]">
        <span>Reclaim Lost Tribute</span>
        <span className="text-bronze-bright">·</span>
        <span className="tnum text-stone">
          Block {hasMounted ? formatInt(room.blockNumber) : '—'}
        </span>
        {hasMounted && room.isDemo && (
          <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-vermilion-bright border border-vermilion/50 px-2 py-0.5 rounded-sm">
            Demo
          </span>
        )}
      </div>
      <HairlineDivider
        ornament={<Asterism className="w-3 h-3 text-gold-leaf" />}
        className="reveal mt-3"
      />

      <h1
        className="reveal-ink mt-10 font-display font-medium text-balance"
        style={{ animationDelay: '120ms' }}
      >
        <span className="block font-body italic font-normal text-stone text-xl md:text-2xl mb-1 tracking-wide">
          The
        </span>
        <span className="block text-5xl sm:text-6xl md:text-7xl 2xl:text-8xl 3xl:text-[8.5rem] 4xl:text-[11rem] leading-[0.95] tracking-tight text-parchment">
          Throne <span className="font-body italic font-medium text-gold-pale">Room</span>
        </span>
        <span className="block text-stone text-base md:text-lg max-w-2xl mt-4 tracking-wide leading-relaxed font-body">
          The vaults of all deposed sovereigns. Twelve hours after a dethrone,
          any keeper may reclaim the lost tribute — taking{' '}
          <span className="text-gold">3%</span> as keeper&apos;s share whilst
          the remainder is <span className="text-gold">cast to ash</span>.
        </span>
      </h1>

      {/* Top stats */}
      <div className="reveal mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 3xl:gap-5">
        <Stat
          icon={<Crown className="w-4 h-4" />}
          label="Deposed Vaults"
          value={String(room.entries.length)}
          tail={`${eligibleCount} ready · ${releasedCount} released`}
        />
        <Stat
          icon={<Fleur className="w-4 h-4" />}
          label="ETH Locked"
          value={`${formatWeiETH(totalLocked)} Ξ`}
          tail="Across pending vaults"
          accent
        />
        <Stat
          icon={<Asterism className="w-4 h-4" />}
          label="Reclaim Window"
          value="~12h"
          tail="3,600 blocks · 3% keeper share"
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
          <ul className="space-y-3">
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
  const released = entry.status === 'released';
  const reigning = entry.status === 'reigning';

  const onCopy = () => {
    void navigator.clipboard.writeText(entry.king);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const dotColor = {
    reigning: 'bg-gold throb',
    locked: 'bg-gold-leaf',
    forfeitable: 'bg-gold',
    released: 'bg-stone-soft',
  }[entry.status];

  const labelColor = released
    ? 'text-stone-soft'
    : 'text-gold-leaf';

  return (
    <li
      className={`reveal vellum-card rounded-sm transition-all px-5 py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center ${
        released
          ? 'opacity-55 grayscale-[0.25]'
          : reigning
            ? 'border-gold/40 shadow-[0_0_18px_rgba(232,179,57,0.15)]'
            : 'hover:border-gold-leaf/50'
      }`}
      style={{ animationDelay: `${index * 80 + 200}ms` }}
    >
      {/* Address */}
      <div className="md:col-span-3 flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-sm shrink-0 ${dotColor}`} />
        <div className="min-w-0">
          <div
            className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
              reigning ? 'text-gold' : labelColor
            }`}
          >
            {reigning ? 'Reigning' : released ? 'Released' : 'Deposed'}
          </div>
          <button
            type="button"
            onClick={onCopy}
            className={`block font-mono text-sm tnum truncate text-left w-full transition-colors ${
              released
                ? 'text-stone hover:text-stone-soft'
                : 'text-parchment hover:text-gold'
            }`}
            title={entry.king}
          >
            {copied ? '✓ copied' : shortAddress(entry.king, 6, 4)}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="md:col-span-2">
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${labelColor}`}
        >
          Coffers
        </div>
        {released ? (
          <div className="font-display text-2xl tnum text-stone line-through decoration-stone/40">
            {formatWeiETH(entry.earningsAtDethroneWei, 4)}{' '}
            <span className="text-stone-soft text-base">Ξ</span>
          </div>
        ) : (
          <div className="font-display text-2xl tnum text-gold">
            {formatWeiETH(entry.remainingWei, 4)}{' '}
            <span className="text-gold-leaf text-base">Ξ</span>
          </div>
        )}
      </div>

      {/* When */}
      <div className="md:col-span-2">
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
            reigning ? 'text-gold' : labelColor
          }`}
        >
          {reigning ? 'Crowned' : 'Dethroned'}
        </div>
        {reigning ? (
          <div className="font-mono text-sm tnum text-parchment">
            on the throne
          </div>
        ) : (
          <>
            <div
              className={`font-mono text-sm tnum ${
                released ? 'text-stone' : 'text-parchment'
              }`}
            >
              {blocksAgo > 0n ? `${formatInt(blocksAgo)} blocks ago` : 'this block'}
            </div>
            <div className="font-mono text-[10px] text-stone-soft tnum">
              Block {formatInt(entry.dethronedAt)}
            </div>
          </>
        )}
      </div>

      {/* Countdown / status */}
      <div className="md:col-span-2">
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
            reigning ? 'text-gold' : labelColor
          }`}
        >
          Status
        </div>
        {reigning ? (
          <>
            <div className="font-display text-lg text-gold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold throb inline-block" />
              Accruing
            </div>
            <div className="font-mono text-[10px] text-stone">
              2% on every swap
            </div>
          </>
        ) : entry.status === 'forfeitable' ? (
          <>
            <div className="font-display text-lg text-gold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold throb inline-block" />
              Ready
            </div>
            <div className="font-mono text-[10px] text-stone">
              Keeper share · {formatWeiETH(entry.keeperTipWei, 4)} Ξ
            </div>
          </>
        ) : entry.status === 'locked' ? (
          <LockedStatus entry={entry} />
        ) : (
          <>
            <div className="font-display text-lg text-stone">Settled</div>
            <div className="font-mono text-[10px] text-stone-soft">
              Released to bearer
            </div>
          </>
        )}
      </div>

      {/* Action */}
      <div className="md:col-span-3 flex justify-end">
        {reigning ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold border border-gold/40 px-3 py-2 rounded-sm">
            ·  the king  ·
          </span>
        ) : released ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-stone border border-bronze/40 px-3 py-2 rounded-sm">
            · settled ·
          </span>
        ) : (
          <ReclaimButton entry={entry} />
        )}
      </div>
    </li>
  );
}

function ReclaimButton({ entry }: { entry: DethronedEntry }) {
  const { isConnected } = useAccount();
  const isDeployed = useIsDeployed();
  const { hook } = useContracts();
  const { writeContract, isPending, data: txHash } = useWriteContract();

  const reclaimable = entry.status === 'forfeitable';
  const callable = isConnected && isDeployed && reclaimable;

  const onClick = () => {
    if (!callable) return;
    // minKothOut = 0 — the hook caps in-swap deviation via FORFEIT_SLIP_BPS
    // (50 bps on sqrtPrice). An honest keeper that wants tighter execution
    // can call the contract directly with a computed minimum.
    writeContract({
      address: hook,
      abi: KingOfTheHillHookAbi,
      functionName: 'forfeit',
      args: [entry.king, 0n],
    });
  };

  let label = 'Reclaim';
  if (!isDeployed) label = 'Reclaim (demo)';
  else if (!isConnected) label = 'Connect to reclaim';
  else if (!reclaimable) label = 'Locked';
  if (isPending) label = 'Sealing…';
  if (txHash && !isPending) label = '✓ Submitted';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!callable || isPending}
      className={`font-display tracking-[0.1em] uppercase text-base px-5 py-2.5 rounded-sm transition-all duration-200 disabled:cursor-not-allowed min-h-[44px] ${
        reclaimable
          ? 'bg-gold text-ink hover:bg-flame border border-gold-soft shadow-[0_0_0_1px_rgba(232,179,57,0.4),0_0_18px_rgba(232,179,57,0.3)] disabled:opacity-50 disabled:hover:bg-gold'
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
    <div className="vellum-card rounded-sm px-6 py-6 3xl:px-8 3xl:py-8">
      <div className="flex items-center gap-2.5 mb-3 text-gold-leaf">
        {icon}
        <span className="font-mono text-[10px] 3xl:text-xs uppercase tracking-[0.32em]">
          {label}
        </span>
      </div>
      <div
        className={`font-display tnum text-4xl 3xl:text-5xl 4xl:text-6xl leading-none tracking-tight ${
          accent ? 'text-gold' : 'text-parchment'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[11px] 3xl:text-xs text-stone tracking-wide">
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

/**
 * Live "time until a vault can be reclaimed" readout. Mirrors the hero decay
 * timer: seed from the on-chain block gap (×12s), then tick down locally each
 * second between polls so the countdown feels alive instead of jumping every
 * 12s. Re-seeds whenever the polled block gap changes.
 */
function LockedStatus({ entry }: { entry: DethronedEntry }) {
  const secsLeft = useForfeitCountdown(entry.blocksUntilForfeit);
  return (
    <>
      <div className="font-display text-lg text-parchment tnum">
        {formatCountdown(secsLeft)}
      </div>
      <div className="font-mono text-[10px] text-stone tnum">
        {formatInt(entry.blocksUntilForfeit)} blocks · keeper{' '}
        {formatWeiETH(entry.keeperTipWei, 4)} Ξ
      </div>
    </>
  );
}

function useForfeitCountdown(blocksUntilForfeit: bigint): number {
  const [secsLeft, setSecsLeft] = useState(Number(blocksUntilForfeit) * 12);

  useEffect(() => {
    setSecsLeft(Number(blocksUntilForfeit) * 12);
  }, [blocksUntilForfeit]);

  useEffect(() => {
    const id = setInterval(() => setSecsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, []);

  return secsLeft;
}

function formatCountdown(totalSecs: number): string {
  const s = Math.max(0, totalSecs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
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
