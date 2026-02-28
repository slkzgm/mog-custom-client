import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRun } from "./game.api";
import { activeRunQueryKey } from "./use-active-run-query";
import { keysBalanceQueryKey } from "./use-keys-balance-query";

interface CreateRunParams {
  keysAmount: number;
}

export function useCreateRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateRunParams) => createRun(params.keysAmount),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: activeRunQueryKey }),
        queryClient.invalidateQueries({ queryKey: keysBalanceQueryKey }),
      ]);
    },
  });
}
