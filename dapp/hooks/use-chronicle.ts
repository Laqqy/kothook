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
import { mainnet } from '@/lib/chains';
import {
  ChronicleSoulAbi,
  ChronicleScrollAbi,
  KingOfTheHillHookAbi,
} from '@/abis';
import { useContracts, useIsDeployed } from './use-contracts';

// Logs RPC — override via env in production. Anchoring to the deploy block
// keeps mainnet eth_getLogs requests inside provider limits.
const MAINNET_LOGS_RPC =
  process.env.NEXT_PUBLIC_MAINNET_LOGS_RPC ?? 'https://eth.llamarpc.com';

const MAINNET_DEPLOY_BLOCK =
  process.env.NEXT_PUBLIC_MAINNET_DEPLOY_BLOCK
    ? BigInt(process.env.NEXT_PUBLIC_MAINNET_DEPLOY_BLOCK)
    : 0n;

function logsClientFor(chainId: number) {
  if (chainId === mainnet.id) {
    return createPublicClient({ chain: mainnet, transport: http(MAINNET_LOGS_RPC) });
  }
  return null;
}

function deployBlockFor(chainId: number): bigint | 'earliest' {
  if (chainId === mainnet.id) return MAINNET_DEPLOY_BLOCK === 0n ? 'earliest' : MAINNET_DEPLOY_BLOCK;
  return 'earliest';
}

export type ReignReason = 'OVERTHROWN' | 'DUMP' | 'FORFEIT' | 'UNKNOWN';

export interface ReignRecord {
  reignId: bigint;
  king: Address;
  startBlock: bigint;
  endBlock: bigint;
  durationBlocks: bigint;
  ethEarnedWei: bigint;
  recordHighWei: bigint;
  reason: ReignReason;
  /** True when the king's coffers are still locked in the hook (no claim yet). */
  unclaimed: boolean;
  remainingWei: bigint;
}

export interface ActiveReign {
  king: Address;
  recordHighWei: bigint;
  recordBlock: bigint;
  earningsWei: bigint;
  reignId: bigint;
}

export interface ChronicleState {
  isDemo: boolean;
  isLoading: boolean;
  blockNumber: bigint;
  active: ActiveReign | null;
  past: ReignRecord[];
  /** Sum of recordHigh across all completed reigns. */
  peakRecordWei: bigint;
}

function decodeReason(b: `0x${string}` | undefined): ReignReason {
  if (!b) return 'UNKNOWN';
  // bytes32 stores ASCII left-padded; strip trailing zeros.
  const hex = b.slice(2);
  let s = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  if (s === 'OVERTHROWN' || s === 'DUMP' || s === 'FORFEIT') return s;
  return 'UNKNOWN';
}

export function useChronicle(): ChronicleState {
  const wagmiClient = usePublicClient();
  const chainId = useChainId();
  const { hook, chronicleSoul: soul } = useContracts();
  const isDeployed = useIsDeployed();
  const client = logsClientFor(chainId) ?? wagmiClient;

  const blockQ = useBlockNumber({
    watch: { enabled: isDeployed, pollingInterval: 12_000 },
    query: { enabled: isDeployed },
  });

  const head = useReadContracts({
    contracts: [
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'reignsCount' },
      { address: hook, abi: KingOfTheHillHookAbi, functionName: 'currentKing' },
      {
        address: hook,
        abi: KingOfTheHillHookAbi,
        functionName: 'highestBuyAmount',
      },
      {
        address: hook,
        abi: KingOfTheHillHookAbi,
        functionName: 'highestBuyBlock',
      },
    ],
    query: { enabled: isDeployed, refetchInterval: 12_000 },
  });

  const reignsCount =
    (head.data?.[0]?.result as bigint | undefined) ?? 0n;
  const currentKing =
    (head.data?.[1]?.result as Address | undefined) ??
    ('0x0000000000000000000000000000000000000000' as Address);
  const highestBuyAmount =
    (head.data?.[2]?.result as bigint | undefined) ?? 0n;
  const highestBuyBlock =
    (head.data?.[3]?.result as bigint | undefined) ?? 0n;

  const ids = useMemo(() => {
    const n = Number(reignsCount);
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [reignsCount]);

  // Read Reign struct for each completed reign.
  const reignReads = useReadContracts({
    contracts: ids.map(
      (id) =>
        ({
          address: soul,
          abi: ChronicleSoulAbi,
          functionName: 'reigns',
          args: [id],
        }) as const,
    ),
    query: {
      enabled: isDeployed && ids.length > 0,
      refetchInterval: 12_000,
    },
  });

  // Look up which dethroned kings still have unclaimed balance.
  const past: ReignRecord[] = useMemo(() => {
    if (!reignReads.data) return [];
    return ids.flatMap((id, idx) => {
      const r = reignReads.data?.[idx];
      if (!r || r.status !== 'success') return [];
      const tuple = r.result as readonly [
        Address,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
      ];
      const [
        king,
        reignId,
        startBlock,
        endBlock,
        ethEarned,
        recordHigh,
        dethroneReason,
      ] = tuple;
      return [
        {
          reignId,
          king,
          startBlock,
          endBlock,
          durationBlocks: endBlock - startBlock,
          ethEarnedWei: ethEarned,
          recordHighWei: recordHigh,
          reason: decodeReason(dethroneReason),
          unclaimed: false,
          remainingWei: 0n,
        },
      ];
    });
  }, [reignReads.data, ids]);

  // Cross-reference with kingBalances to mark unclaimed reigns.
  const balanceReads = useReadContracts({
    contracts: past.map(
      (r) =>
        ({
          address: hook,
          abi: KingOfTheHillHookAbi,
          functionName: 'kingBalances',
          args: [r.king],
        }) as const,
    ),
    query: {
      enabled: isDeployed && past.length > 0,
      refetchInterval: 12_000,
    },
  });

  const pastWithBalances: ReignRecord[] = useMemo(() => {
    if (past.length === 0) return [];
    return past.map((r, idx) => {
      const b = balanceReads.data?.[idx];
      const remaining =
        b && b.status === 'success' ? (b.result as bigint) : 0n;
      return { ...r, remainingWei: remaining, unclaimed: remaining > 0n };
    });
  }, [past, balanceReads.data]);

  // Best-effort: fetch the start block of the active king from NewKing event.
  const fromBlock = deployBlockFor(chainId);
  const activeStart = useQuery({
    queryKey: ['chronicle-active-start', currentKing, hook, chainId, fromBlock.toString()],
    queryFn: async () => {
      if (!client || currentKing === '0x0000000000000000000000000000000000000000')
        return 0n;
      const logs = await client.getContractEvents({
        address: hook,
        abi: KingOfTheHillHookAbi,
        eventName: 'NewKing',
        fromBlock,
        toBlock: 'latest',
      });
      // Pick the most recent NewKing for this king.
      for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if ((log.args.king as Address | undefined) === currentKing) {
          return log.args.blockNumber as bigint;
        }
      }
      return 0n;
    },
    enabled:
      isDeployed &&
      !!client &&
      currentKing !== '0x0000000000000000000000000000000000000000',
    refetchInterval: 12_000,
  });

  const kingBalActive = useReadContracts({
    contracts: [
      {
        address: hook,
        abi: KingOfTheHillHookAbi,
        functionName: 'kingBalances',
        args: [currentKing],
      } as const,
    ],
    query: {
      enabled:
        isDeployed &&
        currentKing !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 12_000,
    },
  });

  if (!isDeployed) {
    return {
      isDemo: true,
      isLoading: false,
      blockNumber: 0n,
      active: null,
      past: [],
      peakRecordWei: 0n,
    };
  }

  const active: ActiveReign | null =
    currentKing !== '0x0000000000000000000000000000000000000000'
      ? {
          king: currentKing,
          recordHighWei: highestBuyAmount,
          recordBlock: highestBuyBlock,
          earningsWei:
            (kingBalActive.data?.[0]?.result as bigint | undefined) ?? 0n,
          reignId: reignsCount,
        }
      : null;

  const peakRecordWei = pastWithBalances.reduce(
    (m, r) => (r.recordHighWei > m ? r.recordHighWei : m),
    active?.recordHighWei ?? 0n,
  );

  return {
    isDemo: false,
    isLoading: head.isLoading || reignReads.isLoading,
    blockNumber: blockQ.data ?? 0n,
    active,
    past: pastWithBalances,
    peakRecordWei,
  };
}

/**
 * Decode the inline base64 SVG data URI from an ERC721 tokenURI string.
 * Returns null if the URI does not match the expected
 * `data:application/json;base64,...` form.
 */
export function imageUriFromTokenUri(tokenUri: string): string | null {
  const prefix = 'data:application/json;base64,';
  if (!tokenUri.startsWith(prefix)) return null;
  try {
    const json = atob(tokenUri.slice(prefix.length));
    const parsed = JSON.parse(json) as { image?: string };
    return parsed.image ?? null;
  } catch {
    return null;
  }
}

export { ChronicleSoulAbi, ChronicleScrollAbi };
