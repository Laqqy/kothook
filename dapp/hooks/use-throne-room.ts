'use client';

import { useMemo } from 'react';
import { useBlockNumber, usePublicClient, useReadContracts } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { parseEther } from 'viem';
import { KingOfTheHillHookAbi } from '@/abis';
import { useContracts, useIsDeployed } from './use-contracts';

const FORFEIT_BLOCKS = 3600n;
const KEEPER_TIP_BPS = 300n;

export interface DethronedEntry {
  king: Address;
  earningsWei: bigint;
  dethronedAt: bigint;
  blocksUntilForfeit: bigint;
  isForfeitable: boolean;
  keeperTipWei: bigint;
  toBurnWei: bigint;
  /** Reason hash from KingDethroned event — kept opaque for now. */
  reasonHash: `0x${string}` | null;
}

export interface ThroneRoomState {
  isDemo: boolean;
  isLoading: boolean;
  blockNumber: bigint;
  entries: DethronedEntry[];
}

export function useThroneRoom(): ThroneRoomState {
  const client = usePublicClient();
  const { hook } = useContracts();
  const isDeployed = useIsDeployed();

  const blockQ = useBlockNumber({
    watch: { enabled: isDeployed, pollingInterval: 12_000 },
    query: { enabled: isDeployed },
  });

  // Fetch all KingDethroned events from genesis.
  // TODO: For mainnet, replace with a real indexer. Anvil + small windows
  // make this practical for Phase 1.
  const eventsQuery = useQuery({
    queryKey: ['throne-events', hook, isDeployed],
    queryFn: async () => {
      if (!client || !isDeployed) return [];
      const logs = await client.getContractEvents({
        address: hook,
        abi: KingOfTheHillHookAbi,
        eventName: 'KingDethroned',
        fromBlock: 'earliest',
        toBlock: 'latest',
      });
      return logs;
    },
    enabled: isDeployed && !!client,
    refetchInterval: 12_000,
  });

  // Keep the most recent event per king (in case a king has been
  // dethroned more than once).
  const uniqueKings = useMemo(() => {
    if (!eventsQuery.data) return [] as Address[];
    const seen = new Map<Address, true>();
    // Iterate from most recent backwards.
    for (let i = eventsQuery.data.length - 1; i >= 0; i--) {
      const ev = eventsQuery.data[i];
      const king = ev.args.king as Address | undefined;
      if (king && !seen.has(king)) seen.set(king, true);
    }
    return [...seen.keys()];
  }, [eventsQuery.data]);

  const balanceReads = useReadContracts({
    contracts: uniqueKings.flatMap((k) => [
      {
        address: hook,
        abi: KingOfTheHillHookAbi,
        functionName: 'kingBalances',
        args: [k],
      } as const,
      {
        address: hook,
        abi: KingOfTheHillHookAbi,
        functionName: 'dethronedAt',
        args: [k],
      } as const,
    ]),
    query: {
      enabled: isDeployed && uniqueKings.length > 0,
      refetchInterval: 12_000,
    },
  });

  if (!isDeployed) {
    return demoState();
  }

  const blockNumber = blockQ.data ?? 0n;

  const entries: DethronedEntry[] = uniqueKings.flatMap((king, idx) => {
    const balRes = balanceReads.data?.[idx * 2];
    const deRes = balanceReads.data?.[idx * 2 + 1];
    if (
      !balRes ||
      !deRes ||
      balRes.status !== 'success' ||
      deRes.status !== 'success'
    )
      return [];

    const balance = balRes.result as bigint;
    const dethronedAt = deRes.result as bigint;
    if (balance === 0n || dethronedAt === 0n) return [];

    const deadline = dethronedAt + FORFEIT_BLOCKS;
    const isForfeitable = blockNumber >= deadline;
    const blocksUntilForfeit = isForfeitable ? 0n : deadline - blockNumber;
    const tip = (balance * KEEPER_TIP_BPS) / 10_000n;

    return [
      {
        king,
        earningsWei: balance,
        dethronedAt,
        blocksUntilForfeit,
        isForfeitable,
        keeperTipWei: tip,
        toBurnWei: balance - tip,
        reasonHash: null,
      },
    ];
  });

  // Newest dethrone first.
  entries.sort((a, b) =>
    a.dethronedAt < b.dethronedAt ? 1 : a.dethronedAt > b.dethronedAt ? -1 : 0,
  );

  return {
    isDemo: false,
    isLoading: eventsQuery.isLoading || balanceReads.isLoading,
    blockNumber,
    entries,
  };
}

function demoState(): ThroneRoomState {
  const blockNumber = 18_453_219n;
  const raw: Array<{
    king: Address;
    earningsETH: string;
    dethronedAt: bigint;
  }> = [
    {
      king: '0x9b3c8a1f7d24e9028ab51fae6c802b8c4ad724ff' as Address,
      earningsETH: '4.219',
      dethronedAt: 18_451_002n,
    },
    {
      king: '0x4a2e017c8e371d629f3b58a05a3c2f7e1c8b3071' as Address,
      earningsETH: '1.084',
      dethronedAt: 18_446_500n,
    },
    {
      king: '0x7c916fae8d4f2b9e6c5a8f1d9e3b7c0a2f0a8d24' as Address,
      earningsETH: '0.241',
      dethronedAt: 18_452_900n,
    },
    {
      king: '0x18a47c2e9f5b3d8a1c604f7b9e2a5c8d3e6f1a72' as Address,
      earningsETH: '7.842',
      dethronedAt: 18_440_120n,
    },
  ];

  return {
    isDemo: true,
    isLoading: false,
    blockNumber,
    entries: raw.map(({ king, earningsETH, dethronedAt }) => {
      const wei = parseEther(earningsETH);
      const deadline = dethronedAt + FORFEIT_BLOCKS;
      const isForfeitable = blockNumber >= deadline;
      const blocksUntilForfeit = isForfeitable ? 0n : deadline - blockNumber;
      const tip = (wei * KEEPER_TIP_BPS) / 10_000n;
      return {
        king,
        earningsWei: wei,
        dethronedAt,
        blocksUntilForfeit,
        isForfeitable,
        keeperTipWei: tip,
        toBurnWei: wei - tip,
        reasonHash: null,
      };
    }),
  };
}
