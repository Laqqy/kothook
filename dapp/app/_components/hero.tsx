'use client';

import { useEffect, useMemo, useState } from 'react';
import { useKing } from '@/hooks/use-king';
import { useHasMounted } from '@/hooks/use-has-mounted';
import {
  formatInt,
  formatWeiETH,
  reignName,
  toRoman,
} from './format';
import { Crown, HairlineDivider, Asterism } from './ornaments';

function formatAddressEngraved(addr: string) {
  // Group into 4-char segments for legibility on the engraved tablet.
  const body = addr.startsWith('0x') ? addr.slice(2) : addr;
  return '0x ' + (body.match(/.{1,4}/g) ?? []).join(' ');
}

function formatTime(totalSecs: number) {
  const s = Math.max(0, totalSecs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}h ${pad(m)}m ${pad(sec)}s`;
  return `${m}m ${pad(sec)}s`;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export function Hero() {
  const hasMounted = useHasMounted();
  const king = useKing();
  const [secsLeft, setSecsLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  // Rebase the countdown whenever the chain advances.
  useEffect(() => {
    setSecsLeft(Number(king.decayBlocksRemaining) * 12);
  }, [king.decayBlocksRemaining]);

  // Tick down every second between block updates for a smooth UI.
  useEffect(() => {
    const id = setInterval(
      () => setSecsLeft((s) => Math.max(s - 1, 0)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const hasKing = king.currentKing !== ZERO_ADDR;

  const decayPct = useMemo(() => {
    const totalSecs = 3600 * 12;
    const elapsedSecs = totalSecs - secsLeft;
    return Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100));
  }, [secsLeft]);

  const remainingPct = 100 - decayPct;

  const onCopy = () => {
    void navigator.clipboard.writeText(king.currentKing);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reignWord = reignName(king.reignsCount);
  const decreeNumeral = toRoman(Number(king.reignsCount));
  const reignStartedAt = king.recordBlock;
  const blocksAgo =
    king.blockNumber > reignStartedAt && reignStartedAt > 0n
      ? king.blockNumber - reignStartedAt
      : 0n;

  return (
    <section className="relative">
      {/* halo behind hero */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-16 h-96 -z-0 opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 40% 0%, rgba(245,165,36,0.16) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10">
        {/* Decree marker row */}
        <div
          className="reveal flex items-center gap-4 text-bronze-bright text-[11px] font-mono uppercase tracking-[0.35em] flex-wrap"
          style={{ animationDelay: '60ms' }}
        >
          <span>Royal Decree</span>
          <span className="text-gold">№ {decreeNumeral || 'O'}</span>
          <span className="text-bronze">·</span>
          <span className="tnum text-stone">
            Block {hasMounted ? formatInt(king.blockNumber) : '—'}
          </span>
          {hasMounted && king.isDemo && (
            <span
              className="ml-auto text-[10px] uppercase tracking-[0.3em] text-crimson border border-crimson/40 px-2 py-0.5 rounded-sm"
              title="No contract addresses configured. Showing sample data — set NEXT_PUBLIC_LOCAL_KOTH / NEXT_PUBLIC_LOCAL_HOOK in dapp/.env.local to read on-chain state."
            >
              Demo
            </span>
          )}
        </div>

        <HairlineDivider
          ornament={<Asterism className="w-3 h-3 text-bronze-bright" />}
          className="reveal mt-3"
        />

        {/* Display title */}
        {hasKing ? (
          <h1
            className="reveal-ink mt-10 font-display font-light text-parchment-soft text-balance"
            style={{ animationDelay: '160ms' }}
          >
            <span className="block italic text-stone text-2xl md:text-3xl mb-1 tracking-wide">
              the
            </span>
            <span className="block text-7xl md:text-8xl lg:text-[7rem] leading-[0.92] tracking-tight text-parchment">
              {reignWord}{' '}
              <span className="italic text-gold-pale">Reign</span>
            </span>
            <span className="block italic text-stone text-2xl md:text-3xl mt-2 tracking-wide">
              of
            </span>
          </h1>
        ) : (
          <h1
            className="reveal-ink mt-10 font-display font-light text-parchment-soft"
            style={{ animationDelay: '160ms' }}
          >
            <span className="block italic text-stone text-2xl md:text-3xl mb-1 tracking-wide">
              the
            </span>
            <span className="block text-7xl md:text-8xl lg:text-[7rem] leading-[0.92] tracking-tight text-parchment">
              <span className="italic text-gold-pale">Throne</span> Vacant
            </span>
            <span className="block italic text-stone text-xl md:text-2xl mt-3 tracking-wide">
              awaiting a sovereign
            </span>
          </h1>
        )}

        {/* Engraved address tablet */}
        {hasKing ? (
          <div
            className="reveal-stamp mt-7 engraved rounded-sm px-6 py-5 relative overflow-hidden"
            style={{ animationDelay: '420ms' }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 20% 50%, rgba(245,165,36,0.12) 0%, transparent 55%)',
              }}
            />
            <div className="absolute top-3 right-3 text-bronze-soft">
              <Crown className="w-5 h-5" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright mb-2">
              Engraved into stone
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-mono text-base md:text-lg text-parchment tnum shimmer-gold">
                {formatAddressEngraved(king.currentKing)}
              </div>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy address"
                className="ml-auto shrink-0 text-bronze-bright hover:text-gold text-[10px] font-mono uppercase tracking-[0.2em] transition-colors"
              >
                {copied ? '✓ COPIED' : '⎘ COPY'}
              </button>
            </div>
            <div className="mt-3 font-mono text-[10px] tracking-widest text-stone-soft">
              Crowned at block{' '}
              <span className="tnum text-parchment-soft">
                {formatInt(reignStartedAt)}
              </span>
              {blocksAgo > 0n && (
                <>
                  {' · '}
                  <span className="tnum">{formatInt(blocksAgo)}</span> blocks ago
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            className="reveal mt-7 engraved-inset rounded-sm px-6 py-6 font-body text-sm text-stone"
            style={{ animationDelay: '420ms' }}
          >
            No reigning sovereign. Any buy above the threshold below claims the
            crown.
          </div>
        )}

        {/* Tribute + threshold stat strip */}
        <div
          className="reveal mt-8 grid grid-cols-2 gap-px bg-bronze/50 rounded-sm overflow-hidden"
          style={{ animationDelay: '640ms' }}
        >
          <StatStrip
            label="Tribute Accrued"
            value={`${formatWeiETH(king.kingEarningsWei, 3)} Ξ`}
            foot="Reigning earnings · pull to claim"
            accent="gold"
          />
          <StatStrip
            label="Tribute to Ascend"
            value={`${formatWeiETH(king.thresholdWei, 3)} Ξ`}
            foot="Decayed record × 1.03"
            accent="parchment"
          />
        </div>

        {/* Decay bar */}
        <div
          className="reveal mt-6"
          style={{ animationDelay: '780ms' }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold throb inline-block" />
              Reign Decay
            </div>
            <div className="font-mono text-sm text-parchment tnum drain-pulse">
              {hasKing ? formatTime(secsLeft) : '—'}
            </div>
          </div>
          <div className="engraved-inset rounded-sm h-3 overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${hasKing ? remainingPct : 0}%`,
                background:
                  'linear-gradient(90deg, var(--color-flame) 0%, var(--color-gold) 60%, var(--color-gold-soft) 100%)',
                boxShadow:
                  '0 0 12px rgba(245,165,36,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent 0 9.95%, rgba(0,0,0,0.4) 9.95% 10%)',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
            <span>
              Record · {formatWeiETH(king.recordWei, 2)} Ξ
            </span>
            <span>
              Now · {formatWeiETH(king.decayedRecordWei, 3)} Ξ
            </span>
            <span>Floor · 0.000 Ξ</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatStrip({
  label,
  value,
  foot,
  accent,
}: {
  label: string;
  value: string;
  foot: string;
  accent: 'gold' | 'parchment';
}) {
  return (
    <div className="bg-vellum px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright mb-2">
        {label}
      </div>
      <div
        className={`font-display text-4xl tnum ${
          accent === 'gold' ? 'text-gold' : 'text-parchment'
        }`}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] tracking-wider text-stone-soft mt-1">
        {foot}
      </div>
    </div>
  );
}
