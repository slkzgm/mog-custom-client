import { useQuery } from "@tanstack/react-query";

import { fetchActiveRun } from "./game.api";
import type { RunType } from "./game.types";

export function activeRunQueryKey(runType: RunType = "NORMAL") {
  return ["game", "active-run", runType] as const;
}

export function useActiveRunQuery(runType: RunType = "NORMAL", enabled = true) {
  return useQuery({
    queryKey: activeRunQueryKey(runType),
    queryFn: () => fetchActiveRun(runType),
    enabled,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
