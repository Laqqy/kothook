'use client';

import { useBalance, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { KOTHTokenAbi, KingOfTheHillHookAbi } from '@/abis';
import { mockStats } from '@/app/_components/mock-data';
import { useContracts, useIsDeployed } from './use-contracts';

const MAX_SUPPLY_WEI = parseEther('1000000');

export interface TokenStats {
  isDemo: boolean;
  totalSupplyWei: bigint;
  maxSupplyWei: bigint;
  burnedWei: bigint;
  treasuryWei: bigint;
}

export function useTokenStats(): TokenStats {
  const { koth, hook } = useContracts();
  const isDeployed = useIsDeployed();

  const supply = useReadContract({
    address: koth,
    abi: KOTHTokenAbi,
    functionName: 'totalSupply',
    query: { enabled: isDeployed, refetchInterval: 12_000 },
  });

  const treasury = useReadContract({
    address: hook,
    abi: KingOfTheHillHookAbi,
    functionName: 'treasuryBalance',
    query: { enabled: isDeployed, refetchInterval: 12_000 },
  });

  // Native ETH locked in the hook (king balances + treasury + idle).
  const hookEthBalance = useBalance({
    address: hook,
    query: { enabled: isDeployed, refetchInterval: 12_000 },
  });

  if (!isDeployed) {
    return demoStats();
  }

  const totalSupply = (supply.data as bigint | undefined) ?? 0n;
  const treasuryBalance = (treasury.data as bigint | undefined) ?? 0n;

  return {
    isDemo: false,
    totalSupplyWei: totalSupply,
    maxSupplyWei: MAX_SUPPLY_WEI,
    burnedWei: totalSupply === 0n ? 0n : MAX_SUPPLY_WEI - totalSupply,
    // Falls back to native balance read if the hook view ever drifts.
    treasuryWei: treasuryBalance > 0n ? treasuryBalance : (hookEthBalance.data?.value ?? 0n),
  };
}

function demoStats(): TokenStats {
  return {
    isDemo: true,
    totalSupplyWei: parseEther(mockStats.totalSupplyKOTH.toString()),
    maxSupplyWei: MAX_SUPPLY_WEI,
    burnedWei: parseEther(mockStats.burnedKOTH.toString()),
    treasuryWei: parseEther(mockStats.treasuryETH.toString()),
  };
}
