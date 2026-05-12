'use client';

import { useChainId } from 'wagmi';
import { zeroAddress } from 'viem';
import { contractsFor } from '@/lib/contracts';
import { useHasMounted } from './use-has-mounted';

export function useContracts() {
  const chainId = useChainId();
  return contractsFor(chainId);
}

/**
 * True only when env supplied valid contract addresses for the active chain.
 * When false, hooks fall back to mock data so the UI still renders.
 *
 * Always returns `false` on the server and on the very first client render —
 * after the component mounts we re-evaluate. This keeps SSR output and the
 * initial hydration pass consistent regardless of what chain the wallet ends
 * up connected to, so React never throws a hydration mismatch.
 */
export function useIsDeployed() {
  const hasMounted = useHasMounted();
  const c = useContracts();
  if (!hasMounted) return false;
  return c.koth !== zeroAddress && c.hook !== zeroAddress;
}
