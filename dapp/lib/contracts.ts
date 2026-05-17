import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { anvil, mainnet, sepolia } from './chains';

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

const HOOK_FALLBACK = '0x11000000000000000000000000000000000000CC' as Address;
/// Canonical Uniswap v4 PoolManager on Sepolia (chain id 11155111).
const SEPOLIA_POOL_MANAGER = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543' as Address;
/// Canonical Uniswap v4 Quoter on Sepolia. Source: developers.uniswap.org/contracts/v4/deployments
const SEPOLIA_V4_QUOTER = '0x61b3f2011a92d183c7dbadbda940a7555ccf9227' as Address;
const MAINNET_V4_QUOTER = '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203' as Address;

const local: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_LOCAL_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_LOCAL_HOOK, HOOK_FALLBACK),
  kothRouter: addr(process.env.NEXT_PUBLIC_LOCAL_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_LOCAL_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_LOCAL_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_LOCAL_POOL_MANAGER),
  v4Quoter: zeroAddress,
};

const sepoliaAddrs: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_SEPOLIA_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_SEPOLIA_HOOK),
  kothRouter: addr(process.env.NEXT_PUBLIC_SEPOLIA_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_SEPOLIA_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_SEPOLIA_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_SEPOLIA_POOL_MANAGER, SEPOLIA_POOL_MANAGER),
  v4Quoter: SEPOLIA_V4_QUOTER,
};

const mainnetAddrs: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_MAINNET_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_MAINNET_HOOK),
  kothRouter: addr(process.env.NEXT_PUBLIC_MAINNET_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_MAINNET_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_MAINNET_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_MAINNET_POOL_MANAGER),
  v4Quoter: MAINNET_V4_QUOTER,
};

export function contractsFor(chainId: number): AddressMap {
  if (chainId === anvil.id) return local;
  if (chainId === sepolia.id) return sepoliaAddrs;
  if (chainId === mainnet.id) return mainnetAddrs;
  return local;
}

export const KOTH_FEE = { kingBps: 200, burnBps: 100 } as const;
export const THRESHOLD_BPS = 10300n;
export const DECAY_BLOCKS = 3600n;
export const FORFEIT_BLOCKS = 3600n;
export const KEEPER_TIP_BPS = 300n;
