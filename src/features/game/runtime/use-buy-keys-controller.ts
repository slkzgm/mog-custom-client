import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { appConfig } from "../../../app/config";
import type { RunSessionController } from "./use-run-session-controller";
import { parseIntegerInput } from "./game-runtime.utils";

const KEY_PRICE_ETH = "0.001";
const KEY_PRICE_WEI = parseEther(KEY_PRICE_ETH);
const KEYS_CONTRACT_ADDRESS = "0xBDE2483b242C266a97E39826b2B5B3c06FC02916" as const;
const KEYS_CONTRACT_ABI = [
  {
    type: "function",
    stateMutability: "payable",
    name: "buyKeys",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
] as const;

export function useBuyKeysController(runSession: Pick<RunSessionController, "balanceQuery">) {
  const account = useAccount();
  const buyKeysMutation = useWriteContract();
  const buyKeysReceiptQuery = useWaitForTransactionReceipt({
    hash: buyKeysMutation.data,
    query: {
      enabled: Boolean(buyKeysMutation.data),
    },
  });
  const [buyKeysQuantityInput, setBuyKeysQuantityInput] = useState("1");
  const lastBuyKeysRefreshedTxHashRef = useRef<string | null>(null);

  const parsedBuyKeysQuantity = parseIntegerInput(buyKeysQuantityInput);
  const isOnSupportedChain = account.chainId === appConfig.auth.chainId;
  const buyKeysValidationError = !account.isConnected
    ? "Wallet not connected."
    : !isOnSupportedChain
      ? `Wrong chain (expected ${appConfig.auth.chainId}, got ${account.chainId ?? "-"})`
      : parsedBuyKeysQuantity === null
        ? "Quantity must be an integer."
        : parsedBuyKeysQuantity < 1
          ? "Quantity must be >= 1."
          : null;
  const buyKeysValueWei =
    parsedBuyKeysQuantity !== null && parsedBuyKeysQuantity >= 1 ? KEY_PRICE_WEI * BigInt(parsedBuyKeysQuantity) : null;
  const buyKeysValueEth = buyKeysValueWei === null ? "-" : formatEther(buyKeysValueWei);
  const hasBuyKeysTxHash = Boolean(buyKeysMutation.data);
  const isBuyKeysReceiptFetching = hasBuyKeysTxHash && buyKeysReceiptQuery.isFetching;
  const isBuyKeysPending = buyKeysMutation.isPending || isBuyKeysReceiptFetching;
  const canBuyKeys = !buyKeysValidationError && !isBuyKeysPending;

  useEffect(() => {
    const txHash = buyKeysMutation.data;
    if (!txHash || !buyKeysReceiptQuery.isSuccess) return;
    if (lastBuyKeysRefreshedTxHashRef.current === txHash) return;

    lastBuyKeysRefreshedTxHashRef.current = txHash;
    void runSession.balanceQuery.refetch();
  }, [buyKeysMutation.data, buyKeysReceiptQuery.isSuccess, runSession.balanceQuery]);

  const handleBuyKeys = useCallback(async () => {
    if (!canBuyKeys || parsedBuyKeysQuantity === null || parsedBuyKeysQuantity < 1 || buyKeysValueWei === null) return;

    await buyKeysMutation.writeContractAsync({
      address: KEYS_CONTRACT_ADDRESS,
      abi: KEYS_CONTRACT_ABI,
      functionName: "buyKeys",
      args: [BigInt(parsedBuyKeysQuantity)],
      value: buyKeysValueWei,
      chainId: appConfig.auth.chainId,
    });
  }, [buyKeysMutation, buyKeysValueWei, canBuyKeys, parsedBuyKeysQuantity]);

  return {
    account,
    buyKeysMutation,
    buyKeysReceiptQuery,
    buyKeysQuantityInput,
    setBuyKeysQuantityInput,
    parsedBuyKeysQuantity,
    buyKeysValidationError,
    buyKeysValueEth,
    isBuyKeysReceiptFetching,
    canBuyKeys,
    handleBuyKeys,
  };
}

export type BuyKeysController = ReturnType<typeof useBuyKeysController>;
