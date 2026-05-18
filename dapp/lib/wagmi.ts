import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { anvil, mainnet, sepolia } from './chains';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '00000000000000000000000000000000';

// The FIRST chain in this list is the dapp's default — wagmi treats it as the
// network shown for read calls before the wallet connects. We list mainnet
// first so the production experience defaults to mainnet; Sepolia + Anvil are
// kept available for QA but live behind the wallet chain switcher.
export const wagmiConfig = getDefaultConfig({
  appName: 'King of the Hill',
  projectId,
  chains: [mainnet, sepolia, anvil],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://cloudflare-eth.com',
    ),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.drpc.org',
    ),
    [anvil.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
});
