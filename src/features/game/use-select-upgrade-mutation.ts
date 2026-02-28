import { useMutation, useQueryClient } from "@tanstack/react-query";

import { selectUpgrade } from "./game.api";
import type { RunStateSnapshot, SelectUpgradeParams } from "./game.types";
import { activeRunQueryKey } from "./use-active-run-query";
import { runStateQueryKey } from "./use-run-state-query";

export function useSelectUpgradeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SelectUpgradeParams) => selectUpgrade(params),
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
