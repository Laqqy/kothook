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
import {
  Crown,
  HairlineDivider,
  Asterism,
  Initial,
  Hourglass,
} from './ornaments';

function formatAddressEngraved(addr: string) {
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

  useEffect(() => {
    setSecsLeft(Number(king.decayBlocksRemaining) * 12);
  }, [king.decayBlocksRemaining]);

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
  const isUrgent = hasKing && remainingPct < 25;

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

  // Drop-cap is the first letter of the reign word, or "T" for "Throne Vacant".
  const dropCapChar = hasKing
    ? (reignWord.charAt(0) || 'R').toUpperCase()
    : 'T';
  const reignWordTail = hasKing ? reignWord.slice(1) : '';

  return (
    <section className="relative">
      {/* halo behind hero */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-16 h-96 -z-0 opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 40% 0%, rgba(232,179,57,0.16) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10">
        {/* Decree marker row */}
        <div
          className="reveal flex items-center gap-4 text-gold-leaf text-[11px] font-mono uppercase tracking-[0.35em] flex-wrap"
          style={{ animationDelay: '60ms' }}
        >
          <span>Royal Decree</span>
          <span className="text-gold">№ {decreeNumeral || 'O'}</span>
          <span className="text-bronze-bright">·</span>
          <span className="tnum text-stone">
            Block {hasMounted ? formatInt(king.blockNumber) : '—'}
          </span>
          {hasMounted && king.isDemo && (
            <span
              className="ml-auto text-[10px] uppercase tracking-[0.3em] text-vermilion-bright border border-vermilion/50 px-2 py-0.5 rounded-sm"
              title="No contract addresses configured. Showing sample data."
            >
              Demo
            </span>
          )}
        </div>

        <HairlineDivider
          ornament={<Asterism className="w-3 h-3 text-gold-leaf" />}
          className="reveal mt-3"
        />

        {/* Display title with illuminated drop cap */}
        {hasKing ? (
          <h1
            className="reveal-ink mt-10 font-display font-medium text-parchment text-balance"
            style={{ animationDelay: '160ms' }}
          >
            <span className="block font-body italic font-normal text-stone text-2xl md:text-3xl mb-2 tracking-wide">
              the
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] 2xl:text-[7.5rem] 3xl:text-[10rem] 4xl:text-[13rem] leading-[0.95] tracking-tight">
              <Initial char={dropCapChar} size="0.95em" />
              <span className="text-parchment">{reignWordTail}</span>{' '}
              <span className="font-body italic font-medium text-gold-pale">
                Reign
              </span>
            </span>
            <span className="block font-body italic font-normal text-stone text-2xl md:text-3xl mt-3 tracking-wide">
              of
            </span>
          </h1>
        ) : (
          <h1
            className="reveal-ink mt-10 font-display font-medium text-parchment"
            style={{ animationDelay: '160ms' }}
          >
            <span className="block font-body italic font-normal text-stone text-2xl md:text-3xl mb-2 tracking-wide">
              the
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] 2xl:text-[7.5rem] 3xl:text-[10rem] 4xl:text-[13rem] leading-[0.95] tracking-tight">
              <Initial char="T" size="0.95em" />
              <span className="font-body italic font-medium text-gold-pale">
                hrone
              </span>{' '}
              <span className="text-parchment">Vacant</span>
            </span>
            <span className="block font-body italic font-normal text-stone text-xl md:text-2xl mt-3 tracking-wide">
              awaiting a sovereign
            </span>
          </h1>
        )}

        {/* Codex address card */}
        {hasKing ? (
          <div
            className="reveal-stamp mt-8 vellum-card rounded-sm px-6 py-5 relative overflow-hidden"
            style={{ animationDelay: '420ms' }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 18% 50%, rgba(74,108,199,0.18) 0%, transparent 55%)',
              }}
            />
            <div className="absolute top-3 right-3 text-gold-leaf opacity-80">
              <Crown className="w-5 h-5" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf mb-2 relative">
              Inscribed in the codex
            </div>
            <div className="flex items-center gap-3 flex-wrap relative">
              <div className="font-mono text-base md:text-lg text-parchment tnum shimmer-gold">
                {formatAddressEngraved(king.currentKing)}
              </div>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy address"
                className="ml-auto shrink-0 text-gold-leaf hover:text-gold text-[10px] font-mono uppercase tracking-[0.2em] transition-colors px-2 py-1"
              >
                {copied ? '✓ COPIED' : '⎘ COPY'}
              </button>
            </div>
            <div className="mt-3 font-mono text-[10px] tracking-widest text-stone relative">
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
            className="reveal mt-8 engraved-inset rounded-sm px-6 py-6 font-body text-base text-stone leading-relaxed"
            style={{ animationDelay: '420ms' }}
          >
            No reigning sovereign. Any buy above the threshold below claims the
            crown.
          </div>
        )}

        {/* Tribute + threshold stat strip — vellum cards */}
        <div
          className="reveal mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 3xl:gap-5"
          style={{ animationDelay: '640ms' }}
        >
          <StatStrip
            label="Tribute Accrued"
            value={`${formatWeiETH(king.kingEarningsWei)} Ξ`}
            foot="Reigning earnings · pull to claim"
            accent="gold"
          />
          <StatStrip
            label="Tribute to Ascend"
            value={`${formatWeiETH(king.thresholdWei)} Ξ`}
            foot="Decayed record × 1.03"
            accent="parchment"
          />
        </div>

        {/* Decay bar — alarming when urgent */}
        <div
          className="reveal mt-7"
          style={{ animationDelay: '780ms' }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <div
              className={`font-mono text-[10px] uppercase tracking-[0.3em] flex items-center gap-2 ${
                isUrgent ? 'text-vermilion-bright' : 'text-gold-leaf'
              }`}
            >
              <Hourglass
                className={`w-3.5 h-3.5 ${
                  isUrgent ? 'drain-pulse-urgent' : ''
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  isUrgent
                    ? 'bg-vermilion-bright throb-vermilion'
                    : 'bg-gold throb'
                }`}
              />
              {isUrgent ? 'Reign Failing' : 'Reign Decay'}
            </div>
            <div
              className={`font-mono text-sm tnum ${
                isUrgent
                  ? 'text-vermilion-bright drain-pulse-urgent'
                  : 'text-parchment drain-pulse'
              }`}
            >
              {hasKing ? formatTime(secsLeft) : '—'}
            </div>
          </div>
          <div className="engraved-inset rounded-sm h-4 overflow-hidden relative">
            <div
              className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear ${
                isUrgent ? 'flicker' : ''
              }`}
              style={{
                width: `${hasKing ? remainingPct : 0}%`,
                background: isUrgent
                  ? 'linear-gradient(90deg, var(--color-vermilion) 0%, var(--color-flame) 60%, var(--color-gold) 100%)'
                  : 'linear-gradient(90deg, var(--color-flame) 0%, var(--color-gold) 60%, var(--color-gold-soft) 100%)',
                boxShadow:
                  '0 0 12px rgba(232,179,57,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent 0 9.95%, rgba(0,0,0,0.45) 9.95% 10%)',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
            <span>
              Record · {formatWeiETH(king.recordWei)} Ξ
            </span>
            <span>
              Now · {formatWeiETH(king.decayedRecordWei)} Ξ
            </span>
            <span>Floor · 0.0000 Ξ</span>
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
    <div className="vellum-card rounded-sm px-5 py-4 3xl:px-7 3xl:py-6">
      <div className="font-mono text-[10px] 3xl:text-xs uppercase tracking-[0.3em] text-gold-leaf mb-2">
        {label}
      </div>
      <div
        className={`font-display text-4xl 3xl:text-5xl 4xl:text-6xl tnum tracking-tight ${
          accent === 'gold' ? 'text-gold' : 'text-parchment'
        }`}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] 3xl:text-xs tracking-wider text-stone mt-1">
        {foot}
      </div>
    </div>
  );
}
