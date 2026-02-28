import { stringToHex } from "viem";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain, useWalletClient } from "wagmi";

import { appConfig } from "../../../app/config";
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
  const walletAccount = useAccount();
  const connectMutation = useConnect();
  const disconnectMutation = useDisconnect();
  const signMessageMutation = useSignMessage();
  const switchChainMutation = useSwitchChain();
  const walletClientQuery = useWalletClient();
  const authSessionQuery = useAuthSessionQuery();
  const signInMutation = useAuthSignInMutation();
  const profileQuery = usePublicProfileQuery(walletAccount.address);

  const walletAddress = walletAccount.address;
  const walletChainId = walletAccount.chainId;
  const expectedChainId = appConfig.auth.chainId;
  const walletConnectorId = walletAccount.connector?.id ?? "-";
  const walletConnectorName = walletAccount.connector?.name ?? "-";
  const agwConnector = connectMutation.connectors.find((connector) => connector.id === "xyz.abs.privy");
  const eoaConnectors = connectMutation.connectors.filter((connector) => connector.id !== "xyz.abs.privy");
  const isOnExpectedChain = walletChainId === expectedChainId;
  const authValidationError = !walletAddress
    ? "Wallet not connected."
    : !isOnExpectedChain
      ? `Wrong chain for SIWE (expected ${expectedChainId}, got ${walletChainId ?? "-"})`
      : null;
  const canSignIn = Boolean(
    !authValidationError &&
      !signInMutation.isPending &&
      !signMessageMutation.isPending &&
      !connectMutation.isPending &&
      !switchChainMutation.isPending,
  );

  function handleConnectWithAbstract() {
    if (!agwConnector) return;
    connectMutation.connect({
      connector: agwConnector,
    });
  }

  function handleConnectWithEoa(connectorId: string) {
    const connector = eoaConnectors.find((candidate) => candidate.id === connectorId);
    if (!connector) return;
    connectMutation.connect({
      connector,
    });
  }

  function handleSwitchToExpectedChain() {
    switchChainMutation.switchChain({
      chainId: expectedChainId,
    });
  }

  async function handleSignIn() {
    if (!walletAddress || !walletAccount.isConnected || !isOnExpectedChain) return;

    await signInMutation.mutateAsync({
      address: walletAddress,
      chainId: expectedChainId,
      signMessage: async (message) => {
        const account = walletAddress as `0x${string}`;
        try {
          return String(
            await signMessageMutation.signMessageAsync({
              message,
              account,
            }),
          );
        } catch (signError) {
          const walletClient = walletClientQuery.data;
          if (!walletClient) throw signError;

          const payload = stringToHex(message);
          try {
            const signature = await walletClient.request({
              method: "personal_sign",
              params: [payload, account],
            });
            return String(signature);
          } catch {
            const signature = await walletClient.request({
              method: "personal_sign",
              params: [account, payload],
            });
            return String(signature);
          }
        }
      },
    });

    await authSessionQuery.refetch();
  }

  return (
    <section>
      <h2>Auth</h2>

      <p>Wallet status: {walletAccount.status}</p>
      <p>Wallet address (used for SIWE): {walletAddress ?? "-"}</p>
      <p>Wallet chainId: {walletChainId ?? "-"}</p>
      <p>SIWE expected chainId: {expectedChainId}</p>
      <p>Wallet connector: {walletConnectorName}</p>
      <p>Wallet connector id: {walletConnectorId}</p>

      <button
        type="button"
        onClick={handleConnectWithAbstract}
        disabled={walletAccount.isConnected || !agwConnector || connectMutation.isPending}
      >
        Connect AGW
      </button>
      {eoaConnectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          onClick={() => handleConnectWithEoa(connector.id)}
          disabled={walletAccount.isConnected || connectMutation.isPending}
        >
          Connect {connector.name}
        </button>
      ))}
      <button type="button" onClick={() => disconnectMutation.disconnect()} disabled={!walletAccount.isConnected}>
        Disconnect wallet
      </button>
      <button
        type="button"
        onClick={handleSwitchToExpectedChain}
        disabled={!walletAccount.isConnected || isOnExpectedChain || switchChainMutation.isPending}
      >
        {switchChainMutation.isPending ? "Switching chain..." : `Switch to ${expectedChainId}`}
      </button>

      <p>Public profile name: {profileQuery.data?.profileName ?? "-"}</p>
      <p>Public profile picture: {profileQuery.data?.profilePictureUrl ?? "-"}</p>
      <p>Public profile source: {profileQuery.data?.source ?? "-"}</p>
      <button
        type="button"
        onClick={() => void profileQuery.refetch()}
        disabled={!walletAddress || profileQuery.isFetching}
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
        {signInMutation.isPending || signMessageMutation.isPending
          ? "Signing in..."
          : "Sign in (nonce + SIWE + verify)"}
      </button>
      {authValidationError ? <pre role="alert">sign-in validation: {authValidationError}</pre> : null}
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
      {connectMutation.isError ? (
        <pre role="alert">Connect error: {formatError(connectMutation.error)}</pre>
      ) : null}
      {signMessageMutation.isError ? (
        <pre role="alert">Sign-message error: {formatError(signMessageMutation.error)}</pre>
      ) : null}
    </section>
  );
}
