import { useMutation, useQueryClient } from "@tanstack/react-query";

import { teleportRun } from "./game.api";
import { activeRunQueryKey } from "./use-active-run-query";
import { runStateQueryKey } from "./use-run-state-query";
import type { RunStateSnapshot } from "./game.types";

export function useRunTeleportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { runId: string }) => teleportRun(params.runId),
    onSuccess: async (result, params) => {
      if (result.gameState) {
        queryClient.setQueryData<RunStateSnapshot>(runStateQueryKey(params.runId), (current) => ({
          canResume: current?.canResume ?? true,
          gameState: result.gameState,
        }));
      }

      if (result.isGameOver) {
        await queryClient.invalidateQueries({ queryKey: activeRunQueryKey });
      }
    },
  });
}
