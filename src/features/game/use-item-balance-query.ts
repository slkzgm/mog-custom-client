import { useQuery } from "@tanstack/react-query";

import { fetchKeysBalance } from "./game.api";
import type { BalanceResource } from "./game.types";

export function itemBalanceQueryKey(resource: BalanceResource) {
  return ["game", "balance", resource] as const;
}

export function useItemBalanceQuery(resource: BalanceResource, enabled = true) {
  return useQuery({
    queryKey: itemBalanceQueryKey(resource),
    queryFn: () => fetchKeysBalance(resource),
    enabled,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
