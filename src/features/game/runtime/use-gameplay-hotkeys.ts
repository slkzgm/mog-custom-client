import { useEffect, useEffectEvent } from "react";

import type { MoveDirection } from "../game.types";
import { shouldIgnoreGameplayHotkey } from "./game-runtime.utils";

interface UseGameplayHotkeysParams {
  disabled: boolean;
  onMove: (direction: MoveDirection) => void | Promise<void>;
  onPass: () => void | Promise<void>;
  pendingUpgradeOptions?: string[];
  onRerollUpgrades?: () => void | Promise<void>;
  onSelectUpgrade?: (upgradeId: string) => void | Promise<void>;
}

export function useGameplayHotkeys({
  disabled,
  onMove,
  onPass,
  pendingUpgradeOptions = [],
  onRerollUpgrades,
  onSelectUpgrade,
}: UseGameplayHotkeysParams) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || event.repeat || shouldIgnoreGameplayHotkey(event)) return;

    const normalizedKey = event.key.toLowerCase();
    const hasPendingUpgradeSelection = pendingUpgradeOptions.length > 0;

    if (hasPendingUpgradeSelection) {
      if (event.code === "Space" || normalizedKey === " ") {
        event.preventDefault();
        void onRerollUpgrades?.();
        return;
      }

      const upgradeIndex =
        normalizedKey === "1" ? 0 : normalizedKey === "2" ? 1 : normalizedKey === "3" ? 2 : null;

      if (upgradeIndex === null) return;
      const upgradeId = pendingUpgradeOptions[upgradeIndex];
      if (!upgradeId) return;
      event.preventDefault();
      void onSelectUpgrade?.(upgradeId);
      return;
    }

    if (event.code === "Space" || normalizedKey === " ") {
      event.preventDefault();
      void onPass();
      return;
    }

    const direction: MoveDirection | null =
      normalizedKey === "w"
        ? "up"
        : normalizedKey === "arrowup"
          ? "up"
          : normalizedKey === "k"
            ? "up"
        : normalizedKey === "a"
          ? "left"
          : normalizedKey === "arrowleft"
            ? "left"
            : normalizedKey === "h"
              ? "left"
          : normalizedKey === "s"
            ? "down"
            : normalizedKey === "arrowdown"
              ? "down"
              : normalizedKey === "j"
                ? "down"
            : normalizedKey === "d"
              ? "right"
              : normalizedKey === "arrowright"
                ? "right"
                : normalizedKey === "l"
                  ? "right"
              : null;

    if (!direction) return;
    event.preventDefault();
    void onMove(direction);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
