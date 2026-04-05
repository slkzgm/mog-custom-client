import { useEffect, useEffectEvent } from "react";

import type { MoveDirection } from "../game.types";
import { shouldIgnoreGameplayHotkey } from "./game-runtime.utils";

interface UseGameplayHotkeysParams {
  disabled: boolean;
  isActionPending?: boolean;
  onMove: (direction: MoveDirection) => void | Promise<void>;
  onPanCamera?: (direction: MoveDirection) => void;
  onPass: () => void | Promise<void>;
  pendingUpgradeOptions?: string[];
  onRerollUpgrades?: () => void | Promise<void>;
  onSelectUpgrade?: (upgradeId: string) => void | Promise<void>;
}

export function useGameplayHotkeys({
  disabled,
  isActionPending = false,
  onMove,
  onPanCamera,
  onPass,
  pendingUpgradeOptions = [],
  onRerollUpgrades,
  onSelectUpgrade,
}: UseGameplayHotkeysParams) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || shouldIgnoreGameplayHotkey(event)) return;

    const normalizedKey = event.key.toLowerCase();
    const hasPendingUpgradeSelection = pendingUpgradeOptions.length > 0;

    if (hasPendingUpgradeSelection) {
      if (disabled || isActionPending) return;

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

    if (disabled) return;

    if (event.code === "Space" || normalizedKey === " ") {
      event.preventDefault();
      void onPass();
      return;
    }

    const cameraDirection: MoveDirection | null =
      normalizedKey === "arrowup"
        ? "up"
        : normalizedKey === "arrowleft"
          ? "left"
          : normalizedKey === "arrowdown"
            ? "down"
            : normalizedKey === "arrowright"
              ? "right"
              : null;

    if (cameraDirection) {
      event.preventDefault();
      onPanCamera?.(cameraDirection);
      return;
    }

    const direction: MoveDirection | null =
      normalizedKey === "w"
        ? "up"
        : normalizedKey === "k"
            ? "up"
        : normalizedKey === "a"
          ? "left"
          : normalizedKey === "h"
              ? "left"
          : normalizedKey === "s"
            ? "down"
            : normalizedKey === "j"
                ? "down"
            : normalizedKey === "d"
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
