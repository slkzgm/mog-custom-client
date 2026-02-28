import { AbstractWalletProvider } from "@abstract-foundation/agw-react";
import type { PropsWithChildren } from "react";
import { abstract } from "viem/chains";

import { queryClient } from "./query-client";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AbstractWalletProvider chain={abstract} queryClient={queryClient}>
      {children}
    </AbstractWalletProvider>
  );
}
