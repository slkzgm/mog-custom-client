import { useQuery } from "@tanstack/react-query";

import { fetchGameStatus } from "./game.api";

export const gameStatusQueryKey = ["game", "status"] as const;

export function useGameStatusQuery() {
  return useQuery({
    queryKey: gameStatusQueryKey,
    queryFn: fetchGameStatus,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}
