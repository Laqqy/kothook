import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { mainnet } from './chains';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '00000000000000000000000000000000';

export const wagmiConfig = getDefaultConfig({
  appName: 'King of the Hill',
  projectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://cloudflare-eth.com',
    ),
  },
  ssr: true,
});
