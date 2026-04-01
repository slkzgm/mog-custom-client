import { ApiError } from "../../../lib/http/api-error";
import { useAuthController } from "../use-auth-controller";

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
  const auth = useAuthController();

  const walletAccount = auth.walletAccount;
  const walletAddress = auth.walletAddress;
  const walletChainId = auth.walletChainId;
  const expectedChainId = auth.expectedChainId;
  const connectMutation = auth.connectMutation;
  const signMessageMutation = auth.signMessageMutation;
  const switchChainMutation = auth.switchChainMutation;
  const authSessionQuery = auth.authSessionQuery;
  const signInMutation = auth.signInMutation;
  const profileQuery = auth.profileQuery;
  const walletConnectorId = walletAccount.connector?.id ?? "-";
  const walletConnectorName = walletAccount.connector?.name ?? "-";
  const agwConnector = auth.agwConnector;
  const eoaConnectors = auth.injectedConnectors;
  const isOnExpectedChain = auth.isOnExpectedChain;
  const authValidationError = auth.authValidationError;
  const canSignIn = auth.canSignIn;

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
        onClick={auth.connectAbstractWallet}
        disabled={walletAccount.isConnected || !agwConnector || connectMutation.isPending}
      >
        Connect AGW
      </button>
      {eoaConnectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          onClick={() => auth.connectInjectedWallet(connector.id)}
          disabled={walletAccount.isConnected || connectMutation.isPending}
        >
          Connect {connector.name}
        </button>
      ))}
      <button type="button" onClick={auth.disconnectWallet} disabled={!walletAccount.isConnected}>
        Disconnect wallet
      </button>
      <button
        type="button"
        onClick={auth.switchToExpectedChain}
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
      <button type="button" onClick={() => void auth.signIn()} disabled={!canSignIn}>
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
