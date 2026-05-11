import type { Address } from 'viem';
import { anvil, mainnet } from './chains';

type ContractName =
  | 'koth'
  | 'hook'
  | 'kothRouter'
  | 'chronicleSoul'
  | 'chronicleScroll'
  | 'poolManager';

type AddressMap = Record<ContractName, Address>;

const env = (k: string): Address | undefined => {
  const v = process.env[k];
  if (!v) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return undefined;
  return v as Address;
};

const local: AddressMap = {
  koth: env('NEXT_PUBLIC_LOCAL_KOTH') ?? '0x0000000000000000000000000000000000000000',
  hook: env('NEXT_PUBLIC_LOCAL_HOOK') ?? '0x11000000000000000000000000000000000000CC',
  kothRouter: env('NEXT_PUBLIC_LOCAL_ROUTER') ?? '0x0000000000000000000000000000000000000000',
  chronicleSoul: env('NEXT_PUBLIC_LOCAL_SOUL') ?? '0x0000000000000000000000000000000000000000',
  chronicleScroll: env('NEXT_PUBLIC_LOCAL_SCROLL') ?? '0x0000000000000000000000000000000000000000',
  poolManager: env('NEXT_PUBLIC_LOCAL_POOL_MANAGER') ?? '0x0000000000000000000000000000000000000000',
};

const mainnetAddrs: AddressMap = {
  koth: env('NEXT_PUBLIC_MAINNET_KOTH') ?? '0x0000000000000000000000000000000000000000',
  hook: env('NEXT_PUBLIC_MAINNET_HOOK') ?? '0x0000000000000000000000000000000000000000',
  kothRouter: env('NEXT_PUBLIC_MAINNET_ROUTER') ?? '0x0000000000000000000000000000000000000000',
  chronicleSoul: env('NEXT_PUBLIC_MAINNET_SOUL') ?? '0x0000000000000000000000000000000000000000',
  chronicleScroll: env('NEXT_PUBLIC_MAINNET_SCROLL') ?? '0x0000000000000000000000000000000000000000',
  poolManager: env('NEXT_PUBLIC_MAINNET_POOL_MANAGER') ?? '0x0000000000000000000000000000000000000000',
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
