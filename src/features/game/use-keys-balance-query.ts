import type { BalanceResource } from "./game.types";
import { itemBalanceQueryKey, useItemBalanceQuery } from "./use-item-balance-query";

export function keysBalanceQueryKey(resource: BalanceResource = "keys") {
  return itemBalanceQueryKey(resource);
}

export function useKeysBalanceQuery(resource: BalanceResource = "keys", enabled = true) {
  return useItemBalanceQuery(resource, enabled);
}
