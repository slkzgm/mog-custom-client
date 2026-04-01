import { stringToHex } from "viem";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain, useWalletClient } from "wagmi";

import { appConfig } from "../../app/config";
import { useAuthSessionQuery } from "./use-auth-session-query";
import { useAuthSignInMutation } from "./use-auth-sign-in-mutation";
import { usePublicProfileQuery } from "./use-public-profile-query";

export function shortenAddress(value: string | null | undefined, keep = 6) {
  if (!value) return "-";
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

export function useAuthController() {
  const walletAccount = useAccount();
  const connectMutation = useConnect();
  const disconnectMutation = useDisconnect();
  const signMessageMutation = useSignMessage();
  const switchChainMutation = useSwitchChain();
  const walletClientQuery = useWalletClient();
  const authSessionQuery = useAuthSessionQuery();
  const signInMutation = useAuthSignInMutation();
  const profileQuery = usePublicProfileQuery(walletAccount.address);

  const expectedChainId = appConfig.auth.chainId;
  const walletAddress = walletAccount.address;
  const walletChainId = walletAccount.chainId;
  const agwConnector = connectMutation.connectors.find((connector) => connector.id === "xyz.abs.privy");
  const injectedConnectors = connectMutation.connectors.filter((connector) => connector.id !== "xyz.abs.privy");
  const isWalletConnected = walletAccount.isConnected;
  const isOnExpectedChain = walletChainId === expectedChainId;
  const isAuthenticated = authSessionQuery.data?.ok === true && authSessionQuery.data.status === "authenticated";
  const authValidationError = !walletAddress
    ? "Wallet not connected."
    : !isOnExpectedChain
      ? `Wrong chain for SIWE (expected ${expectedChainId}, got ${walletChainId ?? "-"})`
      : null;
  const canSignIn = Boolean(
    isWalletConnected &&
      !authValidationError &&
      !isAuthenticated &&
      !signInMutation.isPending &&
      !signMessageMutation.isPending &&
      !connectMutation.isPending &&
      !switchChainMutation.isPending,
  );

  function connectAbstractWallet() {
    if (!agwConnector) return;
    connectMutation.connect({ connector: agwConnector });
  }

  function connectInjectedWallet(connectorId: string) {
    const connector = injectedConnectors.find((candidate) => candidate.id === connectorId);
    if (!connector) return;
    connectMutation.connect({ connector });
  }

  function disconnectWallet() {
    disconnectMutation.disconnect();
  }

  function switchToExpectedChain() {
    switchChainMutation.switchChain({ chainId: expectedChainId });
  }

  async function signIn() {
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

  return {
    walletAccount,
    walletAddress,
    walletChainId,
    expectedChainId,
    connectMutation,
    disconnectMutation,
    signMessageMutation,
    switchChainMutation,
    authSessionQuery,
    signInMutation,
    profileQuery,
    agwConnector,
    injectedConnectors,
    isWalletConnected,
    isOnExpectedChain,
    isAuthenticated,
    authValidationError,
    canSignIn,
    connectAbstractWallet,
    connectInjectedWallet,
    disconnectWallet,
    switchToExpectedChain,
    signIn,
  };
}

export type AuthController = ReturnType<typeof useAuthController>;
