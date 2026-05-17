'use client';

import { useState } from 'react';
import {
  useChronicle,
  type ActiveReign,
  type ReignRecord,
  type ReignReason,
  imageUriFromTokenUri,
} from '@/hooks/use-chronicle';
import {
  useContracts,
  useIsDeployed,
} from '@/hooks/use-contracts';
import { useReadContract } from 'wagmi';
import { ChronicleSoulAbi, ChronicleScrollAbi } from '@/abis';
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

const reasonStyle: Record<
  ReignReason,
  { label: string; tone: string; ring: string }
> = {
  OVERTHROWN: {
    label: 'Overthrown',
    tone: 'text-gold',
    ring: 'border-gold/40',
  },
  DUMP: {
    label: 'Sold the crown',
    tone: 'text-vermilion-bright',
    ring: 'border-vermilion/40',
  },
  FORFEIT: {
    label: 'Forfeit',
    tone: 'text-stone',
    ring: 'border-stone/40',
  },
  UNKNOWN: {
    label: 'Unknown',
    tone: 'text-stone',
    ring: 'border-stone/40',
  },
};

export function Chronicle() {
  const hasMounted = useHasMounted();
  const ch = useChronicle();

  const sortedPast = [...ch.past].sort((a, b) =>
    b.reignId > a.reignId ? 1 : b.reignId < a.reignId ? -1 : 0,
  );

  const totalEarned = ch.past.reduce(
    (acc, r) => acc + r.ethEarnedWei,
    ch.active?.earningsWei ?? 0n,
  );

  return (
    <section className="relative">
      <div className="reveal flex items-center gap-3 text-gold-leaf text-[11px] font-mono uppercase tracking-[0.35em]">
        <span>The Chronicle</span>
        <span className="text-bronze-bright">·</span>
        <span className="tnum text-stone">
          Block {hasMounted ? formatInt(ch.blockNumber) : '—'}
        </span>
        {hasMounted && ch.isDemo && (
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
          Chronicle <span className="font-body italic font-medium text-gold-pale">of Crowns</span>
        </span>
        <span className="block text-stone text-base md:text-lg max-w-2xl mt-4 tracking-wide leading-relaxed font-body">
          Every reign etched in stone. The Soul and Scroll minted for each
          fallen sovereign are immutable proof of their{' '}
          <span className="text-gold">moment upon the hill</span>.
        </span>
      </h1>

      {/* Stats strip */}
      <div className="reveal mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 3xl:gap-5">
        <Stat
          icon={<Crown className="w-4 h-4" />}
          label="Reigns Recorded"
          value={String(ch.past.length)}
          tail={ch.active ? '+1 currently reigning' : 'No active king'}
        />
        <Stat
          icon={<Fleur className="w-4 h-4" />}
          label="Peak Coronation"
          value={`${formatWeiETH(ch.peakRecordWei, 3)} Ξ`}
          tail="Highest record-buy ever"
          accent
        />
        <Stat
          icon={<Asterism className="w-4 h-4" />}
          label="ETH Earned (All Reigns)"
          value={`${formatWeiETH(totalEarned, 3)} Ξ`}
          tail="Fees paid by usurpers"
        />
      </div>

      {/* Active reign */}
      {ch.active && (
        <div className="mt-14">
          <SectionLabel
            label="The Living Crown"
            sub="Currently reigning"
          />
          <ActiveReignCard reign={ch.active} />
        </div>
      )}

      {/* Past reigns */}
      <div className="mt-14">
        <SectionLabel
          label="The Fallen"
          sub={`${sortedPast.length} immortalised in NFT`}
        />
        {ch.isLoading && sortedPast.length === 0 ? (
          <EmptyMessage>Unfurling the scrolls of memory…</EmptyMessage>
        ) : sortedPast.length === 0 ? (
          <EmptyMessage>
            No reigns yet ended. The first king's chronicle awaits.
          </EmptyMessage>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-3 3xl:gap-5">
            {sortedPast.map((r, i) => (
              <PastReignCard key={r.reignId.toString()} reign={r} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ActiveReignCard({ reign }: { reign: ActiveReign }) {
  return (
    <div className="reveal mt-4 vellum-card border-gold/40 rounded-sm p-6 md:p-8 relative overflow-hidden shadow-[0_0_0_1px_rgba(232,179,57,0.15),0_0_32px_rgba(232,179,57,0.12)]">
      <div className="absolute -top-12 -right-12 w-48 h-48 text-gold/10 pointer-events-none">
        <Crown className="w-full h-full" />
      </div>
      <div className="flex items-center gap-2 text-gold font-mono text-[10px] uppercase tracking-[0.3em] mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-gold throb inline-block" />
        Reigning · #{reign.reignId.toString()}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <Field label="Sovereign" />
          <AddressCopy address={reign.king} accent />
        </div>
        <div>
          <Field label="Record-buy" />
          <div className="font-display text-3xl tnum text-gold">
            {formatWeiETH(reign.recordHighWei, 4)}{' '}
            <span className="text-gold-leaf text-lg">Ξ</span>
          </div>
        </div>
        <div>
          <Field label="Locked coffers" />
          <div className="font-display text-3xl tnum text-parchment">
            {formatWeiETH(reign.earningsWei, 4)}{' '}
            <span className="text-gold-leaf text-lg">Ξ</span>
          </div>
        </div>
      </div>
      <div className="mt-6 font-mono text-[11px] text-stone">
        Record set at block {formatInt(reign.recordBlock)} · NFTs unminted until
        dethrone
      </div>
    </div>
  );
}

function PastReignCard({
  reign,
  index,
}: {
  reign: ReignRecord;
  index: number;
}) {
  const r = reasonStyle[reign.reason];
  return (
    <article
      className="reveal vellum-card rounded-sm px-6 py-7 flex flex-col gap-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf">
            Reign #{reign.reignId.toString()}
          </div>
          <div className="mt-2">
            <AddressCopy address={reign.king} />
          </div>
        </div>
        <span
          className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.3em] px-3 py-1.5 rounded-sm border ${r.ring} ${r.tone}`}
        >
          {r.label}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <ReignStat
          label="Record-buy"
          value={`${formatWeiETH(reign.recordHighWei, 4)} Ξ`}
          accent
        />
        <ReignStat
          label="ETH Earned"
          value={`${formatWeiETH(reign.ethEarnedWei, 4)} Ξ`}
        />
        <ReignStat label="Started" value={`Block ${formatInt(reign.startBlock)}`} />
        <ReignStat label="Ended" value={`Block ${formatInt(reign.endBlock)}`} />
        <ReignStat
          label="Duration"
          value={`${formatInt(reign.durationBlocks)} blocks`}
        />
        <ReignStat
          label="Coffers"
          value={
            reign.unclaimed
              ? `${formatWeiETH(reign.remainingWei, 4)} Ξ unclaimed`
              : 'Settled'
          }
          accent={reign.unclaimed}
        />
      </div>

      <NftPair reignId={reign.reignId} />
    </article>
  );
}

function NftPair({ reignId }: { reignId: bigint }) {
  const isDeployed = useIsDeployed();
  const { chronicleSoul: soul, chronicleScroll: scroll } = useContracts();

  const soulUri = useReadContract({
    address: soul,
    abi: ChronicleSoulAbi,
    functionName: 'tokenURI',
    args: [reignId],
    query: { enabled: isDeployed },
  });
  const scrollUri = useReadContract({
    address: scroll,
    abi: ChronicleScrollAbi,
    functionName: 'tokenURI',
    args: [reignId],
    query: { enabled: isDeployed },
  });

  const soulImg = soulUri.data
    ? imageUriFromTokenUri(soulUri.data as string)
    : null;
  const scrollImg = scrollUri.data
    ? imageUriFromTokenUri(scrollUri.data as string)
    : null;

  return (
    <div className="mt-1 grid grid-cols-2 gap-3">
      <NftCard kind="Soul" img={soulImg} reignId={reignId} />
      <NftCard kind="Scroll" img={scrollImg} reignId={reignId} />
    </div>
  );
}

function NftCard({
  kind,
  img,
  reignId,
}: {
  kind: 'Soul' | 'Scroll';
  img: string | null;
  reignId: bigint;
}) {
  const [open, setOpen] = useState(false);
  const tone =
    kind === 'Soul' ? 'text-gold border-gold/30' : 'text-gold-leaf border-bronze/40';

  return (
    <>
      <button
        type="button"
        onClick={() => img && setOpen(true)}
        disabled={!img}
        className={`group relative aspect-[4/5] rounded-sm overflow-hidden border bg-ink/60 ${tone} transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {img ? (
          <img
            src={img}
            alt={`${kind} #${reignId}`}
            className="w-full h-full object-contain transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center font-mono text-[10px] uppercase tracking-[0.3em]">
            {kind}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-ink/85 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
          <span>{kind}</span>
          <span className="text-stone">#{reignId.toString()}</span>
        </div>
      </button>

      {open && img && (
        <div
          className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-sm grid place-items-center p-6"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={img}
              alt={`${kind} #${reignId}`}
              className="w-full h-auto rounded-sm border border-bronze/60"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full font-display tracking-wide uppercase text-sm py-2 bg-bronze/30 border border-bronze text-parchment hover:bg-bronze/50 transition-colors rounded-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AddressCopy({
  address,
  accent,
}: {
  address: `0x${string}`;
  accent?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title={address}
      className={`font-mono text-sm tnum transition-colors hover:text-gold ${
        accent ? 'text-gold' : 'text-parchment'
      }`}
    >
      {copied ? '✓ copied' : shortAddress(address, 6, 4)}
    </button>
  );
}

function Field({ label }: { label: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf mb-1.5">
      {label}
    </div>
  );
}

function ReignStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-stone">
        {label}
      </div>
      <div
        className={`font-mono tnum ${accent ? 'text-gold' : 'text-parchment'}`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="reveal flex items-end justify-between mb-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-gold-leaf">
          {label}
        </div>
        <div className="font-display text-xl text-parchment mt-1">{sub}</div>
      </div>
      <div className="flex-1 ml-6 border-b border-bronze/40 mb-2" />
    </div>
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
