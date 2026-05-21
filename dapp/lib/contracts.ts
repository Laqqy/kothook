import type { Address } from 'viem';
import { zeroAddress } from 'viem';

type ContractName =
  | 'koth'
  | 'hook'
  | 'kothRouter'
  | 'chronicleSoul'
  | 'chronicleScroll'
  | 'poolManager'
  | 'v4Quoter';

type AddressMap = Record<ContractName, Address>;

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when the key
 * is written as a *literal* property access. Reading via `process.env[k]`
 * with a variable doesn't get rewritten and returns `undefined` on the
 * client. Every entry below therefore reads its env var verbatim.
 */
function addr(v: string | undefined, fallback: Address = zeroAddress): Address {
  if (!v) return fallback;
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return fallback;
  return v as Address;
}

/// Canonical Uniswap v4 PoolManager on Ethereum mainnet (chain id 1).
const MAINNET_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90' as Address;
/// Canonical Uniswap v4 Quoter on mainnet.
const MAINNET_V4_QUOTER = '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203' as Address;

const mainnetAddrs: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_MAINNET_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_MAINNET_HOOK),
  kothRouter: addr(process.env.NEXT_PUBLIC_MAINNET_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_MAINNET_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_MAINNET_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_MAINNET_POOL_MANAGER, MAINNET_POOL_MANAGER),
  v4Quoter: MAINNET_V4_QUOTER,
};

export function contractsFor(_chainId: number): AddressMap {
  return mainnetAddrs;
}

export const KOTH_FEE = { kingBps: 200, burnBps: 100 } as const;
export const THRESHOLD_BPS = 10300n;
export const DECAY_BLOCKS = 3600n;
export const FORFEIT_BLOCKS = 3600n;
export const KEEPER_TIP_BPS = 300n;
