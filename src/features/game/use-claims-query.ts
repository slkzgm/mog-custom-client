import { useQuery } from "@tanstack/react-query";

import { fetchClaims } from "./game.api";

export const claimsQueryKey = ["game", "claims"] as const;

export function useClaimsQuery(enabled = true) {
  return useQuery({
    queryKey: claimsQueryKey,
    queryFn: fetchClaims,
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
