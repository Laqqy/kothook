import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { anvil, mainnet, sepolia } from './chains';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '00000000000000000000000000000000';

export const wagmiConfig = getDefaultConfig({
  appName: 'King of the Hill',
  projectId,
  chains: [sepolia, anvil, mainnet],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org',
    ),
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://cloudflare-eth.com',
    ),
  },
  ssr: true,
});
