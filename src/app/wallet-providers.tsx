import type { PropsWithChildren } from "react";
import { http } from "viem";
import { abstract } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

import { abstractWalletConnector } from "@abstract-foundation/agw-react/connectors";

const wagmiConfig = createConfig({
  chains: [abstract],
  connectors: [
    abstractWalletConnector(),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [abstract.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
});

export function AppWalletProviders({ children }: PropsWithChildren) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
