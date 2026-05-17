'use client';

import { useEffect, useState } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { zeroAddress, type Address } from 'viem';
import { V4QuoterAbi } from '@/abis';
import { useContracts, useIsDeployed } from './use-contracts';

const POOL_FEE = 0;
const POOL_TICK_SPACING = 60;

export interface QuoteResult {
  amountOutWei: bigint;
  /** True only when amountOutWei was produced by an actual on-chain quoter call. */
  isQuoted: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Debounced exact-input quote for the KOTH pool, using the canonical V4Quoter
 * deployed by Uniswap. Returns the amount the user would receive net of every
 * hook side-effect (king fee, burn fee).
 *
 * @param amountInWei  raw input amount, in wei
 * @param isBuy        true → ETH-in / KOTH-out, false → KOTH-in / ETH-out
 */
export function useQuote(amountInWei: bigint, isBuy: boolean): QuoteResult {
  const client = usePublicClient();
  const chainId = useChainId();
  const isDeployed = useIsDeployed();
  const { v4Quoter, koth, hook } = useContracts();

  // Debounce: user types fast, we don't want a quoter call per keystroke.
  const [debounced, setDebounced] = useState<bigint>(0n);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(amountInWei), 220);
    return () => clearTimeout(t);
  }, [amountInWei]);

  const enabled =
    isDeployed &&
    !!client &&
    v4Quoter !== zeroAddress &&
    debounced > 0n &&
    koth !== zeroAddress &&
    hook !== zeroAddress;

  const q = useQuery({
    queryKey: [
      'v4-quote',
      chainId,
      v4Quoter,
      koth,
      hook,
      isBuy,
      debounced.toString(),
    ],
    queryFn: async (): Promise<bigint> => {
      if (!client) return 0n;
      const result = await client.simulateContract({
        address: v4Quoter,
        abi: V4QuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [
          {
            poolKey: {
              currency0: zeroAddress as Address,
              currency1: koth,
              fee: POOL_FEE,
              tickSpacing: POOL_TICK_SPACING,
              hooks: hook,
            },
            zeroForOne: isBuy,
            exactAmount: debounced,
            hookData: '0x',
          },
        ],
      });
      const [amountOut] = result.result as [bigint, bigint];
      return amountOut;
    },
    enabled,
    staleTime: 5_000,
    refetchInterval: 12_000,
    retry: false,
  });

  return {
    amountOutWei: (q.data as bigint | undefined) ?? 0n,
    isQuoted: q.isSuccess && debounced > 0n,
    isLoading: enabled && (q.isLoading || debounced !== amountInWei),
    error: q.error ? (q.error as Error).message : null,
  };
}
