import { useMutation, useQueryClient } from "@tanstack/react-query";

import { moveRun } from "./game.api";
import type { MoveRunParams } from "./game.types";
import { activeRunQueryKey } from "./use-active-run-query";
import { runStateQueryKey } from "./use-run-state-query";
import type { RunStateSnapshot } from "./game.types";

export function useRunMoveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MoveRunParams) => moveRun(params),
    onSuccess: async (result, params) => {
      if (result.gameState) {
        queryClient.setQueryData<RunStateSnapshot>(runStateQueryKey(params.runId), (current) => ({
          canResume: current?.canResume ?? true,
          gameState: result.gameState,
        }));
      }

      // Only refetch active run metadata when a run can terminate.
      if (result.isGameOver) {
        await queryClient.invalidateQueries({ queryKey: activeRunQueryKey });
      }
    },
  });
}
