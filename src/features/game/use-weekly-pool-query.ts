import { useQuery } from "@tanstack/react-query";

import { fetchWeeklyPool } from "./game.api";

export const weeklyPoolQueryKey = ["game", "weekly-pool"] as const;

export function useWeeklyPoolQuery(enabled = true) {
  return useQuery({
    queryKey: weeklyPoolQueryKey,
    queryFn: fetchWeeklyPool,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: 60_000,
  });
}
