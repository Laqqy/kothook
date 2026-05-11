'use client';

import { useBlockNumber, useReadContract, useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { parseEther } from 'viem';
import { KingOfTheHillHookAbi } from '@/abis';
import { mockKing } from '@/app/_components/mock-data';
import { useContracts, useIsDeployed } from './use-contracts';

export interface KingState {
  isDemo: boolean;
  currentKing: Address;
  kingEarningsWei: bigint;
  thresholdWei: bigint;
  decayedRecordWei: bigint;
  recordWei: bigint;
  recordBlock: bigint;
  blockNumber: bigint;
  reignsCount: bigint;
  /**
   * Blocks remaining until decay reaches zero. Zero when no reign exists yet.
   */
  decayBlocksRemaining: bigint;
}

const DECAY_BLOCKS = 3600n;

export function useKing(): KingState {
  const { hook } = useContracts();
  const isDeployed = useIsDeployed();

  const stateReads = useReadContracts({
    contracts: [
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'currentKing' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'getThreshold' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'getDecayedRecord' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'highestBuyAmount' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'highestBuyBlock' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'reignsCount' },
    ],
    query: {
      enabled: isDeployed,
      refetchInterval: 12_000,
    },
  });

  const currentKing = stateReads.data?.[0]?.result as Address | undefined;

  const earningsRead = useReadContract({
    address: hook,
    abi: KingOfTheHillHookAbi,
    functionName: 'kingBalances',
    args: currentKing ? [currentKing] : undefined,
    query: {
      enabled: isDeployed && !!currentKing,
      refetchInterval: 12_000,
    },
  });

  const blockQuery = useBlockNumber({
    watch: { enabled: isDeployed, pollingInterval: 12_000 },
    query: { enabled: isDeployed },
  });

  if (!isDeployed) {
    return demoState();
  }

  const threshold = (stateReads.data?.[1]?.result as bigint | undefined) ?? 0n;
  const decayedRecord = (stateReads.data?.[2]?.result as bigint | undefined) ?? 0n;
  const record = (stateReads.data?.[3]?.result as bigint | undefined) ?? 0n;
  const recordBlock = (stateReads.data?.[4]?.result as bigint | undefined) ?? 0n;
  const reignsCount = (stateReads.data?.[5]?.result as bigint | undefined) ?? 0n;
  const earnings = (earningsRead.data as bigint | undefined) ?? 0n;
  const blockNumber = blockQuery.data ?? 0n;

  const elapsed = blockNumber > recordBlock ? blockNumber - recordBlock : 0n;
  const decayBlocksRemaining =
    elapsed >= DECAY_BLOCKS ? 0n : DECAY_BLOCKS - elapsed;

  return {
    isDemo: false,
    currentKing: currentKing ?? ('0x0000000000000000000000000000000000000000' as Address),
    kingEarningsWei: earnings,
    thresholdWei: threshold,
    decayedRecordWei: decayedRecord,
    recordWei: record,
    recordBlock,
    blockNumber,
    reignsCount,
    decayBlocksRemaining,
  };
}

function demoState(): KingState {
  return {
    isDemo: true,
    currentKing: mockKing.currentKing as Address,
    kingEarningsWei: parseEther(mockKing.kingEarningsETH.toString()),
    thresholdWei: parseEther(mockKing.thresholdETH.toString()),
    decayedRecordWei: parseEther(mockKing.decayedRecordETH.toString()),
    recordWei: parseEther(mockKing.recordETH.toString()),
    recordBlock: BigInt(mockKing.reignStartedAt),
    blockNumber: BigInt(mockKing.blockNumber),
    reignsCount: 7n,
    decayBlocksRemaining: BigInt(
      mockKing.decayBlocksTotal - mockKing.decayBlocksElapsed,
    ),
  };
}
