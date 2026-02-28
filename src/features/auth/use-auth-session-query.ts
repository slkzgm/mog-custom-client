import { useQuery } from "@tanstack/react-query";

import { fetchAuthSession } from "./auth.api";

export const authSessionQueryKey = ["auth", "session"] as const;

export function useAuthSessionQuery() {
  return useQuery({
    queryKey: authSessionQueryKey,
    queryFn: fetchAuthSession,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
