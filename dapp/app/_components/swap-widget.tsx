'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatUnits,
  parseEther,
  parseUnits,
} from 'viem';
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { KOTHRouterAbi, KOTHTokenAbi, KingOfTheHillHookAbi } from '@/abis';
import { useContracts, useIsDeployed } from '@/hooks/use-contracts';
import { useKing } from '@/hooks/use-king';
import { useUser } from '@/hooks/use-user';
import { useQuote } from '@/hooks/use-quote';
import { mockPricing } from './mock-data';
import { formatDecimal, formatWeiETH, formatWeiKOTH } from './format';
import { Crown, HairlineDivider, Asterism } from './ornaments';

type Mode = 'acquire' | 'abdicate';

// Fallback rate shown only when no on-chain quote is available (demo mode,
// pre-mount, very first render before debounce).
const FALLBACK_KOTH_PER_ETH = mockPricing.kothPerEth;

const HOLD_MS = 750;

// Slippage tolerance — user-selectable. We submit minOut = quote × (1 - slip).
// We never submit with minOut = 0; without a live quote the button is disabled.
const SLIPPAGE_PRESETS_BPS: readonly number[] = [50, 100, 300] as const; // 0.5% / 1% / 3%
const DEFAULT_SLIPPAGE_BPS = 100;

export function SwapWidget() {
  const [mode, setMode] = useState<Mode>('acquire');
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  const { address, isConnected } = useAccount();
  const isDeployed = useIsDeployed();
  const { koth, kothRouter, hook } = useContracts();
  const king = useKing();
  const user = useUser();

  const numericAmount = Number(amount) || 0;
  const inputWei = useMemo(() => {
    if (!amount || numericAmount <= 0) return 0n;
    try {
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount, numericAmount]);

  const quote = useQuote(inputWei, mode === 'acquire');

  // Slippage-protected minimum output for the on-chain swap. Computed only
  // when a live quote is available so we never submit a tx with minOut = 0.
  const minOutWei = useMemo(() => {
    if (!quote.isQuoted || quote.amountOutWei <= 0n) return 0n;
    return (quote.amountOutWei * BigInt(10_000 - slippageBps)) / 10_000n;
  }, [quote.isQuoted, quote.amountOutWei, slippageBps]);
  const hasQuote = quote.isQuoted && minOutWei > 0n;

  const receive = useMemo(() => {
    if (numericAmount <= 0) return 0;
    if (quote.isQuoted && quote.amountOutWei > 0n) {
      return Number(quote.amountOutWei) / 1e18;
    }
    if (mode === 'acquire') return numericAmount * FALLBACK_KOTH_PER_ETH;
    return numericAmount / FALLBACK_KOTH_PER_ETH;
  }, [mode, numericAmount, quote.isQuoted, quote.amountOutWei]);

  const rateSubtle = useMemo(() => {
    if (mode === 'acquire') {
      if (quote.isQuoted && numericAmount > 0) {
        const rate = receive / numericAmount;
        return `1 Ξ ≈ ${formatDecimal(rate, { maximumFractionDigits: 0 })} KOTH · live quote`;
      }
      if (quote.isLoading)
        return `Fetching live rate from Uniswap V4 Quoter…`;
      return `1 Ξ ≈ ${formatDecimal(FALLBACK_KOTH_PER_ETH, { maximumFractionDigits: 0 })} KOTH (placeholder)`;
    }
    if (quote.isQuoted && numericAmount > 0) {
      const rate = receive / numericAmount;
      return `1 KOTH ≈ ${formatDecimal(rate, { maximumFractionDigits: 8 })} Ξ · live quote`;
    }
    if (quote.isLoading) return `Fetching live rate from Uniswap V4 Quoter…`;
    return `1 KOTH ≈ ${formatDecimal(1 / FALLBACK_KOTH_PER_ETH, { maximumFractionDigits: 8 })} Ξ (placeholder)`;
  }, [mode, quote.isQuoted, quote.isLoading, numericAmount, receive]);

  const willCrown =
    mode === 'acquire' && inputWei > 0n && inputWei > king.thresholdWei;

  const userBalanceWei =
    mode === 'acquire' ? user.ethBalanceWei : user.kothBalanceWei;

  const insufficientFunds = inputWei > userBalanceWei;

  const isReigningKing = useMemo(() => {
    if (!address) return false;
    return address.toLowerCase() === king.currentKing.toLowerCase();
  }, [address, king.currentKing]);

  const willDethroneSelf =
    mode === 'abdicate' && isReigningKing && inputWei > 0n;

  // ─── KOTH allowance for Sell flow ────────────────────────────────────────
  const allowance = useReadContract({
    address: koth,
    abi: KOTHTokenAbi,
    functionName: 'allowance',
    args: address ? [address, kothRouter] : undefined,
    query: {
      enabled:
        mode === 'abdicate' && isConnected && isDeployed && !!address,
      refetchInterval: 12_000,
    },
  });
  const allowanceWei = (allowance.data as bigint | undefined) ?? 0n;
  const needsApprove =
    mode === 'abdicate' && inputWei > 0n && allowanceWei < inputWei;

  // ─── Write transactions ──────────────────────────────────────────────────
  const swapTx = useWriteContract();
  const approveTx = useWriteContract();
  const swapReceipt = useWaitForTransactionReceipt({ hash: swapTx.data });
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveTx.data });

  useEffect(() => {
    if (approveReceipt.isSuccess) {
      void allowance.refetch();
    }
  }, [approveReceipt.isSuccess, allowance]);

  useEffect(() => {
    if (swapReceipt.isSuccess) {
      setAmount('');
      swapTx.reset();
    }
  }, [swapReceipt.isSuccess, swapTx]);

  const onApprove = () => {
    if (!isDeployed) return;
    approveTx.writeContract({
      address: koth,
      abi: KOTHTokenAbi,
      functionName: 'approve',
      args: [kothRouter, inputWei],
    });
  };

  const onAction = () => {
    if (!isConnected || !isDeployed) return;
    if (numericAmount <= 0 || insufficientFunds) return;
    // Hard gate: never submit a swap without a live quote → never minOut=0.
    // Without this the user is fully exposed to sandwich MEV.
    if (!hasQuote) return;

    if (mode === 'acquire') {
      swapTx.writeContract({
        address: kothRouter,
        abi: KOTHRouterAbi,
        functionName: 'buy',
        args: [minOutWei],
        value: inputWei,
      });
    } else {
      swapTx.writeContract({
        address: kothRouter,
        abi: KOTHRouterAbi,
        functionName: 'sell',
        args: [inputWei, minOutWei],
      });
    }
  };

  // ─── Button labels & state ───────────────────────────────────────────────
  const isApproving = approveTx.isPending || approveReceipt.isLoading;
  const isSwapping = swapTx.isPending || swapReceipt.isLoading;
  const isWorking = isApproving || isSwapping;

  const buttonLabel = useMemo(() => {
    if (!isConnected) return 'Connect a wallet';
    if (!isDeployed) return 'Demo · contracts not configured';
    if (numericAmount <= 0)
      return mode === 'acquire' ? 'Lay tribute' : 'Surrender holdings';
    if (insufficientFunds) return 'Treasury too lean';
    if (needsApprove) {
      if (isApproving) return 'Sealing approval…';
      return 'Approve KOTH for the router';
    }
    if (isSwapping) {
      return mode === 'acquire' ? 'Crowning…' : 'Abdicating…';
    }
    if (!hasQuote) {
      return quote.isLoading
        ? 'Fetching rate…'
        : 'No rate · cannot guard slippage';
    }
    if (mode === 'acquire') {
      return willCrown ? 'Ascend the throne' : 'Tribute paid · no crown';
    }
    if (willDethroneSelf) return 'Hold to seal · abdicate the crown';
    return 'Abdicate & sell';
  }, [
    isConnected,
    isDeployed,
    mode,
    numericAmount,
    insufficientFunds,
    needsApprove,
    isApproving,
    isSwapping,
    willCrown,
    willDethroneSelf,
    hasQuote,
    quote.isLoading,
  ]);

  const buttonDisabled =
    !isConnected ||
    !isDeployed ||
    numericAmount <= 0 ||
    insufficientFunds ||
    isWorking ||
    (!needsApprove && !hasQuote);   // never submit a swap with no slippage guard

  const showCrownStyle = willCrown && mode === 'acquire' && !needsApprove;
  const needsHold = willDethroneSelf && !needsApprove && !isWorking;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <aside
      id="acquire"
      className="reveal vellum-card rounded-sm relative overflow-hidden"
      style={{ animationDelay: '500ms' }}
    >
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gold-leaf">
            <Crown className="w-4 h-4" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
              Ledger of Succession
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone">
            Folio · KOTH/Ξ
          </span>
        </div>

        <div className="grid grid-cols-2 mt-4 border border-bronze rounded-sm overflow-hidden">
          <TabButton
            active={mode === 'acquire'}
            variant="acquire"
            onClick={() => {
              setMode('acquire');
              setAmount('');
            }}
          >
            Acquire
          </TabButton>
          <TabButton
            active={mode === 'abdicate'}
            variant="abdicate"
            onClick={() => {
              setMode('abdicate');
              setAmount('');
            }}
          >
            Abdicate
          </TabButton>
        </div>
      </div>

      <div className="px-5 pb-5">
        <Field
          label={mode === 'acquire' ? 'Tribute' : 'Renounce'}
          unit={mode === 'acquire' ? 'ETH' : 'KOTH'}
          balanceDisplay={
            mode === 'acquire'
              ? formatWeiETH(user.ethBalanceWei, 4)
              : formatWeiKOTH(user.kothBalanceWei, 2)
          }
          value={amount}
          onChange={setAmount}
          onMax={() =>
            setAmount(
              mode === 'acquire'
                ? formatUnits(
                    user.ethBalanceWei > parseEther('0.01')
                      ? user.ethBalanceWei - parseEther('0.01')
                      : 0n,
                    18,
                  )
                : formatUnits(user.kothBalanceWei, 18),
            )
          }
        />

        <div className="flex justify-center my-2">
          <div className="w-7 h-7 rounded-sm bg-vellum border border-bronze flex items-center justify-center text-gold-leaf">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
              <path d="M6 0 L6 9 L2 5 L1 6 L6 11 L11 6 L10 5 L6 9 Z" />
            </svg>
          </div>
        </div>

        <Receive
          label="Receive"
          unit={mode === 'acquire' ? 'KOTH' : 'ETH'}
          value={receive}
          subtle={rateSubtle}
        />

        {/* Threshold strip */}
        <div className="mt-5 engraved-inset rounded-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  showCrownStyle ? 'bg-gold throb' : 'bg-gold-leaf'
                }`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf">
                Crown Threshold
              </span>
            </div>
            <div className="font-mono text-sm text-parchment tnum">
              {formatWeiETH(king.thresholdWei, 4)} Ξ
            </div>
          </div>
          <div
            className={`mt-2 font-body text-[13px] leading-snug transition-colors ${
              showCrownStyle
                ? 'text-gold'
                : mode === 'acquire'
                  ? 'text-stone'
                  : 'text-vermilion-bright'
            }`}
          >
            {mode === 'acquire'
              ? showCrownStyle
                ? '✦ Sufficient tribute. This buy will dethrone the current king and crown thee.'
                : 'A buy strictly above this sum claims the throne and 2% of every subsequent swap.'
              : willDethroneSelf
                ? '⚠ Thou art the reigning sovereign. Selling will trigger abdication.'
                : 'Selling triggers an automatic dethrone if thou art the reigning sovereign.'}
          </div>
        </div>

        {/* Action button — gold for coronation, vermilion+hold for self-dethrone */}
        {needsHold ? (
          <HoldButton
            onConfirm={onAction}
            label={buttonLabel}
            disabled={buttonDisabled}
          />
        ) : (
          <button
            type="button"
            onClick={needsApprove ? onApprove : onAction}
            disabled={buttonDisabled}
            className={`mt-5 w-full font-display tracking-[0.08em] text-base sm:text-lg uppercase py-3.5 rounded-sm transition-all duration-200 disabled:cursor-not-allowed ${
              showCrownStyle
                ? 'bg-gold text-ink hover:bg-flame border border-gold-soft shadow-[0_0_0_1px_rgba(232,179,57,0.5),0_0_32px_rgba(232,179,57,0.5)]'
                : mode === 'acquire'
                  ? 'bg-lapis text-parchment-cream hover:bg-lapis-bright border border-lapis-bright/50 disabled:opacity-50'
                  : 'bg-vermilion-deep text-parchment-cream hover:bg-vermilion border border-vermilion disabled:opacity-50'
            }`}
          >
            {buttonLabel}
          </button>
        )}

        {/* Tx receipt status */}
        {(swapTx.data || approveTx.data) && (
          <TxStatus
            label={isApproving || (approveTx.data && !approveReceipt.isSuccess) ? 'Approval' : 'Swap'}
            hash={(isApproving || (approveTx.data && !approveReceipt.isSuccess) ? approveTx.data : swapTx.data) ?? null}
            isPending={isApproving || isSwapping}
            isSuccess={
              isApproving
                ? approveReceipt.isSuccess
                : swapReceipt.isSuccess
            }
            error={
              (swapTx.error ?? approveTx.error ?? swapReceipt.error ?? approveReceipt.error)?.message
            }
          />
        )}

        <HairlineDivider
          ornament={<Asterism className="w-2.5 h-2.5 text-gold-leaf" />}
          className="mt-5"
        />

        <ul className="mt-4 space-y-1.5 font-mono text-[10px] text-stone uppercase tracking-[0.18em]">
          <li className="flex justify-between">
            <span>To Reigning King</span>
            <span className="text-parchment-soft tnum">2.00%</span>
          </li>
          <li className="flex justify-between">
            <span>To Royal Treasury</span>
            <span className="text-parchment-soft tnum">1.00%</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Slippage Tolerance</span>
            <span className="flex items-center gap-1">
              {SLIPPAGE_PRESETS_BPS.map((bps) => (
                <button
                  type="button"
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={`tnum text-[10px] px-1.5 py-0.5 rounded-sm transition-colors ${
                    slippageBps === bps
                      ? 'bg-gold/20 text-gold border border-gold/40'
                      : 'text-stone hover:text-parchment border border-bronze/40 hover:border-bronze'
                  }`}
                >
                  {(bps / 100).toFixed(bps < 100 ? 1 : 0)}%
                </button>
              ))}
            </span>
          </li>
          {hasQuote && (
            <li className="flex justify-between text-stone/80">
              <span>Min Received</span>
              <span className="text-parchment-soft tnum normal-case">
                {mode === 'acquire'
                  ? `${formatDecimal(Number(minOutWei) / 1e18, { maximumFractionDigits: 2 })} KOTH`
                  : `${formatDecimal(Number(minOutWei) / 1e18, { maximumFractionDigits: 6 })} Ξ`}
              </span>
            </li>
          )}
        </ul>

        {user.pullBalanceWei > 0n && (
          <ClaimCard pullWei={user.pullBalanceWei} hook={hook} />
        )}
      </div>
    </aside>
  );
}

/**
 * Press-and-hold confirmation. Used when an Abdicate would dethrone the
 * pressing wallet — prevents fat-finger self-dethrones.
 */
function HoldButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const fired = useRef(false);

  const stop = () => {
    startedAt.current = null;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    fired.current = false;
    setProgress(0);
  };

  const tick = () => {
    if (startedAt.current == null) return;
    const elapsed = performance.now() - startedAt.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      if (!fired.current) {
        fired.current = true;
        onConfirm();
      }
      stop();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (disabled || fired.current) return;
    startedAt.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={start}
      onTouchStart={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchEnd={stop}
      onTouchCancel={stop}
      className="mt-5 w-full relative font-display tracking-[0.08em] text-base sm:text-lg uppercase py-3.5 rounded-sm transition-all duration-200 disabled:cursor-not-allowed bg-vermilion-deep text-parchment-cream hover:bg-vermilion border border-vermilion-bright disabled:opacity-50 overflow-hidden select-none"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-vermilion-bright/70 transition-[width] duration-75 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        {label}
      </span>
    </button>
  );
}

function ClaimCard({
  pullWei,
  hook,
}: {
  pullWei: bigint;
  hook: `0x${string}`;
}) {
  const claimTx = useWriteContract();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimTx.data });
  const isWorking = claimTx.isPending || claimReceipt.isLoading;

  return (
    <div className="mt-5 engraved-inset rounded-sm px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            Unclaimed Tribute
          </div>
          <div className="font-display text-xl tnum text-parchment mt-1">
            {formatWeiETH(pullWei, 4)} Ξ
          </div>
        </div>
        <button
          type="button"
          disabled={isWorking || claimReceipt.isSuccess}
          onClick={() =>
            claimTx.writeContract({
              address: hook,
              abi: KingOfTheHillHookAbi,
              functionName: 'claim',
            })
          }
          className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] px-3 py-2 bg-gold text-ink hover:bg-flame rounded-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {claimReceipt.isSuccess
            ? '✓ Claimed'
            : isWorking
              ? 'Claiming…'
              : 'Claim'}
        </button>
      </div>
      {claimTx.data && (
        <TxStatus
          label="Claim"
          hash={claimTx.data}
          isPending={isWorking}
          isSuccess={claimReceipt.isSuccess}
          error={(claimTx.error ?? claimReceipt.error)?.message}
        />
      )}
    </div>
  );
}

function TxStatus({
  label,
  hash,
  isPending,
  isSuccess,
  error,
}: {
  label: string;
  hash: `0x${string}` | null;
  isPending: boolean;
  isSuccess: boolean;
  error?: string;
}) {
  if (!hash && !error) return null;
  return (
    <div className="mt-3 engraved-inset rounded-sm px-3 py-2 font-mono text-[10px] tracking-wider">
      {error ? (
        <div className="text-vermilion-bright">
          {label}: {short(error)}
        </div>
      ) : isSuccess ? (
        <div className="text-gold">
          {label} ✓ <span className="text-stone">{short(hash!)}</span>
        </div>
      ) : isPending ? (
        <div className="text-gold-leaf">
          {label} sealing… <span className="text-stone">{short(hash!)}</span>
        </div>
      ) : (
        <div className="text-stone">
          {label} submitted · {short(hash!)}
        </div>
      )}
    </div>
  );
}

function short(s: string, head = 10, tail = 8) {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function TabButton({
  active,
  variant,
  onClick,
  children,
}: {
  active: boolean;
  variant: 'acquire' | 'abdicate';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeAccent =
    variant === 'acquire' ? 'bg-gold' : 'bg-vermilion-bright';
  const activeText =
    variant === 'acquire' ? 'text-gold' : 'text-vermilion-bright';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative font-display tracking-[0.1em] uppercase text-sm sm:text-base py-3 transition-colors min-h-[44px] ${
        active
          ? `bg-vellum ${activeText}`
          : 'bg-ash text-stone hover:text-parchment hover:bg-vellum/70'
      }`}
    >
      {children}
      {active && (
        <span
          aria-hidden
          className={`absolute -bottom-px left-3 right-3 h-px ${activeAccent}`}
        />
      )}
    </button>
  );
}

function Field({
  label,
  unit,
  balanceDisplay,
  value,
  onChange,
  onMax,
}: {
  label: string;
  unit: string;
  balanceDisplay: string;
  value: string;
  onChange: (v: string) => void;
  onMax: () => void;
}) {
  return (
    <div className="engraved-inset rounded-sm px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf">
          {label}
        </span>
        <button
          type="button"
          onClick={onMax}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone hover:text-gold transition-colors py-1.5 px-1"
        >
          Bal · {balanceDisplay} <span className="text-gold-soft">MAX</span>
        </button>
      </div>
      <div className="flex items-baseline gap-3">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          className="flex-1 bg-transparent font-display text-3xl tnum text-parchment placeholder-stone outline-none"
        />
        <span className="font-mono text-sm text-gold-leaf tracking-widest">
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
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-leaf">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
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
        <span className="font-mono text-sm text-gold-leaf tracking-widest">
          {unit}
        </span>
      </div>
      <div className="font-mono text-[10px] tracking-wide text-stone mt-1">
        {subtle}
      </div>
    </div>
  );
}
