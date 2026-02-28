import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rerollRun } from "./game.api";
import type { RunStateSnapshot } from "./game.types";
import { runStateQueryKey } from "./use-run-state-query";

interface RunRerollParams {
  runId: string;
}

export function useRunRerollMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RunRerollParams) => rerollRun(params.runId),
    onSuccess: async (result, params) => {
      queryClient.setQueryData<RunStateSnapshot>(runStateQueryKey(params.runId), (current) => {
        if (!current?.gameState) {
          return current;
        }

        const nextPlayer = current.gameState.player
          ? {
              ...current.gameState.player,
              treasure: result.newTreasure ?? current.gameState.player.treasure,
            }
          : null;

        return {
          ...current,
          gameState: {
            ...current.gameState,
            player: nextPlayer,
            pendingUpgradeOptions: result.upgradeOptions,
            pendingUpgradeCount: result.upgradeOptions.length,
            currentRerollCount: result.currentRerollCount ?? current.gameState.currentRerollCount,
          },
        };
      });
    },
  });
}
