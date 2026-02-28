import { useQuery } from "@tanstack/react-query";

import { fetchActiveRun } from "./game.api";

export const activeRunQueryKey = ["game", "active-run"] as const;

export function useActiveRunQuery() {
  return useQuery({
    queryKey: activeRunQueryKey,
    queryFn: fetchActiveRun,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
