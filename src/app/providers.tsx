import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { queryClient } from "./query-client";
import { AppWalletProviders } from "./wallet-providers";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppWalletProviders>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppWalletProviders>
  );
}
