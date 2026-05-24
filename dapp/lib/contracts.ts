import type { Address } from 'viem';

type ContractName =
  | 'koth'
  | 'hook'
  | 'kothRouter'
  | 'chronicleSoul'
  | 'chronicleScroll'
  | 'poolManager'
  | 'v4Quoter';

type AddressMap = Record<ContractName, Address>;

/// Canonical Uniswap v4 PoolManager on Ethereum mainnet (chain id 1).
const MAINNET_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90' as Address;
/// Canonical Uniswap v4 Quoter on mainnet.
const MAINNET_V4_QUOTER = '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203' as Address;

/**
 * KOTH stack addresses. These are public on-chain identities — keeping them
 * in source (versus Cloudflare env vars) means a redeploy is just a code
 * commit + push. No dashboard fiddling.
 *
 * Currently pointing at the KEST test deploy (2026-05-21). When real KOTH
 * ships, replace these five lines with the new DeployMainnet.s.sol output.
 */
const mainnetAddrs: AddressMap = {
  koth: '0xcd0A94444d9A82aD58D6E7cb4b6cc0c6fe35a5D9' as Address,
  hook: '0x9e1D97A974f741f346a0505a05922492d51380Cc' as Address,
  kothRouter: '0x23eC893349A5d89e79B8d34D8744A625C3a04e7d' as Address,
  chronicleSoul: '0xD0d973FBCB30a80126A43dF70fE876745C28bAB5' as Address,
  chronicleScroll: '0xce85743B57c30Eb5A12562F9c5a64157879bF405' as Address,
  poolManager: MAINNET_POOL_MANAGER,
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
