'use client';

import { useMemo } from 'react';
import {
  useBlockNumber,
  useChainId,
  usePublicClient,
  useReadContracts,
} from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, type Address } from 'viem';
import { parseEther } from 'viem';
import { sepolia } from '@/lib/chains';
import { KingOfTheHillHookAbi } from '@/abis';
import { useContracts, useIsDeployed } from './use-contracts';

/**
 * Alchemy's free tier caps eth_getLogs at a 10-block window, which is useless
 * for scanning history. PublicNode allows the full range. Use it as the
 * dedicated "logs" RPC on Sepolia.
 */
const SEPOLIA_LOGS_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

function logsClientFor(chainId: number) {
  if (chainId === sepolia.id) {
    return createPublicClient({ chain: sepolia, transport: http(SEPOLIA_LOGS_RPC) });
  }
  return null;
}

const FORFEIT_BLOCKS = 3600n;
const KEEPER_TIP_BPS = 300n;

export type DethronedStatus = 'locked' | 'forfeitable' | 'released';

export interface DethronedEntry {
  king: Address;
  /** Earnings recorded at dethrone time (from event). Stays constant even after claim/forfeit. */
  earningsAtDethroneWei: bigint;
  /** Current remaining balance in the hook. 0 means already claimed/forfeited. */
  remainingWei: bigint;
  dethronedAt: bigint;
  blocksUntilForfeit: bigint;
  status: DethronedStatus;
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
  const wagmiClient = usePublicClient();
  const chainId = useChainId();
  const { hook } = useContracts();
  const isDeployed = useIsDeployed();
  // Dedicated logs RPC (PublicNode) for chains where Alchemy free tier is too
  // restrictive; fall back to the wagmi client elsewhere.
  const client = logsClientFor(chainId) ?? wagmiClient;

  const blockQ = useBlockNumber({
    watch: { enabled: isDeployed, pollingInterval: 12_000 },
    query: { enabled: isDeployed },
  });

  // Scan the full chain via the dedicated logs RPC. Phase 1 only — for a
  // mainnet deploy this should move to a proper indexer.
  const eventsQuery = useQuery({
    queryKey: ['throne-events', hook, isDeployed, chainId],
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

  // Map king → earnings at dethrone time from event payload.
  const earningsByKing = new Map<Address, bigint>();
  if (eventsQuery.data) {
    for (const ev of eventsQuery.data) {
      const k = ev.args.king as Address | undefined;
      const earned = ev.args.totalEarned as bigint | undefined;
      if (k && earned !== undefined) earningsByKing.set(k, earned);
    }
  }

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

    const remaining = balRes.result as bigint;
    const dethronedAt = deRes.result as bigint;
    if (dethronedAt === 0n) return [];

    const earningsAtDethrone = earningsByKing.get(king) ?? remaining;
    const deadline = dethronedAt + FORFEIT_BLOCKS;
    const tip = (remaining * KEEPER_TIP_BPS) / 10_000n;

    let status: DethronedStatus;
    if (remaining === 0n) status = 'released';
    else if (blockNumber >= deadline) status = 'forfeitable';
    else status = 'locked';

    const blocksUntilForfeit =
      status === 'locked' ? deadline - blockNumber : 0n;

    return [
      {
        king,
        earningsAtDethroneWei: earningsAtDethrone,
        remainingWei: remaining,
        dethronedAt,
        blocksUntilForfeit,
        status,
        keeperTipWei: tip,
        toBurnWei: remaining - tip,
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
    /** If true: balance is 0 — already claimed or forfeited. */
    released?: boolean;
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
      released: true,
    },
  ];

  return {
    isDemo: true,
    isLoading: false,
    blockNumber,
    entries: raw.map(({ king, earningsETH, dethronedAt, released }) => {
      const wei = parseEther(earningsETH);
      const deadline = dethronedAt + FORFEIT_BLOCKS;
      const tip = (wei * KEEPER_TIP_BPS) / 10_000n;
      let status: DethronedStatus;
      if (released) status = 'released';
      else if (blockNumber >= deadline) status = 'forfeitable';
      else status = 'locked';
      const blocksUntilForfeit =
        status === 'locked' ? deadline - blockNumber : 0n;
      return {
        king,
        earningsAtDethroneWei: wei,
        remainingWei: released ? 0n : wei,
        dethronedAt,
        blocksUntilForfeit,
        status,
        keeperTipWei: tip,
        toBurnWei: wei - tip,
        reasonHash: null,
      };
    }),
  };
}
