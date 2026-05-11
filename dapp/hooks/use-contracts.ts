'use client';

import { useChainId } from 'wagmi';
import { zeroAddress } from 'viem';
import { contractsFor } from '@/lib/contracts';

export function useContracts() {
  const chainId = useChainId();
  return contractsFor(chainId);
}

/**
 * True only when env supplied valid contract addresses for the active chain.
 * When false, hooks fall back to mock data so the UI still renders.
 */
export function useIsDeployed() {
  const c = useContracts();
  return c.koth !== zeroAddress && c.hook !== zeroAddress;
}
