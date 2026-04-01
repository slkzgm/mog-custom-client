import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRun } from "./game.api";
import { activeRunQueryKey } from "./use-active-run-query";
import { keysBalanceQueryKey } from "./use-keys-balance-query";
import { getRunModeDefinition } from "./game-modes";
import type { RunType } from "./game.types";

interface CreateRunParams {
  keysAmount: number;
  runType: RunType;
}

export function useCreateRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateRunParams) => createRun(params.keysAmount, params.runType),
    onSuccess: async (_result, variables) => {
      const mode = getRunModeDefinition(variables.runType);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: activeRunQueryKey(variables.runType) }),
        queryClient.invalidateQueries({ queryKey: keysBalanceQueryKey(mode.keyResource) }),
      ]);
    },
  });
}
