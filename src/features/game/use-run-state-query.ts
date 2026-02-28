import { useQuery } from "@tanstack/react-query";

import { fetchRunState } from "./game.api";

const disabledRunStateQueryKey = ["game", "run-state", "none"] as const;

export function runStateQueryKey(runId: string) {
  return ["game", "run-state", runId] as const;
}

export function useRunStateQuery(runId: string | null | undefined) {
  return useQuery({
    queryKey: runId ? runStateQueryKey(runId) : disabledRunStateQueryKey,
    queryFn: async () => {
      if (!runId) {
        throw new Error("Missing run id");
      }

      return fetchRunState(runId);
    },
    enabled: Boolean(runId),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
