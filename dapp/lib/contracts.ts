import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { anvil, mainnet } from './chains';

type ContractName =
  | 'koth'
  | 'hook'
  | 'kothRouter'
  | 'chronicleSoul'
  | 'chronicleScroll'
  | 'poolManager';

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

const local: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_LOCAL_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_LOCAL_HOOK, HOOK_FALLBACK),
  kothRouter: addr(process.env.NEXT_PUBLIC_LOCAL_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_LOCAL_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_LOCAL_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_LOCAL_POOL_MANAGER),
};

const mainnetAddrs: AddressMap = {
  koth: addr(process.env.NEXT_PUBLIC_MAINNET_KOTH),
  hook: addr(process.env.NEXT_PUBLIC_MAINNET_HOOK),
  kothRouter: addr(process.env.NEXT_PUBLIC_MAINNET_ROUTER),
  chronicleSoul: addr(process.env.NEXT_PUBLIC_MAINNET_SOUL),
  chronicleScroll: addr(process.env.NEXT_PUBLIC_MAINNET_SCROLL),
  poolManager: addr(process.env.NEXT_PUBLIC_MAINNET_POOL_MANAGER),
};

export function contractsFor(chainId: number): AddressMap {
  if (chainId === anvil.id) return local;
  if (chainId === mainnet.id) return mainnetAddrs;
  return local;
}

export const KOTH_FEE = { kingBps: 200, burnBps: 100 } as const;
export const THRESHOLD_BPS = 10300n;
export const DECAY_BLOCKS = 3600n;
export const FORFEIT_BLOCKS = 3600n;
export const KEEPER_TIP_BPS = 300n;
