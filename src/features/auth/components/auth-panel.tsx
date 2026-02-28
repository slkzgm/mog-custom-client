import {
  useAbstractClient,
  useLoginWithAbstract,
} from "@abstract-foundation/agw-react";
import { useAccount } from "wagmi";

import { ApiError } from "../../../lib/http/api-error";
import { useAuthSessionQuery } from "../use-auth-session-query";
import { useAuthSignInMutation } from "../use-auth-sign-in-mutation";
import { usePublicProfileQuery } from "../use-public-profile-query";

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code ? ` [${error.code}]` : "";
    return `${error.status}${code} ${error.message}`.trim();
  }

  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function shorten(value: string, keep = 12): string {
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

export function AuthPanel() {
  const { login, logout } = useLoginWithAbstract();
  const agwAccount = useAccount();
  const abstractClient = useAbstractClient();
  const authSessionQuery = useAuthSessionQuery();
  const signInMutation = useAuthSignInMutation();
  const profileQuery = usePublicProfileQuery(agwAccount.address);

  const agwAddress = agwAccount.address;
  const canSignIn = Boolean(agwAddress && abstractClient.data && !signInMutation.isPending);

  async function handleSignIn() {
    if (!agwAddress || !abstractClient.data) return;

    await signInMutation.mutateAsync({
      address: agwAddress,
      chainId: agwAccount.chainId,
      signMessage: async (message) => {
        const signature = await abstractClient.data.signMessage({ message });
        return String(signature);
      },
    });

    await authSessionQuery.refetch();
  }

  return (
    <section>
      <h2>Auth</h2>

      <p>Wallet status: {agwAccount.status}</p>
      <p>AGW address (used for SIWE): {agwAddress ?? "-"}</p>
      <p>Wallet chainId: {agwAccount.chainId ?? "-"}</p>

      <button type="button" onClick={login} disabled={agwAccount.isConnected}>
        Connect wallet
      </button>
      <button type="button" onClick={logout} disabled={!agwAccount.isConnected}>
        Disconnect wallet
      </button>

      <p>Public profile name: {profileQuery.data?.profileName ?? "-"}</p>
      <p>Public profile picture: {profileQuery.data?.profilePictureUrl ?? "-"}</p>
      <p>Public profile source: {profileQuery.data?.source ?? "-"}</p>
      <button
        type="button"
        onClick={() => void profileQuery.refetch()}
        disabled={!agwAddress || profileQuery.isFetching}
      >
        Refresh profile
      </button>

      <hr />
      <p>Session status: {authSessionQuery.data?.status ?? "unknown"}</p>
      <p>Session ok: {authSessionQuery.data?.ok ? "true" : "false"}</p>
      <p>Session message: {authSessionQuery.data?.message ?? "-"}</p>
      <p>Session user address: {authSessionQuery.data?.user?.address ?? "-"}</p>
      <p>Session user id: {authSessionQuery.data?.user?.userId ?? "-"}</p>
      <p>Session expiration: {authSessionQuery.data?.user?.expirationTime ?? "-"}</p>
      <p>Session checked at: {authSessionQuery.data?.checkedAtIso ?? "-"}</p>
      <button type="button" onClick={() => void authSessionQuery.refetch()}>
        Recheck session
      </button>

      <hr />
      <button type="button" onClick={() => void handleSignIn()} disabled={!canSignIn}>
        {signInMutation.isPending ? "Signing in..." : "Sign in (nonce + SIWE + verify)"}
      </button>
      <p>Last nonce: {signInMutation.data?.nonce ?? "-"}</p>
      <p>Last verify ok: {signInMutation.data?.verifyOk ? "true" : "false"}</p>
      <p>Last signature: {signInMutation.data?.signature ? shorten(signInMutation.data.signature) : "-"}</p>
      <p>Last message preview: {signInMutation.data?.message ? shorten(signInMutation.data.message, 48) : "-"}</p>

      {profileQuery.isError ? <pre role="alert">Profile error: {formatError(profileQuery.error)}</pre> : null}
      {authSessionQuery.isError ? (
        <pre role="alert">Session error: {formatError(authSessionQuery.error)}</pre>
      ) : null}
      {signInMutation.isError ? (
        <pre role="alert">Sign-in error: {formatError(signInMutation.error)}</pre>
      ) : null}
      {abstractClient.isError ? (
        <pre role="alert">Abstract client error: {formatError(abstractClient.error)}</pre>
      ) : null}
    </section>
  );
}
