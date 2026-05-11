'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { KOTHTokenAbi, KingOfTheHillHookAbi } from '@/abis';
import { mockPricing } from '@/app/_components/mock-data';
import { useContracts, useIsDeployed } from './use-contracts';

export interface UserState {
  isDemo: boolean;
  isConnected: boolean;
  ethBalanceWei: bigint;
  kothBalanceWei: bigint;
  /** ETH the connected user is owed as a dethroned king. */
  pullBalanceWei: bigint;
}

export function useUser(): UserState {
  const { address, isConnected } = useAccount();
  const { koth, hook } = useContracts();
  const isDeployed = useIsDeployed();

  const ethBal = useBalance({
    address,
    query: { enabled: isConnected && isDeployed, refetchInterval: 12_000 },
  });

  const kothBal = useReadContract({
    address: koth,
    abi: KOTHTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && isDeployed && !!address,
      refetchInterval: 12_000,
    },
  });

  const pull = useReadContract({
    address: hook,
    abi: KingOfTheHillHookAbi,
    functionName: 'kingBalances',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && isDeployed && !!address,
      refetchInterval: 12_000,
    },
  });

  if (!isDeployed) {
    return {
      isDemo: true,
      isConnected,
      ethBalanceWei: parseEther(mockPricing.userEthBalance.toString()),
      kothBalanceWei: parseEther(mockPricing.userKothBalance.toString()),
      pullBalanceWei: 0n,
    };
  }

  return {
    isDemo: false,
    isConnected,
    ethBalanceWei: ethBal.data?.value ?? 0n,
    kothBalanceWei: (kothBal.data as bigint | undefined) ?? 0n,
    pullBalanceWei: (pull.data as bigint | undefined) ?? 0n,
  };
}
