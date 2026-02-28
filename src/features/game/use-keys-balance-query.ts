import { useQuery } from "@tanstack/react-query";

import { fetchKeysBalance } from "./game.api";

export const keysBalanceQueryKey = ["game", "keys-balance"] as const;

export function useKeysBalanceQuery() {
  return useQuery({
    queryKey: keysBalanceQueryKey,
    queryFn: fetchKeysBalance,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
