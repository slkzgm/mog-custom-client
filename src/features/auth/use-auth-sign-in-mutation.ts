import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appConfig } from "../../app/config";
import { buildSiweMessage } from "./auth.siwe";
import { fetchAuthNonce, fetchAuthSession, fetchPublicProfile, verifyAuthSignature } from "./auth.api";
import { authSessionQueryKey } from "./use-auth-session-query";
import type { AuthSignInResult } from "./auth.types";

interface AuthSignInParams {
  address: string;
  chainId: number | undefined;
  signMessage: (message: string) => Promise<string>;
}

function isAuthSuccess(result: AuthSignInResult): boolean {
  return result.verifyOk && result.session.ok && result.session.status === "authenticated";
}

export function useAuthSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AuthSignInParams): Promise<AuthSignInResult> => {
      const address = params.address;
      const chainId = params.chainId ?? appConfig.auth.chainId;

      const profile = await fetchPublicProfile(address);
      const nonce = await fetchAuthNonce();
      if (!nonce) {
        throw new Error("Empty nonce returned by /api/auth/nonce");
      }

      const message = buildSiweMessage({
        address,
        chainId,
        nonce,
      });

      const signature = await params.signMessage(message);
      const verifyOk = await verifyAuthSignature({ message, signature });
      const session = await fetchAuthSession();

      return {
        profile,
        nonce,
        message,
        signature,
        verifyOk,
        session,
      };
    },
    onSuccess: async (result) => {
      if (!isAuthSuccess(result)) return;
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
    },
  });
}
