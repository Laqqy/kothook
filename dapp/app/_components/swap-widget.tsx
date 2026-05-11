'use client';

import { useMemo, useState } from 'react';
import { mockKing, mockPricing } from './mock-data';
import { formatDecimal, formatInt } from './format';
import { Crown, HairlineDivider, Asterism } from './ornaments';

type Mode = 'acquire' | 'abdicate';

export function SwapWidget() {
  const [mode, setMode] = useState<Mode>('acquire');
  const [amount, setAmount] = useState('');

  const numericAmount = Number(amount) || 0;

  const receive = useMemo(() => {
    if (mode === 'acquire') return numericAmount * mockPricing.kothPerEth;
    return numericAmount * mockPricing.ethPerKoth;
  }, [mode, numericAmount]);

  const willCrown =
    mode === 'acquire' && numericAmount >= mockKing.thresholdETH;

  const insufficientFunds =
    mode === 'acquire'
      ? numericAmount > mockPricing.userEthBalance
      : numericAmount > mockPricing.userKothBalance;

  const buttonLabel = useMemo(() => {
    if (numericAmount <= 0) return mode === 'acquire' ? 'Lay tribute' : 'Surrender holdings';
    if (insufficientFunds) return 'Treasury too lean';
    if (mode === 'acquire') {
      return willCrown ? 'Ascend the throne' : 'Tribute paid · no crown';
    }
    return 'Abdicate & sell';
  }, [mode, numericAmount, insufficientFunds, willCrown]);

  return (
    <aside
      id="acquire"
      className="reveal engraved rounded-sm relative overflow-hidden"
      style={{ animationDelay: '500ms' }}
    >
      {/* header strip */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-bronze-bright">
            <Crown className="w-4 h-4" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
              Ledger of Succession
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-soft">
            Folio · KOTH/Ξ
          </span>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 mt-4 border border-bronze rounded-sm overflow-hidden">
          <TabButton
            active={mode === 'acquire'}
            onClick={() => setMode('acquire')}
          >
            Acquire
          </TabButton>
          <TabButton
            active={mode === 'abdicate'}
            onClick={() => setMode('abdicate')}
          >
            Abdicate
          </TabButton>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-5">
        <Field
          label={mode === 'acquire' ? 'Tribute' : 'Renounce'}
          unit={mode === 'acquire' ? 'ETH' : 'KOTH'}
          balance={
            mode === 'acquire'
              ? mockPricing.userEthBalance.toFixed(4)
              : formatInt(mockPricing.userKothBalance)
          }
          value={amount}
          onChange={setAmount}
          onMax={() =>
            setAmount(
              mode === 'acquire'
                ? mockPricing.userEthBalance.toString()
                : mockPricing.userKothBalance.toString(),
            )
          }
        />

        <div className="flex justify-center my-2">
          <div className="w-7 h-7 rounded-sm bg-vellum border border-bronze flex items-center justify-center text-bronze-bright">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
              <path d="M6 0 L6 9 L2 5 L1 6 L6 11 L11 6 L10 5 L6 9 Z" />
            </svg>
          </div>
        </div>

        <Receive
          label="Receive"
          unit={mode === 'acquire' ? 'KOTH' : 'ETH'}
          value={receive}
          subtle={`Rate · 1 Ξ ≈ ${formatDecimal(mockPricing.kothPerEth, { maximumFractionDigits: 2 })} KOTH`}
        />

        {/* Threshold strip */}
        <div className="mt-5 engraved-inset rounded-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  willCrown ? 'bg-gold throb' : 'bg-bronze-bright'
                }`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
                Crown Threshold
              </span>
            </div>
            <div className="font-mono text-sm text-parchment tnum">
              {mockKing.thresholdETH.toFixed(3)} Ξ
            </div>
          </div>
          <div
            className={`mt-2 font-body text-[12px] leading-snug transition-colors ${
              willCrown
                ? 'text-gold'
                : mode === 'acquire'
                  ? 'text-stone-soft'
                  : 'text-crimson'
            }`}
          >
            {mode === 'acquire'
              ? willCrown
                ? '✦ Sufficient tribute. This buy will dethrone the current king and crown thee.'
                : 'A buy strictly above this sum claims the throne and 2% of every subsequent swap.'
              : 'Selling triggers an automatic dethrone if thou art the reigning sovereign.'}
          </div>
        </div>

        {/* Action */}
        <button
          type="button"
          disabled={numericAmount <= 0 || insufficientFunds}
          className={`mt-5 w-full font-display text-lg tracking-wide uppercase py-3.5 rounded-sm transition-all duration-200 disabled:cursor-not-allowed ${
            willCrown
              ? 'bg-gold text-ink hover:bg-flame border border-gold-soft shadow-[0_0_0_1px_rgba(245,165,36,0.4),0_0_24px_rgba(245,165,36,0.35)]'
              : mode === 'acquire'
                ? 'bg-bronze text-parchment hover:bg-bronze-soft border border-bronze-soft disabled:opacity-50'
                : 'bg-crimson-deep text-parchment hover:bg-crimson border border-crimson disabled:opacity-50'
          }`}
        >
          {buttonLabel}
        </button>

        <HairlineDivider
          ornament={<Asterism className="w-2.5 h-2.5 text-bronze-bright" />}
          className="mt-5"
        />

        {/* Fee breakdown */}
        <ul className="mt-4 space-y-1.5 font-mono text-[10px] text-stone-soft uppercase tracking-[0.18em]">
          <li className="flex justify-between">
            <span>To Reigning King</span>
            <span className="text-parchment-soft tnum">2.00%</span>
          </li>
          <li className="flex justify-between">
            <span>To Royal Treasury</span>
            <span className="text-parchment-soft tnum">1.00%</span>
          </li>
          <li className="flex justify-between">
            <span>Slippage Tolerance</span>
            <span className="text-parchment-soft tnum">0.50%</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative font-display tracking-wide text-base py-2.5 transition-colors ${
        active
          ? 'bg-vellum text-gold'
          : 'bg-ash text-stone hover:text-parchment hover:bg-vellum/70'
      }`}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute -bottom-px left-3 right-3 h-px bg-gold"
        />
      )}
    </button>
  );
}

function Field({
  label,
  unit,
  balance,
  value,
  onChange,
  onMax,
}: {
  label: string;
  unit: string;
  balance: string;
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
}) {
  return (
    <div className="engraved-inset rounded-sm px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
          {label}
        </span>
        <button
          type="button"
          onClick={onMax}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone hover:text-gold transition-colors"
        >
          Bal · {balance} <span className="text-gold-soft">MAX</span>
        </button>
      </div>
      <div className="flex items-baseline gap-3">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/[^0-9.]/g, ''))
          }
          className="flex-1 bg-transparent font-display text-3xl tnum text-parchment placeholder-stone-soft outline-none"
        />
        <span className="font-mono text-sm text-bronze-bright tracking-widest">
          {unit}
        </span>
      </div>
    </div>
  );
}

function Receive({
  label,
  unit,
  value,
  subtle,
}: {
  label: string;
  unit: string;
  value: number;
  subtle: string;
}) {
  return (
    <div className="engraved-inset rounded-sm px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze-bright">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-soft">
          Estimate
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="flex-1 font-display text-3xl tnum text-parchment-soft">
          {value > 0
            ? formatDecimal(value, {
                maximumFractionDigits: unit === 'KOTH' ? 2 : 6,
              })
            : '0'}
        </span>
        <span className="font-mono text-sm text-bronze-bright tracking-widest">
          {unit}
        </span>
      </div>
      <div className="font-mono text-[10px] tracking-wide text-stone-soft mt-1">
        {subtle}
      </div>
    </div>
  );
}
