import { useQuery } from "@tanstack/react-query";

import { fetchPublicProfile } from "./auth.api";

export function usePublicProfileQuery(address: string | undefined) {
  return useQuery({
    queryKey: ["auth", "public-profile", (address ?? "").toLowerCase()] as const,
    queryFn: () => fetchPublicProfile(address as string),
    enabled: Boolean(address),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
